// NBCRNA Certification Directory search (by first + last name).
//
// The direct "Certification Details" URL takes NBCRNA's *internal* customer ID,
// which only equals the certification number for CRNAs certified years ago.
// Newer CRNAs (e.g. cert #144366 → internal ID 1126369) come back "No data
// found", so we fall back to the public directory search — the same form Eric
// uses by hand — driven by a headless browser, and read the result links,
// which carry the internal ID.

const DIRECTORY_URL = "https://portal.nbcrna.com/nbcrnassa/f?p=500:17800";
const FIRST_SEL = "#P17800_FIRSTNAME";
const LAST_SEL = "#P17800_LASTNAME";
const SUBMIT_SEL = "#aaCRTSubmitBtn";
const RESULT_LINK_SEL = 'a[href*="P17820_CUST_ID"]';

let playwright = null;
function loadPlaywright() {
  if (playwright) return playwright;
  try {
    playwright = require("playwright");
  } catch (e) {
    throw new Error("playwright is not installed (npm install playwright)");
  }
  return playwright;
}

// → [{ custId, name, initiallyCertified, state }]  (throws on browser/network problems)
async function searchDirectory(firstName, lastName, { timeoutMs = 45000, url = DIRECTORY_URL, launch } = {}) {
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  if (!first || !last) return [];
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    ...(launch || {}),
  });
  try {
    const ctx = await browser.newContext({
      userAgent: "Mozilla/5.0 (compatible; CRNACritics-verifier/1.0; +https://crnacritics.com)",
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(timeoutMs);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.fill(FIRST_SEL, first);
    await page.fill(LAST_SEL, last);
    await page.click(SUBMIT_SEL);
    // Results load in place; wait for either a result link or a "no data" message.
    await Promise.race([
      page.waitForSelector(RESULT_LINK_SEL, { state: "attached" }),
      page.waitForFunction(() => /no data found|no records|no results/i.test(document.body.innerText), null, { polling: 500 }),
    ]);
    // Give the report a moment to finish rendering every row.
    await page.waitForTimeout(400);
    return await page.$$eval(RESULT_LINK_SEL, (links) =>
      links.map((a) => {
        const m = (a.getAttribute("href") || "").match(/P17820_CUST_ID:(\d+)/);
        const tr = a.closest("tr");
        const cells = tr ? [...tr.querySelectorAll("td")].map((td) => td.textContent.replace(/\s+/g, " ").trim()) : [];
        // Row layout: [View] [Name] [Initially Certified] [State]
        const text = cells.filter((c) => c && !/^view$/i.test(c));
        return {
          custId: m ? m[1] : "",
          name: text[0] || "",
          initiallyCertified: text.find((c) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(c)) || "",
          state: text.find((c) => /^[A-Z]{2}$/.test(c)) || "",
        };
      })
    );
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { searchDirectory, DIRECTORY_URL };
