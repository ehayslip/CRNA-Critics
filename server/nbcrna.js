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

// → { verified, reason, record? }  (throws only on network/layout problems)
async function checkApplicant({ name, nbcrna_number }, now = new Date()) {
  const rec = await lookupNbcrna(nbcrna_number);
  if (!rec.found) return { verified: false, reason: rec.reason };
  const want = digitsOnly(nbcrna_number);
  if (digitsOnly(rec.certNumber) !== want && digitsOnly(rec.id) !== want) {
    return { verified: false, reason: `number mismatch (NBCRNA shows #${rec.certNumber || rec.id})`, record: rec };
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
  return { verified: true, reason: "NBCRNA number, name and active status all match", record: rec };
}

module.exports = { checkApplicant, lookupNbcrna, parseDetails, namesMatch, digitsOnly, DETAILS_URL };
