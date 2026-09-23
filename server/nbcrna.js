// Automatic NBCRNA credential check for new sign-ups.
//
// The NBCRNA public "Certification Details" page can be opened directly by
// certification number (no search form, no login), so the server checks each
// applicant itself instead of relying on a browser on Eric's Mac.
// Anything that isn't a clean match falls back to Eric's Approve/Reject email.

const DETAILS_URL = (num) =>
  `https://portal.nbcrna.com/nbcrnassa/f?p=500:17820::::RP,17820:P17820_CUST_ID:${encodeURIComponent(num)}`;

const ACTIVE_STATUSES = ["certified", "re-certified", "recertified"];
const CREDENTIALS = new Set([
  "crna", "dnp", "dnap", "msn", "mna", "ms", "msna", "aprn", "rn", "bsn", "phd", "np", "jr", "sr", "ii", "iii", "iv", "mr", "mrs", "ms", "dr",
]);

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "").replace(/^0+/, "");
}

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// Pull every <dt>label</dt><dd>value</dd> pair off the page.
function parseDetails(html) {
  const fields = {};
  const re = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let m;
  while ((m = re.exec(html))) {
    const label = decodeEntities(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    const value = decodeEntities(m[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (label && !(label in fields)) fields[label] = value;
  }
  return fields;
}

// GET with manual redirects so any session cookie Oracle APEX sets is carried along.
async function fetchWithCookies(url, { hops = 6, timeoutMs = 15000 } = {}) {
  const jar = new Map();
  let current = url;
  for (let i = 0; i < hops; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CRNACritics-verifier/1.0; +https://crnacritics.com)",
          Accept: "text/html,application/xhtml+xml",
          ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
        },
      });
    } finally {
      clearTimeout(t);
    }
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of setCookies) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location"), current).toString();
      continue;
    }
    return { status: res.status, html: await res.text() };
  }
  throw new Error("too_many_redirects");
}

async function lookupNbcrna(number) {
  const num = digitsOnly(number);
  if (!num) return { found: false, reason: "no NBCRNA number given" };
  const { status, html } = await fetchWithCookies(DETAILS_URL(num));
  if (status !== 200) throw new Error(`NBCRNA portal returned HTTP ${status}`);
  const f = parseDetails(html);
  if (!f["ID"] && !f["Certification #"]) {
    if (/No data found/i.test(html)) return { found: false, reason: `no NBCRNA record for #${num}` };
    throw new Error("NBCRNA page layout not recognized");
  }
  const period = f["Current Certification Period"] || "";
  const [startStr, endStr] = period.split(/\s*-\s*/);
  return {
    found: true,
    id: f["ID"] || "",
    certNumber: f["Certification #"] || f["ID"] || "",
    name: f["Name"] || "",
    residence: f["Residence"] || "",
    status: f["Certification Status"] || "",
    period,
    periodStart: parseUsDate(startStr),
    periodEnd: parseUsDate(endStr),
  };
}

function parseUsDate(s) {
  const m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), 23, 59, 59));
}

function nameTokens(name) {
  let s = String(name || "").toLowerCase();
  // "Smith, John" → "John Smith" (but "John Smith, CRNA" keeps its order)
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2 && !parts[1].split(/\s+/).every((w) => CREDENTIALS.has(w.replace(/[^a-z]/g, "")))) {
    s = `${parts[1]} ${parts[0]}`;
  }
  return s
    .replace(/[-–]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z']/g, "").replace(/'/g, ""))
    .filter((w) => w && !CREDENTIALS.has(w));
}

// Same first name and same last name. Middle names/initials are ignored;
// a hyphenated or double last name matches if either part matches.
function namesMatch(applicantName, recordName) {
  const a = nameTokens(applicantName);
  const r = nameTokens(recordName);
  if (a.length < 2 || r.length < 2) return false;
  const firstOk = a[0] === r[0];
  const aLast = a.slice(1);
  const rLast = r.slice(1);
  const lastOk = aLast.slice(-2).some((w) => w.length > 1 && rLast.slice(-2).includes(w));
  return firstOk && lastOk;
}

