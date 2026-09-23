// Run: node server/nbcrna.test.js
// Covers the direct lookup, the directory-search fallback and the
// Playwright driver against a local mock of the NBCRNA pages.
const assert = require("assert");
const http = require("http");
const { checkApplicant } = require("./nbcrna");
const { searchDirectory } = require("./nbcrna-directory");

// ---- fake NBCRNA data: internal ID ≠ cert # for the two newer CRNAs ----
const PEOPLE = {
  125095: { id: "125095", cert: "125095", name: "Eric B Hayslip", period: "01/01/2023 - 12/31/2026", status: "Re-Certified" },
  1126369: { id: "144366", cert: "144366", name: "Arif Amos Sabir", period: "05/10/2023 - 05/31/2027", status: "Certified" },
  1128914: { id: "147306", cert: "147306", name: "John R Fratianni", period: "01/22/2024 - 07/31/2028", status: "Certified" },
  144366: { id: "990001", cert: "990001", name: "Somebody Else", period: "01/01/2020 - 12/31/2027", status: "Certified" }, // ID collision
};
const DIRECTORY = {
  "arif sabir": [{ custId: "1126369", name: "Arif Amos Sabir" }],
  "john fratianni": [{ custId: "1128914", name: "John R Fratianni" }],
  "eric hayslip": [{ custId: "125095", name: "Eric B Hayslip" }],
};

const fakeLookup = async (num) => {
  const p = PEOPLE[String(num).replace(/^0+/, "")];
  if (!p) return { found: false, reason: `no NBCRNA record for #${num}` };
  const [s, e] = p.period.split(" - ");
  const d = (x) => { const m = x.match(/(\d+)\/(\d+)\/(\d+)/); return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2], 23, 59, 59)); };
  return { found: true, id: p.id, certNumber: p.cert, name: p.name, residence: "", status: p.status, period: p.period, periodStart: d(s), periodEnd: d(e) };
};
const fakeSearch = async (first, last) => DIRECTORY[`${first} ${last}`.toLowerCase()] || [];
const deps = { lookupNbcrna: fakeLookup, searchDirectory: fakeSearch };
const now = new Date("2026-09-23T12:00:00Z");

(async () => {
  // Older CRNA: direct hit, no directory search needed
  let r = await checkApplicant({ name: "Eric Hayslip", nbcrna_number: "125095" }, now, { ...deps, searchDirectory: async () => { throw new Error("should not search"); } });
  assert.strictEqual(r.verified, true, r.reason);

  // Newer CRNA, "No data found" on the direct URL → found by name
  r = await checkApplicant({ name: "John Fratianni", nbcrna_number: "147306" }, now, deps);
  assert.strictEqual(r.verified, true, r.reason);
  assert.match(r.reason, /directory search/);
  assert.strictEqual(r.record.certNumber, "147306");

  // Newer CRNA whose cert # collides with someone else's internal ID → still found by name
  r = await checkApplicant({ name: "Arif Sabir", nbcrna_number: "144366" }, now, deps);
  assert.strictEqual(r.verified, true, r.reason);
  assert.strictEqual(r.record.name, "Arif Amos Sabir");

  // Right name, wrong number → not verified, and the email says what NBCRNA has
  r = await checkApplicant({ name: "Arif Sabir", nbcrna_number: "111111" }, now, deps);
  assert.strictEqual(r.verified, false);
  assert.match(r.reason, /Arif Amos Sabir \(#144366\)/);

  // Right number, wrong name → not verified
  r = await checkApplicant({ name: "Jane Doe", nbcrna_number: "147306" }, now, deps);
  assert.strictEqual(r.verified, false);
  assert.match(r.reason, /nobody named "jane doe"/);

  // Fallback switched off → old behaviour
  process.env.NBCRNA_DIRECTORY = "off";
  r = await checkApplicant({ name: "John Fratianni", nbcrna_number: "147306" }, now, deps);
  assert.strictEqual(r.verified, false);
  assert.match(r.reason, /no NBCRNA record for #147306/);
  delete process.env.NBCRNA_DIRECTORY;

  // Directory search throws → checkApplicant throws (caller treats it as "couldn't reach")
  await assert.rejects(checkApplicant({ name: "John Fratianni", nbcrna_number: "147306" }, now, { ...deps, searchDirectory: async () => { throw new Error("boom"); } }));

  // ---- Playwright driver against a mock of the directory page ----
  const page = `<html><body>
    <input id="P17800_FIRSTNAME"><input id="P17800_LASTNAME"><button id="aaCRTSubmitBtn">Submit</button>
    <div id="out"></div>
    <script>
      document.getElementById('aaCRTSubmitBtn').onclick = () => setTimeout(() => {
        const f = document.getElementById('P17800_FIRSTNAME').value, l = document.getElementById('P17800_LASTNAME').value;
        document.getElementById('out').innerHTML = (f === 'john' && l === 'fratianni')
          ? '<table><tr><td><a href="f?p=500:17820::::RP,17820:P17820_CUST_ID:1128914">View</a></td><td>John R Fratianni</td><td>01/22/2024</td><td>CA</td></tr></table>'
          : '<p>No data found</p>';
      }, 300);
    </script></body></html>`;
  const srv = http.createServer((req, res) => { res.setHeader("content-type", "text/html"); res.end(page); });
  await new Promise((ok) => srv.listen(0, ok));
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const launch = process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : undefined;
  try {
    let hits = await searchDirectory("john", "fratianni", { url, launch, timeoutMs: 20000 });
    assert.deepStrictEqual(hits, [{ custId: "1128914", name: "John R Fratianni", initiallyCertified: "01/22/2024", state: "CA" }]);
    hits = await searchDirectory("jane", "doe", { url, launch, timeoutMs: 20000 });
    assert.deepStrictEqual(hits, []);
  } finally {
    srv.close();
  }
  console.log("all nbcrna tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