// The details URL takes NBCRNA's *internal* customer ID. For CRNAs certified
// years ago it equals the certification number (Eric: 125095 = 125095), but for
// newer ones it doesn't (cert #144366 → internal 1126369), so a direct lookup
// says "No data found" — or lands on someone else. When that happens, search
// the public directory by name and follow the result link (which carries the
// internal ID) to the record whose certification number matches.
// Env NBCRNA_DIRECTORY=off disables the fallback.
async function findByNameAndNumber(name, want, deps) {
  if (String(process.env.NBCRNA_DIRECTORY || "").toLowerCase() === "off") return null;
  const tokens = nameTokens(name);
  if (tokens.length < 2) return null;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const search = (deps && deps.searchDirectory) || require("./nbcrna-directory").searchDirectory;
  const lookup = (deps && deps.lookupNbcrna) || lookupNbcrna;
  const hits = await search(first, last);
  const seen = [];
  let record = null;
  for (const h of hits.slice(0, 10)) {
    if (!h.custId) continue;
    const rec = await lookup(h.custId);
    if (!rec.found) continue;
    seen.push(rec);
    if (digitsOnly(rec.certNumber) === want) {
      record = rec;
      break;
    }
  }
  return { hits, seen, record };
}

// → { verified, reason, record? }  (throws only on network/layout problems)
// `deps` lets tests swap the network calls.
async function checkApplicant({ name, nbcrna_number }, now = new Date(), deps = {}) {
  const lookup = deps.lookupNbcrna || lookupNbcrna;
  const want = digitsOnly(nbcrna_number);
  let rec = await lookup(nbcrna_number);
  const direct = rec.found && (digitsOnly(rec.certNumber) === want || digitsOnly(rec.id) === want);
  if (!direct) {
    const viaName = await findByNameAndNumber(name, want, deps);
    if (viaName && viaName.record) {
      rec = { ...viaName.record, foundVia: "directory search by name" };
    } else if (viaName) {
      const tokens = nameTokens(name);
      const who = `${tokens[0] || ""} ${tokens[tokens.length - 1] || ""}`.trim();
      if (!viaName.hits.length) {
        return {
          verified: false,
          reason: `no NBCRNA record for #${want}, and nobody named "${who}" in the NBCRNA directory`,
          record: rec.found ? rec : undefined,
        };
      }
      const others = viaName.seen.map((r) => `${r.name} (#${r.certNumber})`);
      return {
        verified: false,
        reason: `no NBCRNA record for #${want}; the directory has ${others.length ? others.join(", ") : `"${who}" with a different number`} — number doesn't match`,
        record: viaName.seen[0] || (rec.found ? rec : undefined),
      };
    } else {
      // Fallback disabled — report what the direct lookup said.
      if (!rec.found) return { verified: false, reason: rec.reason };
      return { verified: false, reason: `number mismatch (NBCRNA shows #${rec.certNumber || rec.id})`, record: rec };
    }
  }
  if (!namesMatch(name, rec.name)) {
    return { verified: false, reason: `name mismatch — NBCRNA #${want} belongs to "${rec.name}"`, record: rec };
  }
  if (!ACTIVE_STATUSES.includes(rec.status.trim().toLowerCase())) {
    return { verified: false, reason: `status is "${rec.status || "blank"}"`, record: rec };
  }
  if (!rec.periodEnd || rec.periodEnd < now || (rec.periodStart && rec.periodStart > now)) {
    return { verified: false, reason: `certification period "${rec.period || "blank"}" doesn't cover today`, record: rec };
  }
  return {
    verified: true,
    reason: `NBCRNA number, name and active status all match${rec.foundVia ? ` (found via ${rec.foundVia})` : ""}`,
    record: rec,
  };
}

module.exports = { checkApplicant, lookupNbcrna, findByNameAndNumber, parseDetails, namesMatch, digitsOnly, DETAILS_URL };
