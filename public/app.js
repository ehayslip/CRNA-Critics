// ---------- category config (mirrors the tracker's weights + 5/3/1 anchors) ----------

const AGENCY_CATEGORIES = [
  { key: "payBilling", label: "Pay & Billing Accuracy", weight: 0.2, anchors: [[5, "paid exactly as quoted, on time, zero issues"], [3, "mostly accurate, followed up once or twice on a discrepancy"], [1, "rate cut, late payments, or unexplained deductions"]] },
  { key: "contractTerms", label: "Contract Terms", weight: 0.15, anchors: [[5, "fair notice, guaranteed hours honored, clean cancellation language"], [3, "workable terms, but some language one-sided or vague"], [1, "punitive notice/cancellation terms, guaranteed hours not honored"]] },
  { key: "credentialing", label: "Credentialing Support", weight: 0.15, anchors: [[5, "fast, thorough, proactively handled licensing/privileging/malpractice"], [3, "got it done, but you had to chase them or redo steps"], [1, "slow, disorganized, credentialing nearly fell through"]] },
  { key: "communication", label: "Communication / Responsiveness", weight: 0.2, anchors: [[5, "responsive, upfront about the facility before you signed"], [3, "responsive most of the time, facility info incomplete or optimistic"], [1, "hard to reach, misrepresented the assignment before you committed"]] },
  { key: "travelLogistics", label: "Travel & Logistics", weight: 0.1, anchors: [[5, "housing/per diem handled smoothly, reimbursed quickly"], [3, "handled, but reimbursement slow or needed follow-up"], [1, "housing/per diem mishandled or reimbursement never resolved"]] },
  { key: "assignmentMatch", label: "Assignment Quality Match", weight: 0.2, anchors: [[5, "matched the description exactly — schedule, cases, call burden"], [3, "mostly matched, with a few surprises"], [1, "bore little resemblance to what was described going in"]] },
];

const HOSPITAL_CATEGORIES = [
  { key: "caseMix", label: "Case Mix & Acuity", weight: 0.1, anchors: [[5, "strong variety, well matched to skill level, kept you sharp"], [3, "decent mix, but repetitive or occasionally mismatched"], [1, "monotonous, or cases well below/beyond reasonable"]] },
  { key: "staffing", label: "Staffing & Support", weight: 0.1, anchors: [[5, "fully staffed, backup always available, call burden reasonable"], [3, "generally covered, but backup or call load tight at times"], [1, "chronically understaffed, no real backup, unsustainable call"]] },
  { key: "equipment", label: "Equipment & Resources", weight: 0.05, anchors: [[5, "modern, well maintained, drugs and supplies always on hand"], [3, "workable, but occasional equipment issues or shortages"], [1, "outdated/broken equipment or frequent drug shortages"]] },
  { key: "culture", label: "Culture & Collegiality", weight: 0.1, anchors: [[5, "welcoming, treated as part of the team from day one"], [3, "professional but distant, tolerated rather than welcomed"], [1, "openly unwelcoming or difficult toward locum staff"]] },
  { key: "chief", label: "Chief & Leadership Treatment", weight: 0.15, anchors: [[5, "treated like one of the team — a fair share of the schedule and case assignments"], [3, "mostly fair, but you tended to get the surgeons and cases the W-2 staff didn't want"], [1, "treated as disposable — pulled to relieve W-2 staff the moment your cases finished while they sat idle"]] },
  { key: "orientation", label: "Orientation / Onboarding", weight: 0.05, anchors: [[5, "smooth EMR/badge/access setup, productive from day one"], [3, "got you functional, but took longer than it should have"], [1, "disorganized onboarding that ate into productive days"]] },
  { key: "schedule", label: "Schedule Reliability", weight: 0.1, anchors: [[5, "ran exactly as promised, essentially no last-minute changes"], [3, "mostly reliable, with occasional last-minute changes"], [1, "frequent last-minute changes or shifts not honored"]] },
  { key: "lunchesBreaks", label: "Lunches & Breaks", weight: 0.1, anchors: [[5, "anesthesia staff made sure you got lunch every day and most of your breaks"], [3, "lunch most days but not always; break relief was hit or miss"], [1, "lunch was often missed and breaks were essentially nonexistent"]] },
  { key: "meals", label: "Free Meals", weight: 0.05, anchors: [[5, "meals and snacks provided by the hospital"], [3, "meals ordered for the CRNAs weekly or monthly"], [1, "none"]] },
  { key: "locationLogistics", label: "Location / Logistics", weight: 0.05, anchors: [[5, "easy commute, convenient parking, housing close by"], [3, "workable, but commute/parking/housing added real friction"], [1, "difficult commute, poor parking, or housing far from site"]] },
  { key: "supervision", label: "Practice Autonomy", weight: 0.15, anchors: [[5, "independent practice"], [3, "medically directed/supervised loosely"], [1, "medically directed"]] },
];

const GROUP_CATEGORIES = [
  { key: "compensation", label: "Compensation & Benefits", weight: 0.2, anchors: [[5, "pay at or above market, strong benefits and retirement match, raises honored"], [3, "fair pay, but benefits thin or raises slow to come"], [1, "below-market pay, weak benefits, or promised increases never materialized"]] },
  { key: "leadership", label: "Chief & Leadership", weight: 0.2, anchors: [[5, "transparent, fair, advocates for CRNAs, and follows through"], [3, "decent intentions, but inconsistent or plays favorites at times"], [1, "opaque, punitive, or clearly favors physicians/W-2 insiders over the CRNA staff"]] },
  { key: "scheduleCall", label: "Scheduling & Call Burden", weight: 0.15, anchors: [[5, "predictable schedule, fair call rotation, time off honored"], [3, "workable, but call heavier or schedule less predictable than promised"], [1, "unsustainable call, last-minute changes, time off routinely denied"]] },
  { key: "staffingWorkload", label: "Staffing & Workload", weight: 0.15, anchors: [[5, "fully staffed, reasonable room load, relief available"], [3, "generally covered, but stretched thin at times"], [1, "chronically short, constant overtime pressure, no relief"]] },
  { key: "culture", label: "Culture & Respect for CRNAs", weight: 0.15, anchors: [[5, "CRNAs treated as full members of the anesthesia team"], [3, "professional, but a clear physician/CRNA hierarchy"], [1, "CRNAs marginalized, talked down to, or blamed"]] },
  { key: "autonomy", label: "Practice Autonomy", weight: 0.15, anchors: [[5, "independent practice"], [3, "medically directed/supervised loosely"], [1, "medically directed"]] },
];

// Agents are rated on their own — a short scorecard, separate from the agency they work for.
const AGENT_CATEGORIES = [
  { key: "trust", label: "Trustworthiness", weight: 0.3, anchors: [[5, "what they told you and what's in the contract is exactly what happened"], [3, "lived up to most of what they said, with a surprise or two"], [1, "said whatever it took to get you signed — reality was different"]] },
  { key: "communication", label: "Communication & Responsiveness", weight: 0.25, anchors: [[5, "answers texts and emails within a few hours, after hours too when it matters"], [3, "answers by the end of the day"], [1, "business hours only, and sometimes days to hear back"]] },
  { key: "advocacy", label: "Advocacy & Negotiation", weight: 0.2, anchors: [[5, "pushed for your rate, terms, and schedule — you felt represented"], [3, "passed along what you asked for but didn't push"], [1, "worked the facility's side — you had to fight for everything"]] },
  { key: "followThrough", label: "Follow-through on Assignment", weight: 0.15, anchors: [[5, "when pay, housing, or scheduling went wrong, fixed it fast"], [3, "got it resolved eventually, after reminders"], [1, "went quiet once you signed"]] },
  { key: "pressure", label: "Respect for Your Decision", weight: 0.1, anchors: [[5, "no pressure — gave you time and straight information"], [3, "some nudging and manufactured urgency"], [1, "high-pressure tactics and fake deadlines"]] },
];

// Pay is captured as a bracket, not a number, and is never scored.
// Locums quote an hourly rate; staff think in salary, so they get their own annual brackets.
const PAY_RANGES = ["Under $180", "$181–200", "$201–220", "$221–240", "$241–260", "$261–280", "$281+"];
const STAFF_PAY_TYPES = ["W-2", "1099"];
const STAFF_PAY_RANGES = ["Under $200k", "$201k–249k", "$250k–299k", "$300k–349k", "$350k–400k", "Above $400k"];
// What the employee pays out of pocket, per month, for family health coverage.
const FAMILY_INSURANCE_RANGES = ["Under $400", "$401–450", "$451–500", "Above $500", "Not offered"];
// Paid time off, counted in weeks per year.
const PTO_RANGES = ["Under 5 weeks", "6 weeks", "7 weeks", "8 weeks", "9+ weeks"];
// What the group pays for PRN / extra shifts, hourly. Informational, like the rest of this row.
const PRN_RATES = ["Under $170", "$171–180", "$181–190", "$191–200", "$201–210", "Above $210"];

// A score at or below this, on any name, gets the CRNA BEWARE stamp.
const BEWARE_AT = 2;
function isBeware(avg) { return avg > 0 && avg <= BEWARE_AT; }
// The stamp itself. `size` is "lg" on a name's own page, "sm" beside a card or an
// individual review.
function bewareStampHtml(size) {
  return `<span class="beware-mark beware-${size || "sm"}" role="img" aria-label="CRNA Beware — this score is ${BEWARE_AT} or lower">CRNA BEWARE</span>`;
}

// ---------- merging the same name written a dozen ways ----------
// One company, one page. Each rule maps every spelling members actually type onto a single
// canonical name; `test` gets the name lowercased with punctuation and extra spaces stripped.
// `exact: true` means the whole name has to be the alias, so "Aya Locum Tenens" is left alone.
const NAME_RULES = [
  { canonical: "Envision / Envoy", test: (s) => /envision|envidion|envoy/.test(s) },
  { canonical: "HCA Fort Walton Beach", test: (s) => /\bhca\b/.test(s) && /(fort|ft) ?walton/.test(s) },
  { canonical: "LocumTenens.com", test: (s) => /^(lt ?com|lt|locum ?tenens( ?com)?)$/.test(s), exact: true },
  { canonical: "Royal Surgical Associates (RSA)", test: (s) => /^rsa$/.test(s) || /royal surgical/.test(s) },
];
function normalizeName(name) {
  return String(name == null ? "" : name).toLowerCase().replace(/[.,'"’&\/\-_()\[\]]/g, " ").replace(/\s+/g, " ").trim();
}
// The name a review should be filed under: an admin-approved merge first (those are
// specific decisions), then the built-in rules, else the name as typed.
function canonicalName(name) {
  const s = normalizeName(name);
  if (!s) return String(name || "");
  const merged = state.aliases[s];
  if (merged) return merged;
  const hit = NAME_RULES.find((r) => r.test(s));
  return hit ? hit.canonical : String(name).trim();
}
// Every spelling members used for a merged name, so the page can say what it absorbed.
function spellingsFor(rows, field, canonical) {
  const seen = [];
  rows.forEach((r) => {
    const raw = String(r[field] || "").trim();
    if (raw && raw !== canonical && !seen.includes(raw)) seen.push(raw);
  });
  return seen;
}

// ---------- name suggestions (stop duplicates at the keyboard) ----------
// Words that carry no identity — dropped before comparing, so "HCA Fort Walton Beach Medical
// Center" and "HCA Fort Walton Beach" look alike.
const NOISE_WORDS = new Set(["the", "of", "and", "inc", "llc", "lp", "pc", "pa", "co", "corp", "group",
  "health", "healthcare", "medical", "center", "centre", "hospital", "regional", "system", "services",
  "staffing", "locums", "anesthesia", "associates", "partners"]);
// Abbreviations expanded for matching only (never for storage), so "Ft" finds "Fort".
// Single letters stay as they are — "S Wright" is an initial, not "South".
const ABBREV = { ft: "fort", st: "saint", mt: "mount" };
function nameTokens(s) {
  return normalizeName(s).split(" ").filter((w) => w && !NOISE_WORDS.has(w)).map((w) => ABBREV[w] || w);
}
// Initials of a multi-word name: "royal surgical associates" -> "rsa".
function initialsOf(s) {
  const words = normalizeName(s).split(" ").filter(Boolean);
  return words.length > 1 ? words.map((w) => w[0]).join("") : "";
}
// Dice coefficient on letter pairs — a typo-tolerant 0–1 similarity.
function bigramScore(a, b) {
  const pairs = (s) => { const out = []; for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2)); return out; };
  const A = pairs(a.replace(/ /g, "")), B = pairs(b.replace(/ /g, ""));
  if (!A.length || !B.length) return a === b ? 1 : 0;
  const pool = B.slice();
  let hits = 0;
  A.forEach((p) => { const i = pool.indexOf(p); if (i >= 0) { pool.splice(i, 1); hits++; } });
  return (2 * hits) / (A.length + B.length);
}
// How well `typed` matches an existing `name`, 0–100. Higher is a better suggestion.
function matchScore(typed, name) {
  const q = normalizeName(typed), n = normalizeName(name);
  if (!q) return 0;
  if (q === n) return 100;
  if (n.startsWith(q)) return 92;
  if (q === initialsOf(name)) return 88;            // "rsa" -> Royal Surgical Associates
  const qt = nameTokens(typed), nt = nameTokens(name);
  if (qt.length && qt.every((t) => nt.some((w) => w.startsWith(t)))) return 84;
  // Substring only at a word boundary, and never for one or two letters — otherwise "lt"
  // matches the middle of "Fort Walton".
  if (q.length >= 3 && n.includes(" " + q)) return 76;
  const sim = bigramScore(q, n);                     // typo tolerance: "envidion" -> "envision"
  return sim >= 0.45 ? Math.round(40 + sim * 40) : 0;
}
// Every canonical name already on the site for one kind of entity, with a hospital's location.
function knownNames(type) {
  const field = ENTITY[type].field;
  const map = new Map();
  state.reviews.forEach((r) => {
    const raw = r[field];
    if (!raw) return;
    const name = canonicalName(raw);
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(r);
  });
  return [...map.entries()].map(([name, rows]) => ({
    name,
    count: rows.length,
    sub: type === "hospital" ? commonLocation(rows) : "",
  }));
}
function suggestionsFor(type, typed, limit) {
  return knownNames(type)
    .map((item) => ({ ...item, score: matchScore(typed, item.name) }))
    .filter((item) => item.score > 0 && item.score < 100)   // an exact match needs no suggesting
    .sort((a, b) => b.score - a.score || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit || 6);
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

// "Chattanooga, TN" from whatever parts a review actually has.
function locationLabel(r) {
  const city = (r.hospitalCity || "").trim();
  const st = (r.hospitalState || "").trim();
  if (city && st) return `${city}, ${st}`;
  return city || st || "";
}
// The informational staff answers on one line, e.g. "W-2 · $250k–299k · insurance $401–450/mo · 7 weeks PTO".
function staffFactsLine(r) {
  const parts = [];
  if (r.staffPayType) parts.push(r.staffPayType);
  if (r.staffPayRange) parts.push(r.staffPayRange + "/yr");
  if (r.familyInsurance) parts.push(r.familyInsurance === "Not offered" ? "family insurance not offered" : `family insurance ${r.familyInsurance}/mo`);
  if (r.ptoWeeks) parts.push(`${r.ptoWeeks} PTO`);
  if (r.prnRate) parts.push(`PRN ${r.prnRate}/hr`);
  return parts.join(" · ");
}
// The location most reviewers gave for a hospital (names repeat across cities).
function commonLocation(rows) {
  const tally = {};
  rows.forEach((r) => { const l = locationLabel(r); if (l) tally[l] = (tally[l] || 0) + 1; });
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "";
}

const COLORS = { agency: "#123C3A", agent: "#B87F1E", hospital: "#8C3A32", group: "#3F5E8C" };

// The order search results are grouped in, and the heading over each block.
const SEARCH_SECTIONS = [
  ["hospital", "HOSPITALS"],
  ["group", "ANESTHESIA GROUPS"],
  ["agency", "AGENCIES"],
  ["agent", "AGENTS &amp; RECRUITERS"],
];

// One place that knows, for each rateable thing, which review fields hold its data.
const ENTITY = {
  agency:   { label: "Agency",           field: "agencyName",   ratings: "agencyAgentRatings", comment: "agencyAgentComment", notes: "agencyAgentNotes", ret: "agencyAgentWouldReturn", categories: AGENCY_CATEGORIES,   hasPay: true },
  agent:    { label: "Agent",            field: "agentName",    ratings: "agentRatings",       comment: "agentComment",       notes: "agentNotes",       ret: "agentWouldReturn",       categories: AGENT_CATEGORIES,    hasPay: false },
  group:    { label: "Anesthesia Group", field: "groupName",    ratings: "groupRatings",       comment: "groupComment",       notes: "groupNotes",       ret: "groupWouldReturn",       categories: GROUP_CATEGORIES,    hasPay: false },
  hospital: { label: "Hospital",         field: "hospitalName", ratings: "hospitalRatings",    comment: "hospitalComment",    notes: "hospitalNotes",    ret: "hospitalWouldReturn",    categories: HOSPITAL_CATEGORIES, hasPay: false },
};

// The per-category comments a member wrote, rendered as titled lines under their review —
// each one keeps its category's title and the score it explains, e.g. "Case Mix & Acuity · 2 ★".
function categoryNotesHtml(r, categories, notesField, ratingsField) {
  const ratings = (r && r[ratingsField]) || {};
  const items = categories
    .map((c) => ({ label: c.label, score: ratings[c.key], text: String((((r && r[notesField]) || {})[c.key]) || "").trim() }))
    .filter((n) => n.text);
  if (items.length === 0) return "";
  return `<div class="cat-notes">${items.map((n) => `
    <div class="cat-note">
      <div class="cat-note-head">${esc(n.label)}${n.score > 0 ? ` <span class="cat-note-score">${n.score} ★</span>` : ""}</div>
      <div class="cat-note-body">${esc(n.text)}</div>
    </div>`).join("")}</div>`;
}
const EMPLOYMENT = {
  locum: { label: "Locum / 1099 contractor", short: "Locum", reviews: "agencies, agents, and hospitals" },
  staff: { label: "Full-time / part-time staff", short: "Staff", reviews: "anesthesia groups and hospitals" },
};

// Pay shown for a review: the bracket if one was chosen, else a legacy dollar figure.
function payLabel(r) {
  if (r.payRange) return r.payRange + "/hr";
  if (r.payRate != null) return "$" + r.payRate + "/hr";
  return "";
}
function weighted(categories, values) {
  let sum = 0, weightSum = 0;
  categories.forEach((c) => {
    const v = values && values[c.key];
    if (v > 0) { sum += v * c.weight; weightSum += c.weight; }
  });
  return weightSum > 0 ? sum / weightSum : 0;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function starsHtml(value, size, id) {
  let h = `<div class="stars"${id ? ` id="${id}"` : ""}>`;
  for (let n = 1; n <= 5; n++) {
    h += `<span class="star${n <= value ? " filled" : ""}" style="font-size:${size}px">★</span>`;
  }
  return h + "</div>";
}
function returnBadge(value) {
  if (!value) return "";
  const cls = value === "Y" ? "y" : value === "N" ? "n" : "maybe";
  const label = value === "Y" ? "Would return" : value === "N" ? "Would not return" : "Maybe";
  return `<span class="badge ${cls}">${label.toUpperCase()}</span>`;
}

// ---------- API client ----------

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON response, fine for some routes */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---------- state ----------

const state = {
  adminOpenId: null,   // which member row is expanded
  adminFilter: "",     // name/email filter in the member list
  adminConfirmId: null, // member row showing the delete confirmation
  adminNotes: {},      // id -> last action message shown on that row
  view: "loading", // loading | home | gate | setpw | app | admin | terms
  returnView: "home", // where the Terms page sends you back to
  user: null,
  reviews: [],
  tab: "search",
  query: "",
  detail: null,
  toast: "",
  gateMode: "signin", // signin | request | link
  adminUnlocked: false,
  adminRequests: [],
  aliases: {},        // normalized spelling -> canonical name (admin-approved merges)
  adminNames: null,   // { agency: [...], agent: [...], group: [...], hospital: [...] }
  adminAliases: [],   // rows from name_aliases, for the "merged names" list
  adminIgnores: [],   // pairs the admin marked as not the same
  adminMergeNote: "",
  adminTab: "members",       // members | names
  adminNameType: "hospital", // which directory tab is open
  adminNameFilter: "",
  adminPicked: [],    // names ticked in the directory, for a multi-way merge
  adminKeep: "",      // which of the ticked names survives
  // --- admin: reviews ---
  adminReviews: null,        // every review, newest first (admin sees the author)
  adminReviewFilter: "",
  adminMemberReviews: {},    // member id -> their reviews, loaded when the row is opened
  adminMemberReviewsOpen: null,
  adminMemberFeedback: {},   // member id -> their beta feedback submissions, loaded when the row is opened
  adminMemberFeedbackOpen: null,
  // --- admin: member email ---
  emailPane: "compose",      // compose | templates | sent
  emailTemplates: null,      // rows from email_templates
  emailTokens: [],           // merge tokens the server supports
  emailRecipients: null,     // approved members, with opt-out + review counts
  emailPicked: [],           // ids ticked for this send
  emailRecipientFilter: "",
  emailSubject: "",
  emailBody: "",
  emailTemplateName: "",     // which template the draft came from (recorded on the campaign)
  emailTemplateId: "",       // keeps the picker showing that template after a repaint
  emailEditing: null,        // { id, name, category, subject, body } being edited in the CMS
  emailPreview: null,        // rendered HTML of the draft for one member
  emailNote: "",
  emailConfirming: false,
  emailCampaigns: [],
  emailProgress: null,       // the campaign currently being polled
  emailOpenCampaign: null,   // campaign id expanded in the Sent list
  emailCampaignDetail: null,
  editingId: null, // id of the member's own review being edited in the Post a review form
};

// `notes` holds the small per-category comment boxes: { categoryKey: "what they wrote" }.
const aaForm = { agencyName: "", agentName: "", payRange: "", ratings: {}, notes: {}, wouldReturn: "", comment: "" };
const agtForm = { ratings: {}, notes: {}, wouldReturn: "", comment: "" };
const grpForm = { name: "", payType: "", payRange: "", familyInsurance: "", ptoWeeks: "", prnRate: "", ratings: {}, notes: {}, wouldReturn: "", comment: "" };
const hospForm = { name: "", city: "", state: "", ratings: {}, notes: {}, wouldReturn: "", comment: "" };
const postOpts = { anonymous: false };
const FORMS = { aa: { form: aaForm, categories: AGENCY_CATEGORIES }, agt: { form: agtForm, categories: AGENT_CATEGORIES }, grp: { form: grpForm, categories: GROUP_CATEGORIES }, hosp: { form: hospForm, categories: HOSPITAL_CATEGORIES } };
function resetForms() {
  AGENCY_CATEGORIES.forEach((c) => { aaForm.ratings[c.key] = 0; aaForm.notes[c.key] = ""; });
  AGENT_CATEGORIES.forEach((c) => { agtForm.ratings[c.key] = 0; agtForm.notes[c.key] = ""; });
  agtForm.wouldReturn = ""; agtForm.comment = "";
  GROUP_CATEGORIES.forEach((c) => { grpForm.ratings[c.key] = 0; grpForm.notes[c.key] = ""; });
  HOSPITAL_CATEGORIES.forEach((c) => { hospForm.ratings[c.key] = 0; hospForm.notes[c.key] = ""; });
  aaForm.agencyName = ""; aaForm.agentName = ""; aaForm.payRange = ""; aaForm.wouldReturn = ""; aaForm.comment = "";
  grpForm.name = ""; grpForm.wouldReturn = ""; grpForm.comment = "";
  grpForm.payType = ""; grpForm.payRange = ""; grpForm.familyInsurance = ""; grpForm.ptoWeeks = ""; grpForm.prnRate = "";
  hospForm.name = ""; hospForm.city = ""; hospForm.state = ""; hospForm.wouldReturn = ""; hospForm.comment = "";
  postOpts.anonymous = false;
}
resetForms();

// Which review form to show: while editing, follow the review's own type; otherwise the member's setting.
function formMode() {
  if (state.editingId) {
    const r = state.reviews.find((x) => x.id === state.editingId);
    if (r) return r.employmentType === "staff" ? "staff" : "locum";
  }
  return state.user && state.user.employmentType === "staff" ? "staff" : "locum";
}

function loadReviewIntoForms(r) {
  resetForms();
  aaForm.agencyName = r.agencyName || ""; aaForm.agentName = r.agentName || "";
  aaForm.payRange = r.payRange || "";
  AGENCY_CATEGORIES.forEach((c) => { aaForm.ratings[c.key] = (r.agencyAgentRatings || {})[c.key] || 0; aaForm.notes[c.key] = (r.agencyAgentNotes || {})[c.key] || ""; });
  aaForm.wouldReturn = r.agencyAgentWouldReturn || ""; aaForm.comment = r.agencyAgentComment || "";
  AGENT_CATEGORIES.forEach((c) => { agtForm.ratings[c.key] = (r.agentRatings || {})[c.key] || 0; agtForm.notes[c.key] = (r.agentNotes || {})[c.key] || ""; });
  agtForm.wouldReturn = r.agentWouldReturn || ""; agtForm.comment = r.agentComment || "";
  grpForm.name = r.groupName || "";
  grpForm.payType = r.staffPayType || ""; grpForm.payRange = r.staffPayRange || "";
  grpForm.familyInsurance = r.familyInsurance || ""; grpForm.ptoWeeks = r.ptoWeeks || "";
  grpForm.prnRate = r.prnRate || "";
  GROUP_CATEGORIES.forEach((c) => { grpForm.ratings[c.key] = (r.groupRatings || {})[c.key] || 0; grpForm.notes[c.key] = (r.groupNotes || {})[c.key] || ""; });
  grpForm.wouldReturn = r.groupWouldReturn || ""; grpForm.comment = r.groupComment || "";
  hospForm.name = r.hospitalName || "";
  hospForm.city = r.hospitalCity || ""; hospForm.state = r.hospitalState || "";
  HOSPITAL_CATEGORIES.forEach((c) => { hospForm.ratings[c.key] = (r.hospitalRatings || {})[c.key] || 0; hospForm.notes[c.key] = (r.hospitalNotes || {})[c.key] || ""; });
  hospForm.wouldReturn = r.hospitalWouldReturn || ""; hospForm.comment = r.hospitalComment || "";
  postOpts.anonymous = !!r.anonymous;
}

function startEditing(id) {
  const r = state.reviews.find((x) => x.id === id);
  if (!r || !r.isMine) return;
  loadReviewIntoForms(r);
  state.editingId = id;
  state.detail = null;
  state.tab = "submit";
  render();
  window.scrollTo(0, 0);
}

function cancelEditing() {
  state.editingId = null;
  resetForms();
  state.tab = "mine";
  render();
}

function flash(msg) {
  state.toast = msg;
  render();
  setTimeout(() => { state.toast = ""; renderToast(); }, 2400);
}

const root = document.getElementById("app");

// ---------- init ----------

async function init() {
  try {
    const data = await api("/api/me");
    state.user = data.user;
    const params = new URLSearchParams(window.location.search);
    const cameFromLink = params.get("setpw") === "1";
    if (cameFromLink) window.history.replaceState({}, "", "/");
    state.view = cameFromLink || !state.user.hasPassword ? "setpw" : nextViewAfterAuth();
    await loadReviews();
  } catch {
    state.view = "home";
  }
  render();
}

// Members pick how they're working (locum vs. staff) once; it decides which review form they get.
function nextViewAfterAuth() {
  return state.user && state.user.employmentType ? "app" : "employment";
}

async function loadReviews() {
  // Merges have to be in hand before any name is rendered, or the same company
  // would show up twice for a moment.
  try {
    const alias = await api("/api/aliases");
    state.aliases = {};
    (alias.aliases || []).forEach((a) => (state.aliases[a.alias_norm] = a.canonical));
  } catch { /* merges are an enhancement — the built-in rules still apply */ }
  const data = await api("/api/reviews");
  state.reviews = data.reviews;
}

// ---------- computed helpers ----------

function typeLabel(t) { return ENTITY[t] ? ENTITY[t].label : t; }

function searchResults() {
  const q = state.query.trim().toLowerCase();
  const types = Object.keys(ENTITY);
  const byType = {};
  types.forEach((t) => (byType[t] = new Map()));
  state.reviews.forEach((r) => {
    types.forEach((t) => {
      const raw = r[ENTITY[t].field];
      if (!raw) return;
      const name = canonicalName(raw); // "LT.com" and "Locum Tenens" land on the same page
      byType[t].set(name, (byType[t].get(name) || []).concat(r));
    });
  });
  const items = [];
  types.forEach((type) => {
    byType[type].forEach((rows, name) => {
      if (q && !name.toLowerCase().includes(q)) return;
      const cats = ENTITY[type].categories;
      const scores = rows.map((r) => weighted(cats, r[ENTITY[type].ratings])).filter((v) => v > 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      items.push({ type, name, count: scores.length, total: rows.length, avg, location: type === "hospital" ? commonLocation(rows) : "" });
    });
  });
  items.sort((a, b) => (b.count - a.count) || (b.avg - a.avg) || a.name.localeCompare(b.name));
  return items;
}

function myReviews() {
  if (!state.user) return [];
  return state.reviews
    .filter((r) => r.isMine)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- render ----------

function render() {
  if (state.view === "loading") { root.innerHTML = `<div class="body"><p>Loading the chart room…</p></div>`; return; }
  if (state.view === "home") { root.innerHTML = headerHtml(true) + toastHtml() + landingHtml() + footerHtml(); attachFooterHandlers(); attachLandingHandlers(); return; }
  if (state.view === "gate") { root.innerHTML = headerHtml() + toastHtml() + gateHtml() + footerHtml(); attachFooterHandlers(); attachGateHandlers(); return; }
  if (state.view === "setpw") { root.innerHTML = headerHtml() + toastHtml() + `<div class="body">${setPasswordHtml()}</div>` + footerHtml(); attachFooterHandlers(); attachSetPasswordHandlers(); return; }
  if (state.view === "employment") { root.innerHTML = headerHtml() + toastHtml() + `<div class="body">${employmentHtml()}</div>` + footerHtml(); attachFooterHandlers(); attachEmploymentHandlers(); return; }
  if (state.view === "admin") { root.innerHTML = headerHtml() + toastHtml() + `<div class="body" id="admin-root"></div>` + footerHtml(); attachFooterHandlers(); renderAdmin(); return; }
  if (state.view === "terms") { root.innerHTML = headerHtml() + toastHtml() + `<div class="body">${termsPageHtml()}</div>` + footerHtml(); attachFooterHandlers(); attachTermsPageHandlers(); return; }
  root.innerHTML = headerHtml() + toastHtml() + navHtml() + `<div class="body" id="tab-root"></div>` + footerHtml();
  attachFooterHandlers();
  attachNavHandlers();
  renderTab();
}

function renderToast() {
  const el = document.getElementById("toast-slot");
  if (el) el.outerHTML = toastHtml();
}
function toastHtml() {
  return `<div id="toast-slot">${state.toast ? `<div class="toast">${esc(state.toast)}</div>` : ""}</div>`;
}

function headerHtml(compact) {
  return `
    <div class="header${compact ? " header-compact" : ""}">
      <div class="header-tab">CASE FILE</div>
      <h1 class="h1">CRNA Critics</h1>
      ${compact ? "" : `<p class="tagline">Know before you sign. Rate the agency & agent, the pay, and the hospital — separately, honestly.</p>`}
    </div>`;
}

function footerHtml() {
  return `
    <div class="footer">
      <div>Built by CRNAs, for CRNAs. No hospital, agency, or agent can pay to remove a review.</div>
      <button type="button" class="inline-link" id="terms-link-btn" style="margin-top:8px">Terms of Use &amp; Member Agreement</button>
      <button type="button" class="admin-link" id="admin-link-btn">Site admin</button>
    </div>`;
}
function attachFooterHandlers() {
  document.getElementById("admin-link-btn").onclick = () => {
    state.view = state.view === "admin" ? (state.user ? "app" : "home") : "admin";
    render();
  };
  const termsBtn = document.getElementById("terms-link-btn");
  if (termsBtn) termsBtn.onclick = () => { openTerms(); };
}

// ---------- terms ----------

function termsDocHtml() {
  const t = window.CRNA_TERMS;
  if (!t) return `<p class="hint-text">The terms could not be loaded. Refresh the page before continuing.</p>`;
  return t.html;
}
function openTerms() {
  if (state.view !== "terms") state.returnView = state.view;
  state.view = "terms";
  render();
  window.scrollTo(0, 0);
}
function termsPageHtml() {
  const t = window.CRNA_TERMS || {};
  return `
    <button class="back-btn" id="terms-back-btn" style="margin-bottom:10px">&larr; Back</button>
    <div class="card">
      <div class="section-label">${esc((t.title || "TERMS OF USE & MEMBER AGREEMENT").toUpperCase())}</div>
      <div class="terms-doc">${termsDocHtml()}</div>
    </div>`;
}
function attachTermsPageHandlers() {
  document.getElementById("terms-back-btn").onclick = () => {
    state.view = state.returnView === "terms" ? "home" : state.returnView || "home";
    render();
  };
}

function navHtml() {
  const items = [["search", "Search"], ["submit", "Post a review"], ["mine", "My reviews"], ["signout", "Sign out"]];
  return `<div class="nav">${items
    .map(([key, label]) => `<button class="nav-btn${state.tab === key ? " active" : ""}" data-tab="${key}">${label}</button>`)
    .join("")}</div>`;
}
function attachNavHandlers() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.onclick = async () => {
      const tab = btn.dataset.tab;
      if (tab === "signout") {
        await api("/api/auth/logout", { method: "POST" });
        state.user = null; state.view = "home"; state.tab = "search"; state.detail = null;
        render();
        return;
      }
      if (tab !== "submit" && state.editingId) { state.editingId = null; resetForms(); }
      state.tab = tab; state.detail = null;
      render();
    };
  });
}

function renderTab() {
  const el = document.getElementById("tab-root");
  if (state.tab === "search") {
    if (state.detail) {
      el.innerHTML = detailHtml();
    } else {
      el.innerHTML = searchHtml();
      attachSearchHandlers();
    }
  } else if (state.tab === "submit") {
    el.innerHTML = submitHtml();
    attachSubmitHandlers();
  } else if (state.tab === "mine") {
    el.innerHTML = mineHtml();
    attachMineHandlers();
  }
}

// ---------- landing / home ----------

function heroArtHtml() {
  return `
  <svg class="hero-art" viewBox="0 0 480 300" role="img" aria-label="A shocked CRNA reading a bad contract rated one star out of five">
    <rect x="0" y="0" width="480" height="300" fill="#123C3A"/>
    <g opacity="0.10">
      <circle cx="420" cy="40" r="90" fill="#E3A73B"/>
      <circle cx="40" cy="270" r="70" fill="#F2F4F1"/>
    </g>

    <!-- body: scrub top -->
    <path d="M78 300 C80 240 100 205 150 190 C200 205 220 240 222 300 Z" fill="#5B8DB8"/>
    <path d="M150 190 L136 208 L150 226 L164 208 Z" fill="#3F6F97"/>
    <!-- arms reaching for the contract -->
    <path d="M205 215 L262 165" stroke="#5B8DB8" stroke-width="24" stroke-linecap="round" fill="none"/>
    <path d="M198 262 L262 240" stroke="#5B8DB8" stroke-width="24" stroke-linecap="round" fill="none"/>
    <!-- stethoscope -->
    <path d="M128 196 Q150 240 172 196" stroke="#2B2B2B" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="150" cy="243" r="8" fill="#B8BDB9" stroke="#2B2B2B" stroke-width="2.5"/>

    <!-- neck + head -->
    <rect x="138" y="158" width="24" height="26" fill="#D9A47C"/>
    <circle cx="150" cy="122" r="46" fill="#E0AC84"/>
    <circle cx="104" cy="126" r="8" fill="#D9A47C"/>
    <circle cx="196" cy="126" r="8" fill="#D9A47C"/>
    <!-- scrub cap -->
    <path d="M104 102 C104 66 128 56 150 56 C172 56 196 66 196 102 C180 94 120 94 104 102 Z" fill="#5B8DB8"/>
    <path d="M104 102 C120 94 180 94 196 102 L196 107 C180 99 120 99 104 107 Z" fill="#3F6F97"/>
    <path d="M194 92 L214 84 L208 100 Z" fill="#3F6F97"/>
    <!-- raised eyebrows -->
    <path d="M119 114 Q132 104 146 113" stroke="#4A2E1E" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M155 113 Q169 104 182 114" stroke="#4A2E1E" stroke-width="4" stroke-linecap="round" fill="none"/>
    <!-- wide eyes -->
    <ellipse cx="133" cy="130" rx="12" ry="14" fill="#FFFFFF" stroke="#4A2E1E" stroke-width="2"/>
    <ellipse cx="168" cy="130" rx="12" ry="14" fill="#FFFFFF" stroke="#4A2E1E" stroke-width="2"/>
    <circle cx="137" cy="132" r="4.5" fill="#2B2B2B"/>
    <circle cx="172" cy="132" r="4.5" fill="#2B2B2B"/>
    <circle cx="138.5" cy="130" r="1.4" fill="#FFFFFF"/>
    <circle cx="173.5" cy="130" r="1.4" fill="#FFFFFF"/>
    <!-- open mouth -->
    <ellipse cx="151" cy="155" rx="10" ry="11" fill="#4A2E1E"/>
    <ellipse cx="151" cy="160" rx="6" ry="4.5" fill="#C9605A"/>
    <!-- sweat drops -->
    <path d="M206 92 C206 84 212 78 212 78 C212 78 218 84 218 92 A6 6 0 0 1 206 92 Z" fill="#9DD6F0"/>
    <path d="M214 120 C214 114 219 109 219 109 C219 109 224 114 224 120 A5 5 0 0 1 214 120 Z" fill="#9DD6F0"/>

    <!-- the contract -->
    <g transform="rotate(-6 340 172)">
      <rect x="258" y="74" width="168" height="200" rx="2" fill="#F7F8F5" stroke="#C9D2C6"/>
      <rect x="258" y="74" width="168" height="7" fill="#8C3A32"/>
      <text x="342" y="104" text-anchor="middle" font-family="'Special Elite', monospace" font-size="14" fill="#123C3A" letter-spacing="1.5">LOCUM CONTRACT</text>
      <rect x="276" y="116" width="132" height="1.5" fill="#C9D2C6"/>
      <text x="276" y="134" font-family="Inter, sans-serif" font-size="9.5" fill="#3C4A45">Guaranteed hours: <tspan font-weight="700" fill="#8C3A32">NONE</tspan></text>
      <text x="276" y="150" font-family="Inter, sans-serif" font-size="9.5" fill="#3C4A45">Rate: <tspan font-weight="700" fill="#8C3A32">$40 below quoted</tspan></text>
      <text x="276" y="166" font-family="Inter, sans-serif" font-size="9.5" fill="#3C4A45">Cancellation: <tspan font-weight="700" fill="#8C3A32">24h, unpaid</tspan></text>
      <rect x="276" y="178" width="120" height="4" rx="1" fill="#D8DDD5"/>
      <rect x="276" y="188" width="96" height="4" rx="1" fill="#D8DDD5"/>
      <text x="276" y="224" font-size="20" fill="#E3A73B">★</text>
      <text x="297" y="224" font-size="20" fill="#D8DDD5">★★★★</text>
      <text x="408" y="224" text-anchor="end" font-family="'Special Elite', monospace" font-size="15" fill="#8C3A32">1 / 5</text>
      <g transform="rotate(-12 350 250)">
        <rect x="300" y="238" width="100" height="26" fill="none" stroke="#8C3A32" stroke-width="2.5"/>
        <text x="350" y="256" text-anchor="middle" font-family="'Special Elite', monospace" font-size="14" fill="#8C3A32" letter-spacing="2">BEWARE</text>
      </g>
    </g>

    <!-- hands gripping the paper -->
    <circle cx="264" cy="163" r="13" fill="#E0AC84"/>
    <circle cx="266" cy="240" r="13" fill="#E0AC84"/>
    <path d="M258 154 L272 152 M256 162 L272 160 M258 170 L271 169" stroke="#D9A47C" stroke-width="2" stroke-linecap="round"/>
    <path d="M260 231 L274 229 M258 239 L274 237 M260 247 L273 246" stroke="#D9A47C" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function landingHtml() {
  return `
  <div class="landing">

    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">VERIFIED CRNAs ONLY</div>
        <h2 class="hero-h">Know who you're signing with — before you sign.</h2>
        <p class="hero-sub">CRNA Critics is an independent review platform built by CRNAs, for CRNAs. Rate the hospitals, anesthesia groups, agencies, and agents you've actually worked with, and read honest accounts from colleagues who were there before you.</p>
        <div class="cta-row">
          <button class="btn btn-amber" data-go="request">First time here? Get verified</button>
          <button class="btn btn-ghost" data-go="signin">Already a member? Sign in</button>
        </div>
        <p class="hero-warning">NO AGENTS, AGENCIES, MDAs, OR AAs ALLOWED.</p>
      </div>
      <img class="hero-art" src="image.jpg" alt="CRNA holding a locum contract full of red flags - CRNA Beware, know before you sign">
    </section>

    <section class="lp-section">
      <div class="lp-label">WHY THIS EXISTS</div>
      <p class="lp-lead">CRNAs have been burned one too many times by misinformation about an assignment, an agency, or an anesthesia group. It is time we kept a permanent, running record of every agent, agency, anesthesia group, and hospital — so what happened to you doesn't happen to the next CRNA.</p>
      <p class="lp-body">That information already exists. It lives in group texts, private Facebook threads, and hallway conversations, and it disappears the moment the conversation ends. CRNA Critics puts it somewhere permanent, searchable, and accountable — so the next CRNA weighing the same offer isn't starting from zero.</p>
    </section>

    <section class="lp-section verify-band">
      <div class="lp-label">HOW WE KEEP IT CREDIBLE</div>
      <h3 class="lp-h">Every account is verified as a practicing CRNA.</h3>
      <p class="lp-body">Reviews are only worth what the reviewer is worth. Before an account can post or read reviews, an administrator verifies the applicant's name and NBCRNA number by hand. Anesthesiologists, AAs, recruiters, agency staff, and facility management are not eligible for accounts — this is a CRNA-only room, and it stays that way.</p>
      <ul class="check-list">
        <li>Name and NBCRNA credential reviewed by an admin before access is granted</li>
        <li>Every review comes from a verified CRNA account — post under your name, or anonymously</li>
        <li>Reviews can't be bought, removed, or edited by the parties being rated</li>
      </ul>
    </section>

    <section class="lp-section">
      <div class="lp-label">WHAT YOU CAN RATE</div>
      <h3 class="lp-h">Full-time staff or locum contractor — rate the job end to end.</h3>
      <p class="lp-body">Tell us how you're working and you get the right review form: staff CRNAs rate their anesthesia group and hospital; locums rate the agency, the agent, and the hospital.</p>
      <div class="feature-grid">
        <div class="feature f-hospital">
          <div class="feature-kicker">HOSPITALS</div>
          <p>Case mix and acuity, staffing and backup, equipment, culture, how the chief and leadership treat you, onboarding, schedule reliability, lunches and breaks, free meals, and practice autonomy.</p>
        </div>
        <div class="feature f-group">
          <div class="feature-kicker">ANESTHESIA GROUPS</div>
          <p>For full-time and part-time staff: compensation and benefits, chief and leadership, scheduling and call burden, staffing and workload, respect for CRNAs, and practice autonomy.</p>
        </div>
        <div class="feature f-agency">
          <div class="feature-kicker">AGENCIES</div>
          <p>Pay and billing accuracy, contract terms, credentialing support, travel and housing logistics, and whether the assignment matched what you were sold — plus the pay range they quoted.</p>
        </div>
        <div class="feature f-agent">
          <div class="feature-kicker">AGENTS &amp; RECRUITERS</div>
          <p>Rated on their own, apart from the agency: trustworthiness (does what they said and what's in the contract actually happen?), responsiveness, whether they advocate for you, follow-through when something goes wrong, and respect for your decision.</p>
        </div>
      </div>
    </section>

    <section class="lp-section">
      <div class="lp-label">HOW IT WORKS</div>
      <ol class="step-list">
        <li><span class="step-n">1</span><div><strong>First time here — get verified.</strong> Submit your name, NBCRNA number, and contact information. An admin reviews it personally.</div></li>
        <li><span class="step-n">2</span><div><strong>Create your password.</strong> Once approved, a one-time email link signs you in to set a password. After that, it's just email and password — no more links.</div></li>
        <li><span class="step-n">3</span><div><strong>Choose how you work, then contribute.</strong> Pick full-time/part-time staff or locum, look up any hospital, group, agency, or agent by name, and post your own rated review of the places you've worked.</div></li>
      </ol>
    </section>

    <section class="beware-band">
      <div class="beware-stamp">CRNA BEWARE</div>
      <h3 class="lp-h" style="color:#F2F4F1">Some places have earned a warning.</h3>
      <p class="beware-body">Fair reviews cut both ways. When a facility chronically understaffs its rooms, when a group treats outside CRNAs as disposable, when an agency quietly cuts a rate after you've relocated, or when an agent misrepresents an assignment to close a contract — colleagues deserve to know before they commit. Low scores and documented patterns surface on a name's profile so a bad actor can't simply start over with the next CRNA who calls.</p>
      <p class="beware-fine">Post what you experienced and can stand behind. Reviews are factual accounts of your own working experience, not personal attacks.</p>
    </section>

    <section class="final-cta">
      <h3 class="lp-h">Make the next contract an informed one.</h3>
      <p class="lp-body" style="max-width:520px">Join a growing record of verified CRNA experience — and add yours to it.</p>
      <div class="cta-row">
        <button class="btn btn-amber" data-go="request">First time here? Get verified</button>
        <button class="btn btn-ghost" data-go="signin">Already a member? Sign in</button>
      </div>
    </section>

  </div>`;
}

function attachLandingHandlers() {
  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.onclick = () => {
      state.gateMode = btn.dataset.go === "request" ? "request" : "signin";
      state.view = "gate";
      render();
      window.scrollTo(0, 0);
    };
  });
}

// ---------- gate (sign in / request access) ----------

function gateHtml() {
  const tabs = `
    <div class="nav">
      <button class="nav-btn${state.gateMode !== "request" ? " active" : ""}" id="gate-signin-tab">Already a member</button>
      <button class="nav-btn${state.gateMode === "request" ? " active" : ""}" id="gate-request-tab">First time here</button>
    </div>`;
  const body = state.gateMode === "request" ? requestFormHtml() : state.gateMode === "link" ? linkFormHtml() : signinFormHtml();
  return tabs + `<div class="body"><button class="back-btn" id="gate-home-btn" style="margin-bottom:10px">&larr; Back to home</button><div id="gate-body">${body}</div></div>`;
}
function signinFormHtml() {
  return `
    <div class="card">
      <div class="section-label">ALREADY A MEMBER — SIGN IN</div>
      <p class="hint-text" style="margin-top:0">Sign in with the email you were verified under and your password.</p>
      <input id="signin-email" type="email" placeholder="Email" autocomplete="email" />
      <input id="signin-password" type="password" style="margin-top:8px" placeholder="Password" autocomplete="current-password" />
      <div id="gate-error" class="error-text"></div>
      <button class="primary-btn" id="signin-submit" style="margin-top:10px">Sign in</button>
      <button type="button" class="link-btn" id="gate-forgot">Forgot your password? Email me a one-time sign-in link</button>
    </div>`;
}
function linkFormHtml() {
  return `
    <div class="card">
      <div class="section-label">ONE-TIME SIGN-IN LINK</div>
      <p class="hint-text" style="margin-top:0">Forgot your password, or never set one? Enter your verified email and we'll send a one-time link. Once you're in, you can create a new password.</p>
      <input id="link-email" type="email" placeholder="Email" autocomplete="email" />
      <div id="gate-error" class="error-text"></div>
      <button class="primary-btn" id="link-submit" style="margin-top:10px">Email me a sign-in link</button>
      <button type="button" class="link-btn" id="gate-back-signin">&larr; Back to password sign-in</button>
    </div>`;
}
function setPasswordHtml() {
  const first = !state.user.hasPassword;
  return `
    <div class="card" style="max-width:480px">
      <div class="section-label">${first ? "CREATE YOUR PASSWORD" : "SET A NEW PASSWORD"}</div>
      <p class="hint-text" style="margin-top:0">${first
        ? `Welcome, ${esc(state.user.name)}. Create a password so you can sign in directly from now on — no more emailed links.`
        : `You signed in with a one-time link. Set a new password now, or keep your current one.`}</p>
      <input id="pw-new" type="password" placeholder="New password (8+ characters)" autocomplete="new-password" />
      <input id="pw-confirm" type="password" style="margin-top:8px" placeholder="Confirm password" autocomplete="new-password" />
      <div id="pw-error" class="error-text"></div>
      <button class="primary-btn" id="pw-submit" style="margin-top:10px">Save password</button>
      ${first ? "" : `<button type="button" class="link-btn" id="pw-skip">Keep my current password</button>`}
    </div>`;
}
function attachSetPasswordHandlers() {
  const submit = async () => {
    const pw = document.getElementById("pw-new").value;
    const confirm = document.getElementById("pw-confirm").value;
    const errEl = document.getElementById("pw-error");
    if (pw.length < 8) { errEl.textContent = "Use at least 8 characters."; return; }
    if (pw !== confirm) { errEl.textContent = "Those passwords don't match."; return; }
    errEl.textContent = "";
    try {
      await api("/api/auth/set-password", { method: "POST", body: { password: pw } });
      state.user.hasPassword = true;
      state.view = nextViewAfterAuth();
      flash("Password saved. You can sign in with it from now on.");
    } catch {
      errEl.textContent = "Couldn't save that password. Try again.";
    }
  };
  document.getElementById("pw-submit").onclick = submit;
  document.getElementById("pw-confirm").onkeydown = (e) => { if (e.key === "Enter") submit(); };
  const skip = document.getElementById("pw-skip");
  if (skip) skip.onclick = () => { state.view = nextViewAfterAuth(); render(); };
}
function employmentHtml() {
  const current = state.user.employmentType;
  const card = (type, title, desc) => `
    <button type="button" class="choice-card${current === type ? " active" : ""}" data-employment="${type}">
      <div class="choice-title">${title}</div>
      <div class="choice-desc">${desc}</div>
    </button>`;
  return `
    <div class="card" style="max-width:560px">
      <div class="section-label">${current ? "CHANGE HOW YOU'RE WORKING" : "HOW ARE YOU WORKING RIGHT NOW?"}</div>
      <p class="hint-text" style="margin-top:0">This decides what you review. You can change it any time from My reviews.</p>
      <div class="choice-grid">
        ${card("staff", "Full-time / part-time staff", "W-2 employee of a hospital or anesthesia group. You'll review the <strong>anesthesia group</strong> and the <strong>hospital</strong>.")}
        ${card("locum", "Locum / 1099 contractor", "Working assignments through an agency. You'll review the <strong>agency</strong>, your <strong>agent</strong>, and the <strong>hospital</strong>.")}
      </div>
      <div id="employment-error" class="error-text"></div>
      ${current ? `<button type="button" class="link-btn" id="employment-cancel">Keep it as ${esc(EMPLOYMENT[current].label)}</button>` : ""}
    </div>`;
}
function attachEmploymentHandlers() {
  document.querySelectorAll("[data-employment]").forEach((btn) => {
    btn.onclick = async () => {
      const type = btn.dataset.employment;
      try {
        await api("/api/auth/employment", { method: "POST", body: { employmentType: type } });
        state.user.employmentType = type;
        resetForms();
        state.view = "app";
        flash(`Set to ${EMPLOYMENT[type].label}. You can review ${EMPLOYMENT[type].reviews}.`);
      } catch {
        document.getElementById("employment-error").textContent = "Couldn't save that. Try again.";
      }
    };
  });
  const cancel = document.getElementById("employment-cancel");
  if (cancel) cancel.onclick = () => { state.view = "app"; render(); };
}
function requestFormHtml() {
  return `
    <div class="card">
      <div class="section-label">FIRST TIME HERE — CRNA VERIFICATION</div>
      <p class="hint-text" style="margin-top:0">CRNA Critics is for practicing CRNAs only — not agencies, recruiters, or anesthesiologists. Submit your info below; an admin reviews it before you get access to reviews.</p>
      <input id="req-name" placeholder="Full name" />
      <input id="req-nbcrna" style="margin-top:8px" placeholder="NBCRNA #" />
      <input id="req-email" style="margin-top:8px" type="email" placeholder="Email" />
      <input id="req-phone" style="margin-top:8px" type="tel" placeholder="Phone number" />
      <label class="checkbox-row"><input type="checkbox" id="req-attest" />
        <span>I attest that I am a currently practicing CRNA — not an anesthesiologist (MD/DO), recruiter, or agency employee.</span>
      </label>

      <div class="section-label" style="margin-top:18px">TERMS OF USE &amp; MEMBER AGREEMENT (v${esc((window.CRNA_TERMS || {}).version || "1.0")})</div>
      <p class="hint-text" style="margin-top:0">You have to accept this before you can request access. Scroll to the bottom — it covers the release of liability, the rule against posting to harm a fellow CRNA, and how we may contact you.</p>
      <div class="terms-box terms-doc" id="terms-scroll">${termsDocHtml()}</div>
      <button type="button" class="inline-link" id="terms-open-full" style="margin-top:6px">Open in a full page / print a copy</button>

      <label class="checkbox-row"><input type="checkbox" id="req-terms" />
        <span><strong>I have read and agree to the Terms of Use &amp; Member Agreement</strong>, including the release of liability and covenant not to sue in Section 8, the indemnification in Section 9, the limitation of liability in Section 11, the arbitration and class-action waiver in Section 14, and the agreement in Section 3 not to post with the intention of harming a fellow CRNA. I agree that CRNA Critics and its affiliates may contact me at the email and phone number I gave above, and I understand my information will never be sold or rented.</span>
      </label>
      <label class="checkbox-row"><input type="checkbox" id="req-sms" />
        <span>Optional: I also consent to automated calls and text messages at that number, including from an autodialer or prerecorded voice. Not required to join. Message and data rates may apply; reply STOP to stop.</span>
      </label>

      <div id="gate-error" class="error-text"></div>
      <button class="primary-btn" id="request-submit" style="margin-top:10px" disabled>Agree &amp; submit for verification</button>
    </div>`;
}
function attachGateHandlers() {
  document.getElementById("gate-home-btn").onclick = () => { state.view = "home"; render(); };
  document.getElementById("gate-signin-tab").onclick = () => { state.gateMode = "signin"; render(); };
  document.getElementById("gate-request-tab").onclick = () => { state.gateMode = "request"; render(); };

  if (state.gateMode === "signin") {
    document.getElementById("gate-forgot").onclick = () => { state.gateMode = "link"; render(); };
    const signin = async () => {
      const email = document.getElementById("signin-email").value.trim();
      const password = document.getElementById("signin-password").value;
      const errEl = document.getElementById("gate-error");
      if (!email || !password) { errEl.textContent = "Enter your email and password."; return; }
      errEl.textContent = "";
      try {
        await api("/api/auth/login", { method: "POST", body: { email, password } });
        state.gateMode = "signin";
        await init();
      } catch (e) {
        const code = e.data && e.data.error;
        if (code === "no_password") errEl.textContent = "This account doesn't have a password yet. Use the one-time link option below to sign in and create one.";
        else if (code === "pending") errEl.textContent = "Your verification is still pending review.";
        else if (code === "rejected") errEl.textContent = "This account wasn't approved. Contact the admin if you think that's a mistake.";
        else if (code === "not_found") errEl.textContent = "No account found with that email. Use the 'First time here' tab to get verified.";
        else if (code === "locked") errEl.textContent = "Too many attempts. Wait 15 minutes, or use the one-time link option below.";
        else errEl.textContent = "Email or password didn't match.";
      }
    };
    document.getElementById("signin-submit").onclick = signin;
    document.getElementById("signin-password").onkeydown = (e) => { if (e.key === "Enter") signin(); };
  } else if (state.gateMode === "link") {
    document.getElementById("gate-back-signin").onclick = () => { state.gateMode = "signin"; render(); };
    document.getElementById("link-submit").onclick = async () => {
      const email = document.getElementById("link-email").value.trim();
      const errEl = document.getElementById("gate-error");
      if (!email) { errEl.textContent = "Enter your email."; return; }
      try {
        const data = await api("/api/auth/request-link", { method: "POST", body: { email } });
        if (data.ok) {
          document.getElementById("gate-body").innerHTML = `<div class="empty-box"><p style="margin:0;font-weight:700">Check your email.</p><p class="hint-text">We sent a sign-in link to ${esc(email)}. It expires in 48 hours.</p></div>`;
        } else if (data.reason === "pending") {
          errEl.textContent = "Your verification is still pending review.";
        } else if (data.reason === "rejected") {
          errEl.textContent = "This account wasn't approved. Contact the admin if you think that's a mistake.";
        } else {
          errEl.textContent = "No account found with that email. Use the 'First time here' tab to get verified.";
        }
      } catch (e) {
        errEl.textContent = "Something went wrong. Try again.";
      }
    };
  } else {
    const attestBox = document.getElementById("req-attest");
    const termsBox = document.getElementById("req-terms");
    const submitBtn = document.getElementById("request-submit");
    const syncSubmit = () => { submitBtn.disabled = !(attestBox.checked && termsBox.checked); };
    attestBox.onchange = syncSubmit;
    termsBox.onchange = syncSubmit;
    syncSubmit();
    document.getElementById("terms-open-full").onclick = () => { openTerms(); };

    submitBtn.onclick = async () => {
      const name = document.getElementById("req-name").value.trim();
      const nbcrnaNumber = document.getElementById("req-nbcrna").value.trim();
      const email = document.getElementById("req-email").value.trim();
      const phone = document.getElementById("req-phone").value.trim();
      const attest = attestBox.checked;
      const acceptedTerms = termsBox.checked;
      const smsConsent = document.getElementById("req-sms").checked;
      const termsVersion = (window.CRNA_TERMS || {}).version || "";
      const errEl = document.getElementById("gate-error");
      if (!name || !nbcrnaNumber || !email || !phone) { errEl.textContent = "Fill in every field — this is how we verify you're a practicing CRNA."; return; }
      if (!attest) { errEl.textContent = "Please confirm the attestation above."; return; }
      if (!acceptedTerms) { errEl.textContent = "You have to accept the Terms of Use & Member Agreement to request access."; return; }
      errEl.textContent = "";
      try {
        await api("/api/request-access", { method: "POST", body: { name, nbcrnaNumber, email, phone, acceptedTerms, termsVersion, smsConsent } });
        document.getElementById("gate-body").innerHTML = `<div class="empty-box"><p style="margin:0;font-weight:700">Submitted.</p><p class="hint-text">An admin reviews every NBCRNA number by hand. You'll get an email once you're approved.</p></div>`;
      } catch (e) {
        errEl.textContent = "Something went wrong saving your request. Try again.";
      }
    };
  }
}

// ---------- search ----------

function searchHtml() {
  const results = searchResults();
  return `
    <input class="search-input" id="search-box" placeholder="Search a hospital, anesthesia group, agency, or agent…" value="${esc(state.query)}" />
    <div id="search-results">${searchResultsHtml(results)}</div>`;
}
function searchResultsHtml(results) {
  if (state.reviews.length === 0) {
    return `<div class="empty-box"><p style="margin:0;font-weight:700">No cases on file yet.</p><p class="hint-text">Be the first to post a review — it'll show up here for the next CRNA weighing an offer.</p></div>`;
  }
  if (results.length === 0) {
    return `<div class="empty-box"><p style="margin:0">Nothing matches "${esc(state.query)}" yet. If you've worked with them, post the first review.</p></div>`;
  }
  const intro = `<p class="hint-text" style="margin:0 0 12px">Every review of a name is combined into one score, and different spellings of the same company are merged. Tap a name to see the cumulative score for each category, what each star means, and every individual review behind the average.</p>`;
  const cardHtml = (item) => `
    <button class="card clickable border-${item.type}${isBeware(item.avg) ? " beware-card" : ""}" data-open="${item.type}::${esc(item.name)}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div>
          <div style="font-family:'Special Elite',monospace;font-size:18px">${esc(item.name)}</div>
          ${item.location ? `<div style="font-size:12px;color:#6B756F;margin-top:2px">${esc(item.location)}</div>` : ""}
          ${isBeware(item.avg) ? bewareStampHtml("sm") : ""}
        </div>
        ${item.count > 0
          ? `<div style="text-align:right;flex-shrink:0">
               ${starsHtml(Math.round(item.avg), 13)}
               <div style="font-size:15px;font-weight:800;margin-top:2px;white-space:nowrap"><span style="font-size:22px">${item.avg.toFixed(1)}</span> out of 5.0</div>
               <div style="font-size:11px;color:#6B756F">averaged from ${item.count} review${item.count !== 1 ? "s" : ""}</div>
             </div>`
          : `<div style="font-size:11px;color:#6B756F;flex-shrink:0">no ratings yet${item.total ? ` · ${item.total} review${item.total !== 1 ? "s" : ""} on file` : ""}</div>`}
      </div>
    </button>`;
  // One section per kind, in a fixed order, so hospitals aren't shuffled in with recruiters.
  const sections = SEARCH_SECTIONS.map(([type, heading]) => {
    const group = results.filter((r) => r.type === type);
    if (group.length === 0) return "";
    return `
      <div class="result-group">
        <div class="result-head" style="border-color:${COLORS[type]}">
          <span style="color:${COLORS[type]}">${heading}</span>
          <span class="result-count">${group.length}</span>
        </div>
        ${group.map(cardHtml).join("")}
      </div>`;
  }).join("");
  return intro + sections;
}
function attachSearchHandlers() {
  const box = document.getElementById("search-box");
  box.oninput = () => {
    state.query = box.value;
    document.getElementById("search-results").innerHTML = searchResultsHtml(searchResults());
    attachResultClickHandlers();
  };
  attachResultClickHandlers();
}
function attachResultClickHandlers() {
  document.querySelectorAll("[data-open]").forEach((btn) => {
    btn.onclick = () => {
      const [type, name] = btn.dataset.open.split("::");
      state.detail = { type, name };
      renderTab();
    };
  });
}

// ---------- detail ----------

function detailHtml() {
  const { type, name } = state.detail;
  const ent = ENTITY[type];
  const isHospital = type === "hospital";
  const rows = state.reviews.filter((r) => r[ent.field] && canonicalName(r[ent.field]) === name).sort((a, b) => b.date.localeCompare(a.date));
  const otherSpellings = spellingsFor(rows, ent.field, name);
  const categories = ent.categories;
  const scores = rows.map((r) => weighted(categories, r[ent.ratings])).filter((v) => v > 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  // Pay: most common bracket quoted (agencies only).
  let paySummary = "";
  if (ent.hasPay) {
    const tally = {};
    rows.forEach((r) => { const l = payLabel(r); if (l) tally[l] = (tally[l] || 0) + 1; });
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    if (top) paySummary = `pay quoted: ${top[0]}${top[1] > 1 ? ` (${top[1]} of ${rows.length})` : ""}`;
  }
  // Most-reported answer for an informational field, e.g. "$250k–299k (2 of 3)".
  const mostCommon = (field) => {
    const tally = {};
    rows.forEach((r) => { const v = r[field]; if (v) tally[v] = (tally[v] || 0) + 1; });
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]}${top[1] > 1 ? ` (${top[1]} of ${rows.length})` : ""}` : "";
  };
  const groupFacts = type !== "group" ? [] : [
    ["Paid as", mostCommon("staffPayType")],
    ["Annual pay", mostCommon("staffPayRange")],
    ["Family insurance / mo", mostCommon("familyInsurance")],
    ["Vacation / PTO", mostCommon("ptoWeeks")],
    ["PRN / extra shift rate", mostCommon("prnRate")],
  ].filter(([, v]) => v);
  const groupFactsHtml = groupFacts.length === 0 ? "" : `
    <div class="card" style="margin-top:0">
      <div class="section-label">WHAT CRNAs REPORT HERE</div>
      <table class="stats-table">
        ${groupFacts.map(([k, v]) => `<tr><td class="stats-label">${esc(k)}</td><td style="text-align:right;font-weight:700">${esc(v)}</td></tr>`).join("")}
      </table>
      <p class="hint-text">Reported by members, not scored — these never affect the rating.</p>
    </div>`;
  const locLabel = type === "hospital" ? commonLocation(rows) : "";

  const rowsHtml = rows.map((r) => {
    const ratings = r[ent.ratings] || {};
    const comment = r[ent.comment];
    const wouldReturn = r[ent.ret];
    const pairedLabel = type === "agency" && r.agentName ? `Agent: ${esc(r.agentName)}` :
      type === "agent" && r.agencyName ? `Agency: ${esc(r.agencyName)}` :
      type === "group" && r.hospitalName ? `Hospital: ${esc(r.hospitalName)}` :
      type === "hospital" && r.groupName ? `Anesthesia group: ${esc(r.groupName)}` : "";
    const roleLabel = r.employmentType && EMPLOYMENT[r.employmentType] ? EMPLOYMENT[r.employmentType].short : "";
    const isMine = !!r.isMine;
    const chips = categories.map((c) => `<span class="chip">${esc(c.label.split(" ")[0])} ${ratings[c.key] > 0 ? ratings[c.key] : "–"}</span>`).join("");
    const rowScore = weighted(categories, ratings);
    return `
      <div class="card${isBeware(rowScore) ? " beware-card" : ""}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:800;font-size:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">${rowScore > 0 ? `<span>${rowScore.toFixed(1)} <span style="font-size:12px;font-weight:600;color:#6B756F">out of 5.0</span></span>${isBeware(rowScore) ? bewareStampHtml("sm") : ""}` : `<span style="font-size:12px;font-weight:500;color:#6B756F">not rated on these categories (older review)</span>`}</span>
          <span style="font-size:12px;color:#6B756F">${new Date(r.date).toLocaleDateString()}${r.editedAt ? ` · <span title="Edited ${new Date(r.editedAt).toLocaleDateString()}">edited</span>` : ""}</span>
        </div>
        ${pairedLabel ? `<div style="font-size:12px;color:#6B756F;margin-bottom:4px">${pairedLabel}</div>` : ""}
        ${type === "hospital" && locationLabel(r) ? `<div style="font-size:12px;color:#6B756F;margin-bottom:4px">Location: ${esc(locationLabel(r))}</div>` : ""}
        ${type === "group" && staffFactsLine(r) ? `<div style="font-size:12px;color:#6B756F;margin-bottom:4px">${esc(staffFactsLine(r))}</div>` : ""}
        ${ent.hasPay && payLabel(r) ? `<div style="font-size:12px;color:#6B756F;margin-bottom:4px">Pay quoted: ${esc(payLabel(r))}</div>` : ""}
        <div style="margin:6px 0">${chips}</div>
        <div style="margin:4px 0">${returnBadge(wouldReturn)}</div>
        ${categoryNotesHtml(r, categories, ent.notes, ent.ratings)}
        ${comment ? `<p style="margin:6px 0">${esc(comment)}</p>` : ""}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <p style="margin:0;font-size:12px;color:#6B756F">— ${r.anonymous ? `Anonymous CRNA${isMine ? ` (you)` : ""}` : esc(r.reviewer.name || "Verified CRNA")}, ${esc(r.reviewer.credentials)}${roleLabel ? ` · ${roleLabel}` : ""}${r.anonymous ? ` · <span title="Posted anonymously by a verified CRNA">🔒 anonymous</span>` : ""}</p>
          ${isMine ? `<span style="display:flex;gap:6px"><button class="tiny-btn" data-edit="${r.id}">Edit</button><span data-delete="${r.id}"><button class="tiny-btn">Delete</button></span></span>` : ""}
        </div>
      </div>`;
  }).join("");

  // Running totals: cumulative average per category across every review on file for this name.
  const categoryStats = categories.map((c) => {
    const vals = rows.map((r) => (r[ent.ratings] || {})[c.key]).filter((v) => v > 0);
    const catAvg = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
    return { label: c.label, n: vals.length, avg: catAvg, anchors: c.anchors };
  });
  const returnField = ent.ret;
  const returnTally = { Y: 0, Maybe: 0, N: 0 };
  rows.forEach((r) => { if (r[returnField] in returnTally) returnTally[r[returnField]] += 1; });
  const statsHtml = rows.length === 0 ? "" : `
    <div class="card" style="margin-top:0">
      <div class="section-label">CATEGORY AVERAGES · ${rows.length} REVIEW${rows.length !== 1 ? "S" : ""}</div>
      <p class="hint-text" style="margin-top:0">Each score below is the average across every review on file. The line under each one spells out what reviewers were told a 5, a 3, and a 1 mean for that category.</p>
      <div class="stat-rows">
        ${categoryStats.map((st) => `
          <div class="stat-row">
            <div class="stat-head">
              <span class="stat-label">${esc(st.label)}</span>
              <span class="stat-stars">${st.avg != null ? starsHtml(Math.round(st.avg), 13) : ""}</span>
              <span class="stat-avg">${st.avg != null ? `${st.avg.toFixed(1)} <span class="stat-of">of 5.0</span>` : "—"}</span>
              <span class="stat-n">${st.n > 0 ? `n=${st.n}` : "no data"}</span>
            </div>
            <ul class="anchor-list stat-anchors">
              ${st.anchors.map(([s, t]) => `<li><span class="score">${s} ★ —</span><span>${esc(t)}</span></li>`).join("")}
            </ul>
          </div>`).join("")}
      </div>
      <div class="stats-return">
        <span>Would ${isHospital ? "work here" : "work with them"} again:</span>
        <span class="badge y">${returnTally.Y} YES</span>
        <span class="badge maybe">${returnTally.Maybe} MAYBE</span>
        <span class="badge n">${returnTally.N} NO</span>
      </div>
    </div>`;

  return `
    <button class="back-btn" id="detail-back">&larr; Back to search</button>
    <div class="card border-${type}${isBeware(avg) ? " beware-card" : ""}" style="margin-top:10px">
      <div style="font-size:11px;letter-spacing:0.3px;color:${COLORS[type]};font-weight:700">${typeLabel(type).toUpperCase()}</div>
      <div style="font-family:'Special Elite',monospace;font-size:24px;margin:4px 0">${esc(name)}</div>
      ${locLabel ? `<div style="font-size:13px;color:#6B756F;margin-bottom:4px">${esc(locLabel)}</div>` : ""}
      ${otherSpellings.length ? `<div style="font-size:12px;color:#6B756F;margin-bottom:4px">Also posted as: ${esc(otherSpellings.join(" · "))}</div>` : ""}
      ${scores.length > 0
        ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${starsHtml(Math.round(avg), 18)}<span style="font-weight:800;font-size:18px">${avg.toFixed(1)} out of 5.0</span>${isBeware(avg) ? bewareStampHtml("lg") : ""}<span style="color:#6B756F;font-size:13px">overall · averaged from ${scores.length} rated review${scores.length !== 1 ? "s" : ""}</span>${paySummary ? `<span style="color:#6B756F;font-size:13px">· ${esc(paySummary)}</span>` : ""}</div>${isBeware(avg) ? `<p class="beware-note">This overall score is ${BEWARE_AT}.0 or lower. Read every review below before you sign anything.</p>` : ""}`
        : `<div style="color:#6B756F;font-size:13px">No reviews yet.</div>`}
    </div>
    ${groupFactsHtml}
    ${statsHtml}
    <div class="section-label" style="margin:14px 0 8px">INDIVIDUAL REVIEWS · ALL ${rows.length} BEHIND THIS SCORE</div>
    ${rowsHtml}`;
}

// ---------- submit ----------

function categoryRowHtml(cat, group) {
  const val = FORMS[group].form.ratings[cat.key];
  const anchors = cat.anchors.map(([s, t]) => `<li><span class="score">${s} —</span><span>${esc(t)}</span></li>`).join("");
  return `
    <div class="category-row">
      <div class="category-head"><span class="label">${esc(cat.label)}</span><span class="weight">wt ${Math.round(cat.weight * 100)}%</span></div>
      <div id="stars-${group}-${cat.key}" style="margin:4px 0">${starsInteractiveHtml(val, group, cat.key)}</div>
      <ul class="anchor-list">${anchors}</ul>
      <textarea class="cat-comment" rows="2" data-note="${group}::${cat.key}"
        placeholder="Optional — say more about ${esc(cat.label)}">${esc(FORMS[group].form.notes[cat.key] || "")}</textarea>
    </div>`;
}
// The small comment box under every category writes straight into the form's notes map.
function bindCategoryNotes() {
  document.querySelectorAll("[data-note]").forEach((box) => {
    const [group, key] = box.dataset.note.split("::");
    box.oninput = () => { FORMS[group].form.notes[key] = box.value; };
  });
}
function starsInteractiveHtml(value, group, key) {
  let h = "";
  for (let n = 1; n <= 5; n++) {
    h += `<button type="button" class="star${n <= value ? " filled" : ""}" data-rate="${group}::${key}::${n}">★</button>`;
  }
  return `<div class="stars">${h}</div>`;
}
function returnToggleHtml(value, group) {
  const opts = [["Y", "Would return"], ["Maybe", "Maybe"], ["N", "Would not"]];
  return `<div class="return-toggle" id="return-${group}">${opts.map(([v, label]) =>
    `<button type="button" class="return-btn${value === v ? " active" : ""}" data-return="${group}::${v}">${label}</button>`).join("")}</div>`;
}

// A row of one-of-N buttons for the informational (never scored) staff fields.
// `key` names the property on grpForm; clicking the active choice again clears it.
function choiceRowHtml(key, label, hint, options, value) {
  return `
    <div style="margin-top:14px">
      <div style="font-size:13px;font-weight:600;margin-bottom:4px">${esc(label)}</div>
      <div class="pay-grid" data-choice-row="${key}">${options
        .map((o) => `<button type="button" class="return-btn${value === o ? " active" : ""}" data-choice="${key}::${esc(o)}">${esc(o)}</button>`)
        .join("")}</div>
      ${hint ? `<div class="hint-text">${esc(hint)}</div>` : ""}
    </div>`;
}
function bindChoiceRows() {
  document.querySelectorAll("[data-choice]").forEach((btn) => {
    btn.onclick = () => {
      const [key, val] = btn.dataset.choice.split("::");
      grpForm[key] = grpForm[key] === val ? "" : val; // click again to clear
      document.querySelectorAll(`[data-choice-row="${key}"] [data-choice]`).forEach((b) => {
        b.classList.toggle("active", b.dataset.choice.split("::")[1] === grpForm[key]);
      });
    };
  });
}

// A name input that suggests names already on the site. `key` is only used to build element ids.
function suggestInputHtml(id, type, placeholder, value) {
  return `
    <div class="suggest-wrap" data-suggest="${id}" data-type="${type}">
      <input id="${id}" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off" />
      <div class="suggest-list" id="${id}-list" hidden></div>
      <div class="suggest-hint" id="${id}-hint" hidden></div>
    </div>`;
}

// Wires one suggest input. onPick(name) writes the chosen name into the form model.
function attachSuggest(id, type, onPick) {
  const input = document.getElementById(id);
  if (!input) return;
  const list = document.getElementById(id + "-list");
  const hint = document.getElementById(id + "-hint");
  let items = [];
  let active = -1;

  const close = () => { list.hidden = true; list.innerHTML = ""; items = []; active = -1; };
  const paint = () => {
    list.innerHTML = items.map((it, i) => `
      <button type="button" class="suggest-item${i === active ? " active" : ""}" data-pick="${i}">
        <span class="suggest-name">${esc(it.name)}</span>
        ${it.sub ? `<span class="suggest-sub">${esc(it.sub)}</span>` : ""}
        <span class="suggest-n">${it.count} review${it.count !== 1 ? "s" : ""}</span>
      </button>`).join("");
    list.hidden = items.length === 0;
    // mousedown, not click: the input's blur would tear the list down before a click landed.
    list.querySelectorAll("[data-pick]").forEach((btn) => {
      btn.onmousedown = (e) => { e.preventDefault(); choose(items[Number(btn.dataset.pick)].name); };
    });
  };
  const choose = (name) => {
    input.value = name;
    onPick(name);
    hint.hidden = true;
    close();
  };
  const refresh = () => {
    hint.hidden = true;
    items = input.value.trim().length >= 2 ? suggestionsFor(type, input.value, 6) : [];
    active = -1;
    paint();
  };

  input.addEventListener("input", refresh);
  input.addEventListener("focus", refresh);
  input.addEventListener("keydown", (e) => {
    if (list.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : items.length - 1) + (active < 0 && e.key === "ArrowUp" ? 1 : 0)) % items.length;
      paint();
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(items[active].name);
    } else if (e.key === "Escape") {
      close();
    }
  });
  // Moving on without picking: if what they typed is nearly an existing name, say so.
  input.addEventListener("blur", () => {
    close();
    const typed = input.value.trim();
    if (!typed) { hint.hidden = true; return; }
    const known = knownNames(type).map((k) => k.name);
    if (known.some((n) => normalizeName(n) === normalizeName(typed))) { hint.hidden = true; return; }
    const near = suggestionsFor(type, typed, 1)[0];
    // 55 catches a one-letter typo ("Erlangor"); it's only advice, with a button to accept it.
    if (near && near.score >= 55) {
      hint.innerHTML = `Did you mean <strong>${esc(near.name)}</strong>? <button type="button" class="inline-link" data-use-hint>Use it</button>`;
      hint.hidden = false;
      hint.querySelector("[data-use-hint]").onmousedown = (e) => { e.preventDefault(); choose(near.name); };
    } else {
      hint.hidden = true;
    }
  });
}

function submitHtml() {
  const mode = formMode();
  const editing = state.editingId ? state.reviews.find((x) => x.id === state.editingId) : null;
  const editBanner = editing ? `
    <div class="card edit-banner">
      <div class="section-label">EDITING YOUR REVIEW</div>
      <div style="font-size:13px">Originally posted ${new Date(editing.date).toLocaleDateString()}. Change anything below, then save. Other members will see it marked as edited.</div>
      <button type="button" class="tiny-btn" id="cancel-edit" style="margin-top:8px">Cancel editing</button>
    </div>` : "";
  const header = editBanner + `
    <div class="card">
      <div class="section-label">POSTING AS</div>
      <div style="font-family:'Special Elite',monospace;font-size:17px">${esc(state.user.name)}, ${esc(state.user.credentials)}</div>
      <p class="hint-text">Tied to your verified account. You can post under your name or anonymously.</p>
      <p class="hint-text" style="margin-top:6px">Reviewing as <strong>${esc(EMPLOYMENT[mode].label)}</strong> — ${EMPLOYMENT[mode].reviews}.
        ${editing ? "" : `<button type="button" class="inline-link" id="switch-employment">Switch</button>`}</p>
      <label class="checkbox-row anon-row"><input type="checkbox" id="post-anon" ${postOpts.anonymous ? "checked" : ""} />
        <span><strong>Post anonymously.</strong> Your name is hidden from other members and shown as "Anonymous CRNA." The review is still tied to your verified account — nobody can pretend to be a CRNA — and you can delete it any time from My reviews.</span>
      </label>
    </div>`;
  const groupCard = `
    <div class="card border-group" style="margin-bottom:12px">
      <div class="section-label" style="color:${COLORS.group}">ANESTHESIA GROUP</div>
      ${suggestInputHtml("grp-name", "group", "Anesthesia group / practice name", grpForm.name)}
      ${choiceRowHtml("payType", "How are you paid?", "", STAFF_PAY_TYPES, grpForm.payType)}
      ${choiceRowHtml("payRange", "Annual pay range", "Optional. Shown on the group's page as what CRNAs report earning — information, not a score.", STAFF_PAY_RANGES, grpForm.payRange)}
      ${choiceRowHtml("familyInsurance", "Family health insurance — your cost per month", "Optional. What comes out of your check for family coverage.", FAMILY_INSURANCE_RANGES, grpForm.familyInsurance)}
      ${choiceRowHtml("ptoWeeks", "Vacation / PTO per year", "Optional. Total paid weeks off, including any CE time.", PTO_RANGES, grpForm.ptoWeeks)}
      ${choiceRowHtml("prnRate", "PRN / extra shift rate ($/hr)", "Optional. What this group pays per hour for PRN or extra shifts — information, not a score.", PRN_RATES, grpForm.prnRate)}
      <div style="margin-top:14px">${GROUP_CATEGORIES.map((c) => categoryRowHtml(c, "grp")).join("")}</div>
      <div class="score-row"><span style="font-size:12px;color:#6B756F">Weighted score</span><span class="big" id="grp-score">${weighted(GROUP_CATEGORIES, grpForm.ratings).toFixed(2)}</span></div>
      <div style="margin-top:8px">
        <div style="font-size:13px;font-weight:600;margin-bottom:4px">Would you work for this group again?</div>
        ${returnToggleHtml(grpForm.wouldReturn, "grp")}
      </div>
      <textarea id="grp-comment" style="margin-top:10px" rows="3" placeholder="Anything else another CRNA should know about this group?">${esc(grpForm.comment)}</textarea>
    </div>`;
  const agencyCard = `
    <div class="card border-agency" style="margin-bottom:12px">
      <div class="section-label" style="color:${COLORS.agency}">AGENCY</div>
      ${suggestInputHtml("aa-agency", "agency", "Agency name", aaForm.agencyName)}
      <div style="margin-top:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:4px">Pay range quoted ($/hr)</div>
        <div class="pay-grid" id="pay-grid">${PAY_RANGES.map((pr) => `<button type="button" class="return-btn${aaForm.payRange === pr ? " active" : ""}" data-pay="${esc(pr)}">${esc(pr)}</button>`).join("")}</div>
        <div class="hint-text">Optional. Shown on the agency's page as the range CRNAs are being quoted — it's information, not a score.</div>
      </div>
      <div style="margin-top:14px">${AGENCY_CATEGORIES.map((c) => categoryRowHtml(c, "aa")).join("")}</div>
      <div class="score-row"><span style="font-size:12px;color:#6B756F">Weighted score</span><span class="big" id="aa-score">${weighted(AGENCY_CATEGORIES, aaForm.ratings).toFixed(2)}</span></div>
      <div style="margin-top:8px">
        <div style="font-size:13px;font-weight:600;margin-bottom:4px">Would you work with them again?</div>
        ${returnToggleHtml(aaForm.wouldReturn, "aa")}
      </div>
      <textarea id="aa-comment" style="margin-top:10px" rows="3" placeholder="Anything else another CRNA should know about this agency?">${esc(aaForm.comment)}</textarea>
    </div>
    <div class="card border-agent" style="margin-bottom:12px">
      <div class="section-label" style="color:${COLORS.agent}">YOUR AGENT / RECRUITER</div>
      <p class="hint-text" style="margin-top:0">Agents are rated on their own, separate from the agency — not all agents are created equal. Leave the name blank to skip this section.</p>
      ${suggestInputHtml("aa-agent", "agent", "Agent / recruiter name", aaForm.agentName)}
      <div style="margin-top:14px">${AGENT_CATEGORIES.map((c) => categoryRowHtml(c, "agt")).join("")}</div>
      <div class="score-row"><span style="font-size:12px;color:#6B756F">Weighted score</span><span class="big" id="agt-score">${weighted(AGENT_CATEGORIES, agtForm.ratings).toFixed(2)}</span></div>
      <div style="margin-top:8px">
        <div style="font-size:13px;font-weight:600;margin-bottom:4px">Would you use this agent again?</div>
        ${returnToggleHtml(agtForm.wouldReturn, "agt")}
      </div>
      <textarea id="agt-comment" style="margin-top:10px" rows="2" placeholder="Anything else another CRNA should know about this agent?">${esc(agtForm.comment)}</textarea>
    </div>`;
  const hospitalCard = `
    <div class="card border-hospital" style="margin-bottom:12px">
      <div class="section-label" style="color:${COLORS.hospital}">HOSPITAL</div>
      ${suggestInputHtml("hosp-name", "hospital", "Hospital / facility name", hospForm.name)}
      <div style="font-size:13px;font-weight:600;margin:12px 0 4px">Hospital location</div>
      <div class="loc-row">
        <input id="hosp-city" placeholder="City" value="${esc(hospForm.city)}" />
        <select id="hosp-state">
          <option value="">State</option>
          ${US_STATES.map((s) => `<option value="${s}"${hospForm.state === s ? " selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="hint-text">The same hospital name shows up in a dozen states — the city and state tell the next CRNA which one this is.</div>
      <div style="margin-top:14px">${HOSPITAL_CATEGORIES.map((c) => categoryRowHtml(c, "hosp")).join("")}</div>
      <div class="score-row"><span style="font-size:12px;color:#6B756F">Weighted score</span><span class="big" id="hosp-score">${weighted(HOSPITAL_CATEGORIES, hospForm.ratings).toFixed(2)}</span></div>
      <div style="margin-top:8px">
        <div style="font-size:13px;font-weight:600;margin-bottom:4px">Would you work here again?</div>
        ${returnToggleHtml(hospForm.wouldReturn, "hosp")}
      </div>
      <textarea id="hosp-comment" style="margin-top:10px" rows="3" placeholder="Anything else another CRNA should know about this hospital?">${esc(hospForm.comment)}</textarea>
    </div>`;
  return header + (mode === "staff" ? groupCard : agencyCard) + hospitalCard + `
    <div id="submit-error" class="error-text"></div>
    <button class="primary-btn" id="submit-btn">${editing ? "Save changes" : "Post review"}</button>
    ${editing ? `<button type="button" class="link-btn" id="cancel-edit-bottom">Cancel — keep the original</button>` : ""}`;
}

function attachSubmitHandlers() {
  const mode = formMode();
  const first = mode === "staff" ? "grp" : "aa";
  const editingId = state.editingId;
  const sw = document.getElementById("switch-employment");
  if (sw) sw.onclick = () => { state.view = "employment"; render(); };
  ["cancel-edit", "cancel-edit-bottom"].forEach((id) => { const el = document.getElementById(id); if (el) el.onclick = cancelEditing; });
  document.getElementById("post-anon").onchange = (e) => (postOpts.anonymous = e.target.checked);
  if (mode === "locum") {
    document.getElementById("aa-agency").oninput = (e) => (aaForm.agencyName = e.target.value);
    document.getElementById("aa-agent").oninput = (e) => (aaForm.agentName = e.target.value);
    attachSuggest("aa-agency", "agency", (n) => (aaForm.agencyName = n));
    attachSuggest("aa-agent", "agent", (n) => (aaForm.agentName = n));
    document.getElementById("aa-comment").oninput = (e) => (aaForm.comment = e.target.value);
    document.getElementById("agt-comment").oninput = (e) => (agtForm.comment = e.target.value);
    const bindPay = () => document.querySelectorAll("#pay-grid [data-pay]").forEach((btn) => {
      btn.onclick = () => {
        aaForm.payRange = aaForm.payRange === btn.dataset.pay ? "" : btn.dataset.pay; // click again to clear
        document.querySelectorAll("#pay-grid [data-pay]").forEach((b) => b.classList.toggle("active", b.dataset.pay === aaForm.payRange));
      };
    });
    bindPay();
    AGENT_CATEGORIES.forEach((c) => attachSubmitHandlers.rebindStars("agt", c.key));
    rebindReturnToggle("agt");
  } else {
    document.getElementById("grp-name").oninput = (e) => (grpForm.name = e.target.value);
    document.getElementById("grp-comment").oninput = (e) => (grpForm.comment = e.target.value);
    attachSuggest("grp-name", "group", (n) => (grpForm.name = n));
    bindChoiceRows();
  }
  document.getElementById("hosp-name").oninput = (e) => (hospForm.name = e.target.value);
  attachSuggest("hosp-name", "hospital", (n) => (hospForm.name = n));
  document.getElementById("hosp-city").oninput = (e) => (hospForm.city = e.target.value);
  document.getElementById("hosp-state").onchange = (e) => (hospForm.state = e.target.value);
  document.getElementById("hosp-comment").oninput = (e) => (hospForm.comment = e.target.value);

  [first, "hosp"].forEach((group) => {
    FORMS[group].categories.forEach((c) => attachSubmitHandlers.rebindStars(group, c.key));
    rebindReturnToggle(group);
  });
  bindCategoryNotes();

  document.getElementById("submit-btn").onclick = async () => {
    const errEl = document.getElementById("submit-error");
    const firstName = mode === "staff" ? grpForm.name : aaForm.agencyName;
    if (!firstName.trim() || !hospForm.name.trim()) {
      errEl.textContent = mode === "staff" ? "An anesthesia group name and a hospital name are required." : "An agency name and a hospital name are required.";
      return;
    }
    const firstRated = FORMS[first].categories.every((c) => FORMS[first].form.ratings[c.key] > 0);
    const hospRated = HOSPITAL_CATEGORIES.every((c) => hospForm.ratings[c.key] > 0);
    if (!firstRated || !hospRated) { errEl.textContent = "Give a star rating for every category in each section."; return; }
    const hasAgent = mode === "locum" && aaForm.agentName.trim();
    if (hasAgent && !AGENT_CATEGORIES.every((c) => agtForm.ratings[c.key] > 0)) {
      errEl.textContent = "You named an agent — rate every agent category too, or clear the agent name to skip it."; return;
    }
    errEl.textContent = "";
    const body = {
      employmentType: mode,
      anonymous: postOpts.anonymous,
      hospitalName: hospForm.name.trim(),
      hospitalCity: hospForm.city.trim(),
      hospitalState: hospForm.state,
      hospitalRatings: hospForm.ratings,
      hospitalNotes: hospForm.notes,
      hospitalWouldReturn: hospForm.wouldReturn,
      hospitalComment: hospForm.comment.trim(),
    };
    if (mode === "staff") {
      Object.assign(body, {
        groupName: grpForm.name.trim(), groupRatings: grpForm.ratings, groupNotes: grpForm.notes,
        groupWouldReturn: grpForm.wouldReturn, groupComment: grpForm.comment.trim(),
        staffPayType: grpForm.payType, staffPayRange: grpForm.payRange,
        familyInsurance: grpForm.familyInsurance, ptoWeeks: grpForm.ptoWeeks,
        prnRate: grpForm.prnRate,
      });
    } else {
      Object.assign(body, {
        agencyName: aaForm.agencyName.trim(), agentName: aaForm.agentName.trim(),
        payRange: aaForm.payRange, payRate: null,
        agencyAgentRatings: aaForm.ratings, agencyAgentNotes: aaForm.notes,
        agencyAgentWouldReturn: aaForm.wouldReturn, agencyAgentComment: aaForm.comment.trim(),
        agentRatings: hasAgent ? agtForm.ratings : {}, agentNotes: hasAgent ? agtForm.notes : {},
        agentWouldReturn: hasAgent ? agtForm.wouldReturn : "", agentComment: hasAgent ? agtForm.comment.trim() : "",
      });
    }
    try {
      if (editingId) await api(`/api/reviews/${editingId}`, { method: "PUT", body });
      else await api("/api/reviews", { method: "POST", body });
      const wasAnon = postOpts.anonymous;
      await loadReviews();
      resetForms();
      state.editingId = null;
      state.tab = editingId ? "mine" : "search";
      flash(editingId ? "Review updated." : wasAnon ? "Review posted anonymously." : "Review posted.");
      render();
    } catch (e) {
      errEl.textContent = editingId ? "Something went wrong saving your changes. Try again." : "Something went wrong posting your review. Try again.";
    }
  };
}
// simple rebind helpers so newly-replaced DOM nodes keep working
function rebindReturnToggle(group) {
  document.querySelectorAll(`#return-${group} [data-return]`).forEach((btn) => {
    btn.onclick = () => {
      const [g, v] = btn.dataset.return.split("::");
      const form = FORMS[g].form;
      form.wouldReturn = v;
      document.getElementById(`return-${g}`).outerHTML = returnToggleHtml(v, g);
      rebindReturnToggle(g);
    };
  });
}
attachSubmitHandlers.rebindStars = function (group, key) {
  document.querySelectorAll(`#stars-${group}-${key} [data-rate]`).forEach((btn) => {
    btn.onclick = () => {
      const [g, k, n] = btn.dataset.rate.split("::");
      const form = FORMS[g].form;
      form.ratings[k] = Number(n);
      document.getElementById(`stars-${g}-${k}`).innerHTML = starsInteractiveHtml(form.ratings[k], g, k);
      attachSubmitHandlers.rebindStars(g, k);
      document.getElementById(`${g}-score`).textContent = weighted(FORMS[g].categories, form.ratings).toFixed(2);
    };
  });
};

// ---------- my reviews ----------

function mineHtml() {
  const mine = myReviews();
  const account = `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div>
        <div class="section-label" style="margin-bottom:2px">ACCOUNT</div>
        <div style="font-size:13px;color:#6B756F">${esc(state.user.email)}</div>
        <div style="font-size:13px;color:#6B756F">Working as: <strong>${esc(state.user.employmentType && EMPLOYMENT[state.user.employmentType] ? EMPLOYMENT[state.user.employmentType].label : "not set")}</strong></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="tiny-btn" id="change-employment-btn">Change work type</button>
        <button class="tiny-btn" id="change-pw-btn">Change password</button>
      </div>
    </div>`;
  if (mine.length === 0) {
    return account + `<div class="empty-box"><p style="margin:0">No reviews posted yet under ${esc(state.user.name)}. Head to "Post a review" to file your first case.</p></div>`;
  }
  return account + mine.map((r) => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;color:#6B756F">${new Date(r.date).toLocaleDateString()}${r.editedAt ? " · edited" : ""}${r.anonymous ? ` · <span class="badge anon">🔒 ANONYMOUS</span>` : ""}</span>
        <span style="display:flex;gap:6px"><button class="tiny-btn" data-edit="${r.id}">Edit</button><span data-delete="${r.id}"><button class="tiny-btn">Delete</button></span></span>
      </div>
      ${reviewBodyHtml(r)}
    </div>`).join("");
}

// The scored sections of one review — group / agency / agent / hospital — without any
// header or buttons around them. Shared by "My reviews" and the admin review views so
// the admin sees exactly what the member posted.
function reviewBodyHtml(r) {
  return `
      ${r.groupName ? `
      <div style="margin-bottom:10px;padding-left:10px;border-left:3px solid ${COLORS.group}">
        <div style="font-size:11px;color:${COLORS.group};font-weight:700">ANESTHESIA GROUP: ${esc(r.groupName)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
          ${starsHtml(Math.round(weighted(GROUP_CATEGORIES, r.groupRatings)), 14)}
          <span style="font-size:13px;font-weight:700">${weighted(GROUP_CATEGORIES, r.groupRatings).toFixed(1)} out of 5.0</span>
          ${isBeware(weighted(GROUP_CATEGORIES, r.groupRatings)) ? bewareStampHtml("sm") : ""}
        </div>
        ${staffFactsLine(r) ? `<div style="font-size:12px;color:#6B756F;margin-bottom:4px">${esc(staffFactsLine(r))}</div>` : ""}
        ${returnBadge(r.groupWouldReturn)}
        ${categoryNotesHtml(r, GROUP_CATEGORIES, "groupNotes", "groupRatings")}
        ${r.groupComment ? `<p style="margin:4px 0 0;font-size:13px">${esc(r.groupComment)}</p>` : ""}
      </div>` : ""}
      ${r.agencyName ? `
      <div style="margin-bottom:10px;padding-left:10px;border-left:3px solid ${COLORS.agency}">
        <div style="font-size:11px;color:${COLORS.agency};font-weight:700">AGENCY: ${esc(r.agencyName)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
          ${starsHtml(Math.round(weighted(AGENCY_CATEGORIES, r.agencyAgentRatings)), 14)}
          <span style="font-size:13px;font-weight:700">${weighted(AGENCY_CATEGORIES, r.agencyAgentRatings).toFixed(1)} out of 5.0</span>
          ${isBeware(weighted(AGENCY_CATEGORIES, r.agencyAgentRatings)) ? bewareStampHtml("sm") : ""}
          ${payLabel(r) ? `<span style="font-size:12px;color:#6B756F">· pay quoted ${esc(payLabel(r))}</span>` : ""}
        </div>
        ${returnBadge(r.agencyAgentWouldReturn)}
        ${categoryNotesHtml(r, AGENCY_CATEGORIES, "agencyAgentNotes", "agencyAgentRatings")}
        ${r.agencyAgentComment ? `<p style="margin:4px 0 0;font-size:13px">${esc(r.agencyAgentComment)}</p>` : ""}
      </div>` : ""}
      ${r.agentName ? `
      <div style="margin-bottom:10px;padding-left:10px;border-left:3px solid ${COLORS.agent}">
        <div style="font-size:11px;color:${COLORS.agent};font-weight:700">AGENT: ${esc(r.agentName)}</div>
        ${weighted(AGENT_CATEGORIES, r.agentRatings) > 0 ? `
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
          ${starsHtml(Math.round(weighted(AGENT_CATEGORIES, r.agentRatings)), 14)}
          <span style="font-size:13px;font-weight:700">${weighted(AGENT_CATEGORIES, r.agentRatings).toFixed(1)} out of 5.0</span>
          ${isBeware(weighted(AGENT_CATEGORIES, r.agentRatings)) ? bewareStampHtml("sm") : ""}
        </div>
        ${returnBadge(r.agentWouldReturn)}
        ${categoryNotesHtml(r, AGENT_CATEGORIES, "agentNotes", "agentRatings")}
        ${r.agentComment ? `<p style="margin:4px 0 0;font-size:13px">${esc(r.agentComment)}</p>` : ""}` : `<div class="hint-text" style="margin-top:2px">Not rated separately (posted before agent scorecards). Edit this review to add one.</div>`}
      </div>` : ""}
      <div style="padding-left:10px;border-left:3px solid ${COLORS.hospital}">
        <div style="font-size:11px;color:${COLORS.hospital};font-weight:700">HOSPITAL: ${esc(r.hospitalName)}${locationLabel(r) ? ` — ${esc(locationLabel(r))}` : ""}</div>
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
          ${starsHtml(Math.round(weighted(HOSPITAL_CATEGORIES, r.hospitalRatings)), 14)}
          <span style="font-size:13px;font-weight:700">${weighted(HOSPITAL_CATEGORIES, r.hospitalRatings).toFixed(1)} out of 5.0</span>
          ${isBeware(weighted(HOSPITAL_CATEGORIES, r.hospitalRatings)) ? bewareStampHtml("sm") : ""}
        </div>
        ${returnBadge(r.hospitalWouldReturn)}
        ${categoryNotesHtml(r, HOSPITAL_CATEGORIES, "hospitalNotes", "hospitalRatings")}
        ${r.hospitalComment ? `<p style="margin:4px 0 0;font-size:13px">${esc(r.hospitalComment)}</p>` : ""}
      </div>`;
}
function attachMineHandlers() {
  attachDeleteHandlers();
  document.getElementById("change-pw-btn").onclick = () => { state.view = "setpw"; render(); };
  document.getElementById("change-employment-btn").onclick = () => { state.view = "employment"; render(); };
}

function attachDeleteHandlers() {
  document.querySelectorAll("[data-edit]").forEach((btn) => { btn.onclick = () => startEditing(btn.dataset.edit); });
  document.querySelectorAll("[data-delete]").forEach((wrap) => {
    const id = wrap.dataset.delete;
    const btn = wrap.querySelector("button");
    btn.onclick = () => {
      wrap.innerHTML = `
        <span style="font-size:12px;color:#8C3A32">Delete this review?</span>
        <button class="tiny-btn reject" style="margin-left:6px" id="confirm-del-${id}">Yes, delete</button>
        <button class="tiny-btn" style="margin-left:6px" id="cancel-del-${id}">Cancel</button>`;
      document.getElementById(`confirm-del-${id}`).onclick = async () => {
        try {
          await api(`/api/reviews/${id}`, { method: "DELETE" });
          await loadReviews();
          flash("Review deleted.");
          renderTab();
        } catch { flash("Couldn't delete — try again."); }
      };
      document.getElementById(`cancel-del-${id}`).onclick = () => renderTab();
    };
  });
  document.getElementById("detail-back") && (document.getElementById("detail-back").onclick = () => { state.detail = null; renderTab(); });
}

// patch detail view to wire up back + delete buttons
const _renderTab = renderTab;
renderTab = function () {
  _renderTab();
  if (state.tab === "search" && state.detail) attachDeleteHandlers();
};

// ---------- admin ----------

// Sorting people by last name from a single free-text field: honor "Smith, John"
// if a comma is there, otherwise take the last word that isn't a credential or suffix.
const NAME_TAIL = new Set(["crna", "aprn", "np", "dnp", "dnap", "msn", "bsn", "phd", "mba", "aa", "jr", "sr", "ii", "iii", "iv", "v"]);
function lastNameOf(name) {
  let s = String(name == null ? "" : name).trim();
  if (s.includes(",")) {
    const [head, ...rest] = s.split(",").map((x) => x.trim());
    const tailWords = rest.join(" ").replace(/[.]/g, "").split(/\s+/).filter(Boolean);
    // "Smith, CRNA" is a credential, not a first name — "Smith, John" is.
    const allCredentials = tailWords.length > 0 && tailWords.every((w) => NAME_TAIL.has(w.toLowerCase()));
    if (head && !allCredentials && tailWords.length > 0) return head.toLowerCase();
    s = head;
  }
  const parts = s.replace(/[.]/g, "").split(/\s+/).filter(Boolean);
  while (parts.length > 1 && NAME_TAIL.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  return (parts[parts.length - 1] || "").toLowerCase();
}
function byLastName(a, b) {
  const c = lastNameOf(a.name).localeCompare(lastNameOf(b.name));
  return c !== 0 ? c : String(a.name || "").localeCompare(String(b.name || ""));
}
function adminDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? esc(v) : esc(d.toLocaleDateString());
}
function termsLine(r) {
  return r.terms_accepted_at
    ? `Terms v${esc(r.terms_version || "?")} accepted ${esc(new Date(r.terms_accepted_at).toLocaleString())} · IP ${esc(r.terms_ip || "unknown")}${r.sms_consent ? " · SMS opt-in" : ""}`
    : "No terms acceptance on file (pre-dates the agreement)";
}

// One expandable member row: name + status on the closed row, everything on file
// plus the per-member actions once it's open.
function memberCardHtml(r) {
  const open = state.adminOpenId === r.id;
  const confirming = state.adminConfirmId === r.id;
  const note = state.adminNotes[r.id] || "";
  const statusColor = r.status === "approved" ? "#1F5C57" : "#8C3A32";
  return `
    <div class="card member-card${open ? " open" : ""}">
      <button type="button" class="member-head" data-member="${r.id}">
        <span>
          <span class="member-name">${esc(r.name)}</span>
          <span class="member-sub">${esc(r.email)}</span>
        </span>
        <span style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span style="font-size:10px;font-weight:700;color:${statusColor}">${esc(r.status.toUpperCase())}</span>
          <span class="member-caret">${open ? "▾" : "▸"}</span>
        </span>
      </button>
      ${!open ? "" : `
      <div class="member-body">
        <table class="stats-table">
          <tr><td class="stats-label">Email</td><td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td></tr>
          <tr><td class="stats-label">Phone</td><td>${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : "—"}</td></tr>
          <tr><td class="stats-label">NBCRNA #</td><td>${esc(r.nbcrna_number)}</td></tr>
          <tr><td class="stats-label">Work type</td><td>${r.employment_type ? esc(r.employment_type === "staff" ? "Staff (W-2)" : "Locum (1099)") : "not chosen yet"}</td></tr>
          <tr><td class="stats-label">Password</td><td>${r.hasPassword ? "set by member" : "<em>not set yet</em>"}</td></tr>
          <tr><td class="stats-label">Reviews posted</td><td>${r.reviewCount}</td></tr>
          <tr><td class="stats-label">Feedback form</td><td>${feedbackStatusLabel(r)}</td></tr>
          <tr><td class="stats-label">Mailings</td><td>${r.bulk_unsubscribed ? "<strong>opted out</strong> (account email still sends)" : "subscribed"}</td></tr>
          <tr><td class="stats-label">Requested</td><td>${adminDate(r.requested_at)}</td></tr>
          <tr><td class="stats-label">Decided</td><td>${adminDate(r.decided_at)}</td></tr>
        </table>
        <p class="hint-text" style="font-size:11px">${termsLine(r)}</p>
        <p class="hint-text" style="font-size:11px">Passwords are stored one-way encrypted, so no one — including you — can read a member's password. Use the reset button to let them set a new one.</p>
        ${note ? `<p class="hint-text" style="color:#1F5C57;font-weight:600">${esc(note)}</p>` : ""}
        ${confirming ? `
          <div class="empty-box" style="margin-top:10px;border-color:#8C3A32">
            <p style="margin:0;font-weight:700;font-size:13px">Delete ${esc(r.name)}?</p>
            <p class="hint-text">This can't be undone. They'd have to re-apply and be verified again.</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
              <button class="tiny-btn reject" data-del="${r.id}::0">Delete account, keep reviews</button>
              <button class="tiny-btn reject" data-del="${r.id}::1">Delete account + ${r.reviewCount} review${r.reviewCount === 1 ? "" : "s"}</button>
              <button class="tiny-btn" data-del-cancel="${r.id}">Cancel</button>
            </div>
          </div>` : `
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
            <button class="tiny-btn${state.adminMemberReviewsOpen === r.id ? " active-btn" : ""}" data-member-reviews="${r.id}">${state.adminMemberReviewsOpen === r.id ? "Hide" : "View"} reviews (${r.reviewCount})</button>
            ${r.status === "approved" ? `
              <button class="tiny-btn" data-link="${r.id}::welcome">Resend login link</button>
              <button class="tiny-btn" data-link="${r.id}::reset">Send password reset</button>
              <button class="tiny-btn" data-feedback-send="${r.id}">${r.feedback_sent_at ? "Resend" : "Send"} feedback form</button>
              ${r.feedbackSubmittedAt ? `<button class="tiny-btn${state.adminMemberFeedbackOpen === r.id ? " active-btn" : ""}" data-feedback-view="${r.id}">${state.adminMemberFeedbackOpen === r.id ? "Hide" : "View"} feedback</button>` : ""}
              <button class="tiny-btn" data-unsub="${r.id}::${r.bulk_unsubscribed ? 0 : 1}">${r.bulk_unsubscribed ? "Put back on mailings" : "Opt out of mailings"}</button>` : ""}
            <button class="tiny-btn reject" data-del-start="${r.id}">Delete</button>
          </div>`}
        ${memberReviewsHtml(r)}
        ${memberFeedbackHtml(r)}
      </div>`}
    </div>`;
}

// One-line status for the Feedback form row in a member's stats table.
function feedbackStatusLabel(r) {
  if (r.feedbackSubmittedAt) {
    return `<span style="color:#1F5C57;font-weight:700">✓ complete</span> — ${adminDate(r.feedbackSubmittedAt)}`;
  }
  if (r.feedback_sent_at) {
    return `sent ${adminDate(r.feedback_sent_at)} — awaiting response`;
  }
  return "not sent yet";
}

// ---------- duplicate detection (admin) ----------

// Pairs of names on file that look like the same thing. Uses the same matcher as the
// review-form suggestions, with a higher bar — these become a merge recommendation.
const DUPLICATE_THRESHOLD = 60;
function duplicateCandidates() {
  if (!state.adminNames) return [];
  const ignored = new Set(state.adminIgnores.map((p) => [normalizeName(p.a_name), normalizeName(p.b_name)].sort().join("||")));
  const out = [];
  Object.entries(state.adminNames).forEach(([type, list]) => {
    // Compare canonical names only — already-merged spellings aren't duplicates any more.
    const seen = new Map();
    list.forEach((item) => {
      const name = canonicalName(item.name);
      if (!seen.has(name)) seen.set(name, { name, count: 0, sub: item.sub || "" });
      const e = seen.get(name);
      e.count += item.count;
      if (!e.sub && item.sub) e.sub = item.sub;
    });
    const names = [...seen.values()];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i], b = names[j];
        const key = [normalizeName(a.name), normalizeName(b.name)].sort().join("||");
        if (ignored.has(key)) continue;
        const score = Math.max(matchScore(a.name, b.name), matchScore(b.name, a.name));
        if (score >= DUPLICATE_THRESHOLD) out.push({ type, a, b, score, key });
      }
    }
  });
  return out.sort((x, y) => y.score - x.score);
}

function duplicatesHtml() {
  if (!state.adminNames) return "";
  const pairs = duplicateCandidates();
  const merged = state.adminAliases;
  const mergedHtml = merged.length === 0 ? "" : `
    <div class="card">
      <div class="section-label">MERGED NAMES (${merged.length})</div>
      <table class="stats-table">
        ${merged.map((m) => `
          <tr>
            <td class="stats-label">${esc(m.alias_raw || m.alias_norm)} &rarr; <strong>${esc(m.canonical)}</strong></td>
            <td style="text-align:right"><button class="tiny-btn" data-unmerge="${esc(m.id)}">Undo</button></td>
          </tr>`).join("")}
      </table>
      <p class="hint-text">Undoing puts the reviews back under the spelling they were posted with.</p>
    </div>`;
  const pairsHtml = pairs.length === 0
    ? `<p class="hint-text">Nothing looks like a duplicate right now.</p>`
    : pairs.map((p) => `
      <div class="card border-${p.type}">
        <div style="font-size:11px;letter-spacing:0.3px;color:${COLORS[p.type]};font-weight:700">${typeLabel(p.type).toUpperCase()} · ${p.score}% similar</div>
        <div class="dupe-pair">
          <div class="dupe-side">
            <div class="dupe-name">${esc(p.a.name)}</div>
            <div class="dupe-sub">${esc(p.a.sub || "")}${p.a.sub ? " · " : ""}${p.a.count} review${p.a.count !== 1 ? "s" : ""}</div>
          </div>
          <div class="dupe-side">
            <div class="dupe-name">${esc(p.b.name)}</div>
            <div class="dupe-sub">${esc(p.b.sub || "")}${p.b.sub ? " · " : ""}${p.b.count} review${p.b.count !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="tiny-btn approve" data-merge="${esc(p.b.name)}::${esc(p.a.name)}">Keep &ldquo;${esc(p.a.name)}&rdquo;</button>
          <button class="tiny-btn approve" data-merge="${esc(p.a.name)}::${esc(p.b.name)}">Keep &ldquo;${esc(p.b.name)}&rdquo;</button>
          <button class="tiny-btn" data-not-dupe="${esc(p.a.name)}::${esc(p.b.name)}">Not the same</button>
        </div>
      </div>`).join("");
  return `
    <div class="section-label" style="margin:18px 0 8px">POSSIBLE DUPLICATES (${pairs.length})</div>
    <p class="hint-text" style="margin-top:0">Names that look like the same company. "Keep" files every review under that spelling, everywhere on the site, straight away. "Not the same" retires the suggestion for good.</p>
    ${state.adminMergeNote ? `<p class="hint-text" style="color:#1F5C57"><strong>${esc(state.adminMergeNote)}</strong></p>` : ""}
    ${pairsHtml}
    ${mergedHtml}`;
}

// ---------- the full name directory (admin) ----------

// Every canonical name on file for one type, with its review count and (hospitals) location.
function directoryNames(type) {
  const list = (state.adminNames && state.adminNames[type]) || [];
  const seen = new Map();
  list.forEach((item) => {
    const name = canonicalName(item.name);
    if (!seen.has(name)) seen.set(name, { name, count: 0, sub: "", spellings: [] });
    const e = seen.get(name);
    e.count += item.count;
    if (!e.sub && item.sub) e.sub = item.sub;
    if (item.name !== name && !e.spellings.includes(item.name)) e.spellings.push(item.name);
  });
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function directoryHtml() {
  if (!state.adminNames) return "";
  const q = state.adminNameFilter.trim().toLowerCase();
  const all = directoryNames(state.adminNameType);
  const rows = all.filter((r) => !q || r.name.toLowerCase().includes(q) || (r.sub || "").toLowerCase().includes(q));
  const picked = state.adminPicked;
  const tabs = SEARCH_SECTIONS.map(([type, heading]) => {
    const n = directoryNames(type).length;
    return `<button class="nav-btn${state.adminNameType === type ? " active" : ""}" data-name-type="${type}">${heading} <span style="color:#8A948E">${n}</span></button>`;
  }).join("");
  const mergeBar = picked.length < 2 ? "" : `
    <div class="card merge-bar">
      <div style="font-weight:700;font-size:13px">Merge ${picked.length} names into one</div>
      <div class="hint-text" style="margin-top:2px">Pick the spelling to keep. Every review under the others moves to it, everywhere on the site.</div>
      <select id="merge-keep" style="margin-top:8px">
        ${picked.map((n) => `<option value="${esc(n)}"${state.adminKeep === n ? " selected" : ""}>${esc(n)}</option>`).join("")}
      </select>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="tiny-btn approve" id="merge-go">Merge into the name above</button>
        <button class="tiny-btn" id="merge-clear">Clear selection</button>
      </div>
    </div>`;
  return `
    <div class="section-label" style="margin:18px 0 8px">ALL NAMES ON FILE</div>
    <p class="hint-text" style="margin-top:0">Tick two or more spellings of the same company, then choose which one to keep.</p>
    <div class="nav dir-tabs">${tabs}</div>
    <input id="dir-filter" class="search-input" type="search" style="margin-top:10px" placeholder="Filter these names" value="${esc(state.adminNameFilter)}" />
    ${mergeBar}
    ${rows.length === 0 ? `<p class="hint-text">${q ? "Nothing matches that." : "No names yet."}</p>` : ""}
    <div class="dir-list">
      ${rows.map((r) => `
        <label class="dir-row${picked.includes(r.name) ? " picked" : ""}">
          <input type="checkbox" data-pick-name="${esc(r.name)}"${picked.includes(r.name) ? " checked" : ""} />
          <span class="dir-main">
            <span class="dir-name">${esc(r.name)}</span>
            ${r.sub ? `<span class="dir-sub">${esc(r.sub)}</span>` : ""}
            ${r.spellings.length ? `<span class="dir-sub">merged from: ${esc(r.spellings.join(" · "))}</span>` : ""}
          </span>
          <span class="dir-n">${r.count}</span>
        </label>`).join("")}
    </div>`;
}

function attachDirectoryHandlers() {
  document.querySelectorAll("[data-name-type]").forEach((btn) => {
    btn.onclick = () => {
      state.adminNameType = btn.dataset.nameType;
      state.adminPicked = []; state.adminKeep = ""; state.adminNameFilter = "";
      paintAdmin();
    };
  });
  const filter = document.getElementById("dir-filter");
  if (filter) {
    filter.oninput = () => {
      state.adminNameFilter = filter.value;
      const at = filter.selectionStart;
      paintAdmin();
      const again = document.getElementById("dir-filter");
      if (again) { again.focus(); again.setSelectionRange(at, at); }
    };
  }
  document.querySelectorAll("[data-pick-name]").forEach((box) => {
    box.onchange = () => {
      const name = box.dataset.pickName;
      state.adminPicked = box.checked
        ? state.adminPicked.concat([name])
        : state.adminPicked.filter((n) => n !== name);
      if (!state.adminPicked.includes(state.adminKeep)) state.adminKeep = state.adminPicked[0] || "";
      paintAdmin();
    };
  });
  const keep = document.getElementById("merge-keep");
  if (keep) keep.onchange = () => { state.adminKeep = keep.value; };
  const go = document.getElementById("merge-go");
  if (go) {
    go.onclick = async () => {
      const canonical = (document.getElementById("merge-keep") || {}).value || state.adminKeep;
      const aliases = state.adminPicked.filter((n) => n !== canonical);
      if (!canonical || aliases.length === 0) return;
      go.disabled = true;
      try {
        await api("/api/admin/aliases", { method: "POST", body: { canonical, aliases } });
        state.adminMergeNote = `${aliases.length + 1} names now file under "${canonical}".`;
        state.adminPicked = []; state.adminKeep = "";
        await loadAdminNames();
      } catch {
        state.adminMergeNote = "Couldn't save that merge — try again.";
        paintAdmin();
      }
    };
  }
  const clear = document.getElementById("merge-clear");
  if (clear) clear.onclick = () => { state.adminPicked = []; state.adminKeep = ""; paintAdmin(); };
}

function attachDuplicateHandlers() {
  document.querySelectorAll("[data-merge]").forEach((btn) => {
    btn.onclick = async () => {
      const [alias, canonical] = btn.dataset.merge.split("::");
      btn.disabled = true;
      try {
        await api("/api/admin/aliases", { method: "POST", body: { canonical, aliases: [alias] } });
        state.adminMergeNote = `"${alias}" now files under "${canonical}".`;
        await loadAdminNames();
      } catch {
        state.adminMergeNote = "Couldn't save that merge — try again.";
        paintAdmin();
      }
    };
  });
  document.querySelectorAll("[data-not-dupe]").forEach((btn) => {
    btn.onclick = async () => {
      const [a, b] = btn.dataset.notDupe.split("::");
      btn.disabled = true;
      try {
        await api("/api/admin/name-ignores", { method: "POST", body: { a, b } });
        state.adminMergeNote = `Kept "${a}" and "${b}" separate.`;
        await loadAdminNames();
      } catch { paintAdmin(); }
    };
  });
  document.querySelectorAll("[data-unmerge]").forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await api(`/api/admin/aliases/${btn.dataset.unmerge}`, { method: "DELETE" });
        state.adminMergeNote = "Merge undone.";
        await loadAdminNames();
      } catch { paintAdmin(); }
    };
  });
}

// Pulls the name list + merge state, refreshes the member-facing alias map too,
// so a merge shows up on the search page without a reload.
async function loadAdminNames() {
  try {
    const data = await api("/api/admin/names");
    state.adminNames = data.names;
    state.adminAliases = data.aliases || [];
    state.adminIgnores = data.ignores || [];
    state.aliases = {};
    state.adminAliases.forEach((a) => (state.aliases[a.alias_norm] = a.canonical));
  } catch { state.adminNames = null; }
  paintAdmin();
}

async function renderAdmin() {
  const el = document.getElementById("admin-root");
  if (!state.adminUnlocked) {
    el.innerHTML = `
      <div class="card">
        <div class="section-label">SITE ADMIN</div>
        <input id="admin-passcode" type="password" placeholder="Admin passcode" />
        <div id="admin-error" class="error-text"></div>
        <button class="primary-btn" id="admin-unlock" style="margin-top:10px">Unlock</button>
        <button class="tiny-btn" id="admin-close" style="margin-top:10px">Close</button>
      </div>`;
    document.getElementById("admin-unlock").onclick = async () => {
      const passcode = document.getElementById("admin-passcode").value;
      try {
        await api("/api/admin/login", { method: "POST", body: { passcode } });
        state.adminUnlocked = true;
        renderAdmin();
      } catch {
        document.getElementById("admin-error").textContent = "Incorrect passcode.";
        document.getElementById("admin-passcode").value = "";
      }
    };
    document.getElementById("admin-close").onclick = () => { state.view = state.user ? "app" : "home"; render(); };
    return;
  }
  el.innerHTML = `<p class="hint-text">Loading…</p>`;
  let data;
  try {
    data = await api("/api/admin/requests");
  } catch {
    state.adminUnlocked = false;
    renderAdmin();
    return;
  }
  state.adminRequests = data.requests;
  paintAdmin();
  loadAdminNames(); // second pass — the member list shouldn't wait on the name scan
}

// Draws the dashboard from what's already in state — no fetch — so filtering and
// opening a row stay instant and don't disturb the filter box.
function paintAdmin() {
  const el = document.getElementById("admin-root");
  if (!el) return;
  const pending = state.adminRequests.filter((r) => r.status === "pending");
  const q = state.adminFilter.trim().toLowerCase();
  const members = state.adminRequests
    .filter((r) => r.status !== "pending")
    .filter((r) => !q || `${r.name} ${r.email} ${r.phone || ""} ${r.nbcrna_number || ""}`.toLowerCase().includes(q))
    .sort(byLastName);

  const tab = ["members", "reviews", "email", "names"].includes(state.adminTab) ? state.adminTab : "members";
  const dupeCount = state.adminNames ? duplicateCandidates().length : 0;
  const membersSection = `
    <div class="section-label" style="margin:10px 0">PENDING VERIFICATION (${pending.length})</div>
    ${pending.length === 0 ? `<p class="hint-text">Nothing waiting.</p>` : ""}
    ${pending.map((r) => `
      <div class="card">
        <div style="font-weight:700">${esc(r.name)}</div>
        <div style="font-size:12px;color:#6B756F">NBCRNA ${esc(r.nbcrna_number)}</div>
        <div style="font-size:12px;color:#6B756F">${esc(r.email)} · ${esc(r.phone)}</div>
        <div style="font-size:11px;color:#8A948E;margin-top:4px">${r.terms_accepted_at
          ? `Terms v${esc(r.terms_version || "?")} accepted ${esc(new Date(r.terms_accepted_at).toLocaleString())} · IP ${esc(r.terms_ip || "unknown")}${r.sms_consent ? " · SMS opt-in" : ""}`
          : "No terms acceptance on file (pre-dates the agreement)"}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="tiny-btn approve" data-decide="${r.id}::approved">Approve</button>
          <button class="tiny-btn reject" data-decide="${r.id}::rejected">Reject</button>
        </div>
      </div>`).join("")}
    <div class="section-label" style="margin:14px 0 8px">MEMBERS (${members.length}) &middot; BY LAST NAME</div>
    <input id="admin-filter" class="search-input" type="search" placeholder="Filter by name, email, phone, NBCRNA #" value="${esc(state.adminFilter)}" />
    ${members.length === 0 ? `<p class="hint-text">${q ? "No one matches that." : "None yet."}</p>` : ""}
    ${members.map(memberCardHtml).join("")}`;

  const namesSection = state.adminNames === null
    ? `<p class="hint-text">Reading the names on file…</p>`
    : duplicatesHtml() + directoryHtml();

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <button class="back-btn" id="admin-back-btn">&larr; Close admin</button>
      <button class="tiny-btn" id="admin-refresh">Refresh</button>
    </div>
    <div class="nav admin-tabs">
      <button class="nav-btn${tab === "members" ? " active" : ""}" data-admin-tab="members">Members${pending.length ? ` <span class="tab-badge">${pending.length}</span>` : ""}</button>
      <button class="nav-btn${tab === "reviews" ? " active" : ""}" data-admin-tab="reviews">Reviews${state.adminReviews ? ` <span class="tab-badge">${state.adminReviews.length}</span>` : ""}</button>
      <button class="nav-btn${tab === "email" ? " active" : ""}" data-admin-tab="email">Email</button>
      <button class="nav-btn${tab === "names" ? " active" : ""}" data-admin-tab="names">Names${dupeCount ? ` <span class="tab-badge">${dupeCount}</span>` : ""}</button>
    </div>
    ${tab === "members" ? membersSection : tab === "reviews" ? adminReviewsSection() : tab === "email" ? emailSection() : namesSection}`;

  document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
    btn.onclick = () => {
      state.adminTab = btn.dataset.adminTab;
      state.adminMergeNote = "";
      paintAdmin();
      // Each tab loads its own data the first time it's opened.
      if (state.adminTab === "reviews") loadAdminReviews();
      if (state.adminTab === "email") loadEmailData();
    };
  });

  document.getElementById("admin-back-btn").onclick = () => { state.view = state.user ? "app" : "home"; render(); };
  document.getElementById("admin-refresh").onclick = () => {
    if (state.adminTab === "reviews") loadAdminReviews(true);
    if (state.adminTab === "email") loadEmailData(true);
    renderAdmin();
  };
  attachDuplicateHandlers();
  attachDirectoryHandlers();
  document.querySelectorAll("[data-decide]").forEach((btn) => {
    btn.onclick = async () => {
      const [id, decision] = btn.dataset.decide.split("::");
      await api(`/api/admin/requests/${id}/decide`, { method: "POST", body: { decision } });
      renderAdmin();
    };
  });

  const filterEl = document.getElementById("admin-filter");
  if (filterEl) {
    // Filter without a round trip: the list is already in state.
    filterEl.oninput = () => {
      state.adminFilter = filterEl.value;
      const cursor = filterEl.selectionStart;
      paintAdmin();
      const again = document.getElementById("admin-filter");
      if (again) { again.focus(); again.setSelectionRange(cursor, cursor); }
    };
  }
  attachMemberHandlers();
  attachAdminReviewHandlers();
  attachEmailHandlers();
}


function attachMemberHandlers() {
  document.querySelectorAll("[data-member]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.member;
      const wasOpen = state.adminOpenId === id;
      state.adminOpenId = wasOpen ? null : id;
      if (!wasOpen) state.adminConfirmId = null;
      paintAdmin();
    };
  });
  document.querySelectorAll("[data-link]").forEach((btn) => {
    btn.onclick = async () => {
      const [id, kind] = btn.dataset.link.split("::");
      btn.disabled = true;
      btn.textContent = "Sending…";
      try {
        const out = await api(`/api/admin/requests/${id}/send-link`, { method: "POST", body: { kind } });
        state.adminNotes[id] = `${kind === "reset" ? "Password reset" : "Login link"} sent to ${out.sentTo} — good for 48 hours.`;
      } catch (e) {
        state.adminNotes[id] = `Couldn't send that email (${e.message}). Check the Resend key and try again.`;
      }
      paintAdmin();
    };
  });
  document.querySelectorAll("[data-member-reviews]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.memberReviews;
      const wasOpen = state.adminMemberReviewsOpen === id;
      state.adminMemberReviewsOpen = wasOpen ? null : id;
      paintAdmin();
      if (!wasOpen && !state.adminMemberReviews[id]) loadMemberReviews(id);
    };
  });
  document.querySelectorAll("[data-feedback-send]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.feedbackSend;
      btn.disabled = true;
      btn.textContent = "Sending…";
      try {
        const out = await api(`/api/admin/requests/${id}/send-feedback`, { method: "POST" });
        const row = state.adminRequests.find((x) => x.id === id);
        if (row) row.feedback_sent_at = new Date().toISOString();
        state.adminNotes[id] = `Feedback form sent to ${out.sentTo}.`;
      } catch (e) {
        state.adminNotes[id] = `Couldn't send that email (${e.message}).`;
      }
      paintAdmin();
    };
  });
  document.querySelectorAll("[data-feedback-view]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.feedbackView;
      const wasOpen = state.adminMemberFeedbackOpen === id;
      state.adminMemberFeedbackOpen = wasOpen ? null : id;
      paintAdmin();
      if (!wasOpen && !state.adminMemberFeedback[id]) loadMemberFeedback(id);
    };
  });
  document.querySelectorAll("[data-unsub]").forEach((btn) => {
    btn.onclick = async () => {
      const [id, value] = btn.dataset.unsub.split("::");
      btn.disabled = true;
      try {
        const out = await api(`/api/admin/requests/${id}/unsubscribe`, { method: "POST", body: { unsubscribed: value === "1" } });
        const row = state.adminRequests.find((x) => x.id === id);
        if (row) row.bulk_unsubscribed = out.unsubscribed ? 1 : 0;
        state.adminNotes[id] = out.unsubscribed
          ? "Taken off member mailings. Account email (sign-in links, password resets) still sends."
          : "Back on member mailings.";
        // Keep the Email tab's picker in step without a refetch.
        const rcpt = (state.emailRecipients || []).find((x) => x.id === id);
        if (rcpt) rcpt.unsubscribed = !!out.unsubscribed;
        if (out.unsubscribed) state.emailPicked = state.emailPicked.filter((x) => x !== id);
      } catch (e) {
        state.adminNotes[id] = `Couldn't change that (${e.message}).`;
      }
      paintAdmin();
    };
  });
  document.querySelectorAll("[data-del-start]").forEach((btn) => {
    btn.onclick = () => { state.adminConfirmId = btn.dataset.delStart; paintAdmin(); };
  });
  document.querySelectorAll("[data-del-cancel]").forEach((btn) => {
    btn.onclick = () => { state.adminConfirmId = null; paintAdmin(); };
  });
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      const [id, withReviews] = btn.dataset.del.split("::");
      btn.disabled = true;
      try {
        const out = await api(`/api/admin/requests/${id}?reviews=${withReviews}`, { method: "DELETE" });
        state.adminConfirmId = null;
        state.adminOpenId = null;
        delete state.adminNotes[id];
        flash(`Deleted ${out.name}${out.deletedReviews ? ` and ${out.deletedReviews} review${out.deletedReviews === 1 ? "" : "s"}` : ""}.`);
      } catch (e) {
        state.adminNotes[id] = `Couldn't delete that account (${e.message}).`;
        paintAdmin();
      }
    };
  });
}

// ---------- admin: reviews ----------

async function loadAdminReviews(force) {
  if (state.adminReviews && !force) return;
  try {
    const data = await api("/api/admin/reviews");
    state.adminReviews = data.reviews;
  } catch {
    state.adminReviews = [];
  }
  paintAdmin();
}

// Everything one review mentions, flattened for the filter box.
function reviewHaystack(r) {
  return [
    r.reviewer && r.reviewer.name, r.reviewerEmail, r.hospitalName, r.hospitalCity, r.hospitalState,
    r.agencyName, r.agentName, r.groupName, r.hospitalComment, r.agencyAgentComment, r.agentComment, r.groupComment,
  ].filter(Boolean).join(" ").toLowerCase();
}

// One review as the admin sees it: who wrote it (even when it's posted anonymously),
// how to reach them, and the full scorecard exactly as it appears on the site.
function adminReviewCardHtml(r) {
  return `
    <div class="card">
      <div class="admin-review-head">
        <span>
          <span class="member-name">${esc(r.reviewer ? r.reviewer.name : "Unknown")}</span>
          <span class="member-sub">${r.reviewerEmail ? `<a href="mailto:${esc(r.reviewerEmail)}">${esc(r.reviewerEmail)}</a>` : ""}</span>
        </span>
        <span style="text-align:right;flex-shrink:0">
          <span style="font-size:12px;color:#6B756F">${new Date(r.date).toLocaleDateString()}${r.editedAt ? " · edited" : ""}</span>
          ${r.anonymous ? `<div><span class="badge anon">🔒 POSTED ANONYMOUSLY</span></div>` : ""}
        </span>
      </div>
      ${reviewBodyHtml(r)}
    </div>`;
}

function adminReviewsSection() {
  if (state.adminReviews === null) return `<p class="hint-text">Reading the reviews on file…</p>`;
  const q = state.adminReviewFilter.trim().toLowerCase();
  const rows = state.adminReviews.filter((r) => !q || reviewHaystack(r).includes(q));
  const anon = state.adminReviews.filter((r) => r.anonymous).length;
  return `
    <div class="section-label" style="margin:10px 0 6px">REVIEWS (${state.adminReviews.length}) &middot; NEWEST FIRST</div>
    <p class="hint-text" style="margin-top:0">${anon} posted anonymously — the site hides those names from members, but you see them here.</p>
    <input id="admin-review-filter" class="search-input" type="search" placeholder="Filter by CRNA, hospital, agency, agent, group or comment" value="${esc(state.adminReviewFilter)}" />
    ${rows.length === 0 ? `<p class="hint-text">${q ? "Nothing matches that." : "No reviews posted yet."}</p>` : ""}
    ${rows.map(adminReviewCardHtml).join("")}`;
}

function attachAdminReviewHandlers() {
  const el = document.getElementById("admin-review-filter");
  if (!el) return;
  el.oninput = () => {
    state.adminReviewFilter = el.value;
    const cursor = el.selectionStart;
    paintAdmin();
    const again = document.getElementById("admin-review-filter");
    if (again) { again.focus(); again.setSelectionRange(cursor, cursor); }
  };
}

// The reviews panel that opens inside a member's row on the Members tab.
async function loadMemberReviews(id) {
  try {
    const data = await api(`/api/admin/requests/${id}/reviews`);
    state.adminMemberReviews[id] = data.reviews;
  } catch {
    state.adminMemberReviews[id] = [];
  }
  paintAdmin();
}

function memberReviewsHtml(r) {
  if (state.adminMemberReviewsOpen !== r.id) return "";
  const rows = state.adminMemberReviews[r.id];
  if (!rows) return `<p class="hint-text">Loading their reviews…</p>`;
  if (rows.length === 0) return `<p class="hint-text">${esc(r.name)} hasn't posted a review yet.</p>`;
  return `<div class="member-reviews">${rows.map((rev) => `
    <div class="card" style="margin:8px 0">
      <div style="font-size:12px;color:#6B756F;margin-bottom:6px">${new Date(rev.date).toLocaleDateString()}${rev.editedAt ? " · edited" : ""}${rev.anonymous ? ` · <span class="badge anon">🔒 ANONYMOUS</span>` : ""}</div>
      ${reviewBodyHtml(rev)}
    </div>`).join("")}</div>`;
}

// The beta-feedback panel that opens inside a member's row on the Members tab.
async function loadMemberFeedback(id) {
  try {
    const data = await api(`/api/admin/requests/${id}/feedback`);
    state.adminMemberFeedback[id] = data.submissions;
  } catch {
    state.adminMemberFeedback[id] = [];
  }
  paintAdmin();
}

function memberFeedbackHtml(r) {
  if (state.adminMemberFeedbackOpen !== r.id) return "";
  const rows = state.adminMemberFeedback[r.id];
  if (!rows) return `<p class="hint-text">Loading their feedback…</p>`;
  if (rows.length === 0) return `<p class="hint-text">Nothing submitted yet.</p>`;
  return `<div class="member-reviews">${rows.map((sub) => `
    <div class="card" style="margin:8px 0">
      <div style="font-size:12px;color:#6B756F;margin-bottom:6px">${new Date(sub.submittedAt).toLocaleString()} · ${esc(sub.name)}</div>
      ${sub.answers.map((a) => `
        <div style="font-size:13.5px;margin-bottom:6px"><strong>${esc(a.title)}:</strong> ${esc(a.answer || "(no answer)")}${a.comment ? ` <span style="color:#6B756F;font-style:italic">— "${esc(a.comment)}"</span>` : ""}</div>
      `).join("")}
      ${sub.finalComment ? `<div style="font-size:13.5px;margin-top:8px;padding-top:8px;border-top:1px solid #E1E6EB"><strong>Anything else:</strong> ${esc(sub.finalComment)}</div>` : ""}
    </div>`).join("")}</div>`;
}

// ---------- admin: member email ----------

async function loadEmailData(force) {
  if (state.emailTemplates && !force) return;
  try {
    const [t, r, c] = await Promise.all([
      api("/api/admin/templates"),
      api("/api/admin/email/recipients"),
      api("/api/admin/campaigns"),
    ]);
    state.emailTemplates = t.templates || [];
    state.emailTokens = t.tokens || [];
    state.emailRecipients = r.recipients || [];
    state.emailCampaigns = c.campaigns || [];
  } catch {
    state.emailTemplates = state.emailTemplates || [];
    state.emailRecipients = state.emailRecipients || [];
  }
  paintAdmin();
}

function mailableRecipients() {
  return (state.emailRecipients || []).filter((r) => !r.unsubscribed);
}

function filteredRecipients() {
  const q = state.emailRecipientFilter.trim().toLowerCase();
  return (state.emailRecipients || []).filter(
    (r) => !q || `${r.name} ${r.email}`.toLowerCase().includes(q)
  );
}

function recipientRowHtml(r) {
  const picked = state.emailPicked.includes(r.id);
  const last = r.lastReviewAt ? new Date(r.lastReviewAt).toLocaleDateString() : "never posted";
  return `
    <label class="rcpt-row${r.unsubscribed ? " out" : ""}${picked ? " picked" : ""}">
      <input type="checkbox" data-rcpt="${r.id}" ${picked ? "checked" : ""} ${r.unsubscribed ? "disabled" : ""}/>
      <span class="rcpt-main">
        <span class="rcpt-name">${esc(r.name)}</span>
        <span class="rcpt-sub">${esc(r.email)}</span>
      </span>
      <span class="rcpt-meta">${r.reviewCount} review${r.reviewCount === 1 ? "" : "s"}<br/><span style="color:#8A948E">last: ${esc(last)}</span></span>
      ${r.unsubscribed ? `<span class="badge out-badge">OPTED OUT</span>` : ""}
    </label>`;
}

function composePaneHtml() {
  const recipients = filteredRecipients();
  const picked = state.emailPicked.length;
  const totalMailable = mailableRecipients().length;
  const optedOut = (state.emailRecipients || []).length - totalMailable;
  const templates = state.emailTemplates || [];
  const prog = state.emailProgress;
  const done = prog && prog.status === "done";
  return `
    ${prog ? `
      <div class="card" style="border-color:#1F5C57">
        <div class="section-label">${done ? "SEND COMPLETE" : "SENDING…"}</div>
        <p style="margin:4px 0;font-weight:700">${prog.sent} of ${prog.total} sent${prog.failed ? ` · ${prog.failed} failed` : ""}${prog.skipped ? ` · ${prog.skipped} skipped` : ""}</p>
        <div class="send-bar"><span style="width:${prog.total ? Math.round(((prog.sent + prog.failed + prog.skipped) / prog.total) * 100) : 0}%"></span></div>
        ${prog.last_error ? `<p class="hint-text" style="color:#8C3A32">Last error: ${esc(prog.last_error)}</p>` : ""}
        ${done ? `<button class="tiny-btn" id="email-clear-progress" style="margin-top:8px">Done</button>` : `<p class="hint-text">Leave this tab open — one message goes out every second or so.</p>`}
      </div>` : ""}

    <div class="card">
      <div class="section-label">START FROM A TEMPLATE</div>
      ${templates.length === 0
        ? `<p class="hint-text">No templates yet — build one on the Templates tab.</p>`
        : `<select id="email-template-pick" class="search-input">
             <option value="">— write from scratch —</option>
             ${templates.map((t) => `<option value="${esc(t.id)}"${state.emailTemplateId === t.id ? " selected" : ""}>${esc(t.category ? `${t.category} · ` : "")}${esc(t.name)}</option>`).join("")}
           </select>
           <p class="hint-text">Picking one loads its subject and body below. Edits here don't change the saved template.</p>`}
    </div>

    <div class="card">
      <div class="section-label">MESSAGE</div>
      <input id="email-subject" class="search-input" type="text" placeholder="Subject line" value="${esc(state.emailSubject)}" />
      <textarea id="email-body" rows="14" placeholder="Write the email. Blank lines start new paragraphs.">${esc(state.emailBody)}</textarea>
      <p class="hint-text" style="margin-bottom:4px">These fill in per person:</p>
      <div class="token-list">
        ${(state.emailTokens || []).map((t) => `<button type="button" class="token-chip" data-token="${esc(t.token)}" title="${esc(t.what)}">${esc(t.token)}</button>`).join("")}
      </div>
      <p class="hint-text">Click a token to drop it into the body. An unsubscribe line is added to every mailing automatically.</p>
    </div>

    <div class="card">
      <div class="section-label">RECIPIENTS (${picked} picked of ${totalMailable})</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <button class="tiny-btn" id="rcpt-all">Select all ${totalMailable}</button>
        <button class="tiny-btn" id="rcpt-none">Clear</button>
        <button class="tiny-btn" id="rcpt-noreviews">Only those with no reviews</button>
        <button class="tiny-btn" id="rcpt-shown">Select everyone shown</button>
      </div>
      <input id="rcpt-filter" class="search-input" type="search" placeholder="Filter by name or email" value="${esc(state.emailRecipientFilter)}" />
      ${optedOut ? `<p class="hint-text">${optedOut} member${optedOut === 1 ? " has" : "s have"} opted out of mailings and can't be picked. They still get account email.</p>` : ""}
      <div class="rcpt-list">
        ${recipients.length === 0 ? `<p class="hint-text">No one matches that.</p>` : recipients.map(recipientRowHtml).join("")}
      </div>
    </div>

    ${state.emailNote ? `<p class="hint-text" style="color:#1F5C57;font-weight:600">${esc(state.emailNote)}</p>` : ""}

    <div class="card">
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button class="tiny-btn" id="email-preview-btn">Preview</button>
        ${state.emailConfirming
          ? `<button class="primary-btn" id="email-send-confirm" style="margin:0">Yes — send to ${picked}</button>
             <button class="tiny-btn" id="email-send-cancel">Cancel</button>`
          : `<button class="primary-btn" id="email-send-btn" style="margin:0" ${picked === 0 || !state.emailSubject.trim() || !state.emailBody.trim() ? "disabled" : ""}>Send to ${picked} member${picked === 1 ? "" : "s"}</button>`}
      </div>
      ${state.emailConfirming ? `<p class="hint-text" style="color:#8C3A32;font-weight:600">This sends for real, right now. There's no recall.</p>` : ""}
    </div>

    ${state.emailPreview ? `
      <div class="card">
        <div class="section-label">PREVIEW — AS ${esc(state.emailPreview.to || "a member")} WOULD GET IT</div>
        <p style="margin:4px 0;font-weight:700;font-size:14px">${esc(state.emailPreview.subject)}</p>
        <iframe class="email-preview" srcdoc="${esc(state.emailPreview.html)}"></iframe>
      </div>` : ""}`;
}

function templatesPaneHtml() {
  const list = state.emailTemplates || [];
  const ed = state.emailEditing;
  if (ed) {
    return `
      <div class="card">
        <div class="section-label">${ed.id ? "EDIT TEMPLATE" : "NEW TEMPLATE"}</div>
        <input id="tpl-name" class="search-input" type="text" placeholder="Template name (what you'll see in the list)" value="${esc(ed.name)}" />
        <input id="tpl-category" class="search-input" type="text" placeholder="Category — Feedback, Reminder, Growth…" value="${esc(ed.category)}" />
        <input id="tpl-subject" class="search-input" type="text" placeholder="Subject line" value="${esc(ed.subject)}" />
        <textarea id="tpl-body" rows="16" placeholder="Body. Blank lines start new paragraphs.">${esc(ed.body)}</textarea>
        <div class="token-list">
          ${(state.emailTokens || []).map((t) => `<button type="button" class="token-chip" data-tpl-token="${esc(t.token)}" title="${esc(t.what)}">${esc(t.token)}</button>`).join("")}
        </div>
        <p class="hint-text">${(state.emailTokens || []).map((t) => `${esc(t.token)} — ${esc(t.what)}`).join("<br/>")}</p>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="primary-btn" id="tpl-save" style="margin:0">Save template</button>
          <button class="tiny-btn" id="tpl-cancel">Cancel</button>
        </div>
      </div>`;
  }
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0">
      <div class="section-label" style="margin:0">TEMPLATES (${list.length})</div>
      <button class="tiny-btn" id="tpl-new">+ New template</button>
    </div>
    ${state.emailNote ? `<p class="hint-text" style="color:#1F5C57;font-weight:600">${esc(state.emailNote)}</p>` : ""}
    ${list.length === 0 ? `<p class="hint-text">No templates yet.</p>` : ""}
    ${list.map((t) => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
          <div>
            ${t.category ? `<div style="font-size:11px;font-weight:700;color:#1F5C57">${esc(String(t.category).toUpperCase())}</div>` : ""}
            <div style="font-weight:700">${esc(t.name)}</div>
            <div style="font-size:13px;color:#6B756F">${esc(t.subject)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="tiny-btn" data-tpl-use="${esc(t.id)}">Use</button>
            <button class="tiny-btn" data-tpl-edit="${esc(t.id)}">Edit</button>
            <button class="tiny-btn reject" data-tpl-del="${esc(t.id)}">Delete</button>
          </div>
        </div>
        <p class="tpl-body">${esc(t.body)}</p>
      </div>`).join("")}`;
}

function sentPaneHtml() {
  const list = state.emailCampaigns || [];
  if (list.length === 0) return `<p class="hint-text">Nothing has been sent yet.</p>`;
  return `
    <div class="section-label" style="margin:10px 0">SENT MAILINGS (${list.length})</div>
    ${list.map((c) => {
      const open = state.emailOpenCampaign === c.id;
      const detail = open ? state.emailCampaignDetail : null;
      return `
      <div class="card">
        <button type="button" class="member-head" data-campaign="${esc(c.id)}">
          <span>
            <span class="member-name">${esc(c.subject)}</span>
            <span class="member-sub">${new Date(c.created_at).toLocaleString()}${c.template_name ? ` · ${esc(c.template_name)}` : ""}</span>
          </span>
          <span style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <span style="font-size:11px;font-weight:700;color:${c.failed ? "#8C3A32" : "#1F5C57"}">${c.sent}/${c.total} SENT${c.failed ? ` · ${c.failed} FAILED` : ""}</span>
            <span class="member-caret">${open ? "▾" : "▸"}</span>
          </span>
        </button>
        ${!open ? "" : `
          <div class="member-body">
            ${c.status !== "done" ? `<p class="hint-text">Still sending…</p>` : ""}
            ${c.last_error ? `<p class="hint-text" style="color:#8C3A32">Last error: ${esc(c.last_error)}</p>` : ""}
            ${!detail ? `<p class="hint-text">Loading…</p>` : `
              <table class="stats-table">
                ${detail.recipients.map((r) => `
                  <tr>
                    <td class="stats-label">${esc(r.name || r.email)}<br/><span style="font-weight:400;color:#8A948E">${esc(r.email)}</span></td>
                    <td style="text-align:right;font-size:12px;color:${r.status === "sent" ? "#1F5C57" : r.status === "failed" ? "#8C3A32" : "#6B756F"}">${esc(String(r.status).toUpperCase())}${r.error ? `<br/><span style="color:#8A948E">${esc(r.error)}</span>` : ""}</td>
                  </tr>`).join("")}
              </table>`}
            <p class="tpl-body">${esc(c.body)}</p>
          </div>`}
      </div>`;
    }).join("")}`;
}

function emailSection() {
  if (state.emailTemplates === null) return `<p class="hint-text">Opening the mail room…</p>`;
  const pane = state.emailPane;
  return `
    <div class="nav admin-subtabs">
      <button class="nav-btn${pane === "compose" ? " active" : ""}" data-email-pane="compose">Compose</button>
      <button class="nav-btn${pane === "templates" ? " active" : ""}" data-email-pane="templates">Templates</button>
      <button class="nav-btn${pane === "sent" ? " active" : ""}" data-email-pane="sent">Sent</button>
    </div>
    ${pane === "compose" ? composePaneHtml() : pane === "templates" ? templatesPaneHtml() : sentPaneHtml()}`;
}

// Drops a token in at the cursor of whichever box is open.
function insertAtCursor(el, text, onChange) {
  if (!el) return;
  const start = el.selectionStart == null ? el.value.length : el.selectionStart;
  const end = el.selectionEnd == null ? el.value.length : el.selectionEnd;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  el.focus();
  el.setSelectionRange(start + text.length, start + text.length);
  onChange(el.value);
}

function attachEmailHandlers() {
  document.querySelectorAll("[data-email-pane]").forEach((btn) => {
    btn.onclick = () => {
      state.emailPane = btn.dataset.emailPane;
      state.emailEditing = null;
      state.emailNote = "";
      paintAdmin();
    };
  });

  // --- compose ---
  const pick = document.getElementById("email-template-pick");
  if (pick) {
    pick.onchange = () => {
      const t = (state.emailTemplates || []).find((x) => x.id === pick.value);
      if (t) { state.emailSubject = t.subject; state.emailBody = t.body; state.emailTemplateName = t.name; state.emailTemplateId = t.id; }
      else { state.emailTemplateName = ""; state.emailTemplateId = ""; }
      state.emailPreview = null;
      paintAdmin();
    };
  }
  const subjectEl = document.getElementById("email-subject");
  if (subjectEl) subjectEl.oninput = () => { state.emailSubject = subjectEl.value; };
  const bodyEl = document.getElementById("email-body");
  if (bodyEl) bodyEl.oninput = () => { state.emailBody = bodyEl.value; };
  document.querySelectorAll("[data-token]").forEach((btn) => {
    btn.onclick = () => insertAtCursor(document.getElementById("email-body"), btn.dataset.token, (v) => { state.emailBody = v; });
  });

  const setPicked = (ids) => { state.emailPicked = ids; state.emailConfirming = false; paintAdmin(); };
  const allBtn = document.getElementById("rcpt-all");
  if (allBtn) allBtn.onclick = () => setPicked(mailableRecipients().map((r) => r.id));
  const noneBtn = document.getElementById("rcpt-none");
  if (noneBtn) noneBtn.onclick = () => setPicked([]);
  const noRevBtn = document.getElementById("rcpt-noreviews");
  if (noRevBtn) noRevBtn.onclick = () => setPicked(mailableRecipients().filter((r) => r.reviewCount === 0).map((r) => r.id));
  const shownBtn = document.getElementById("rcpt-shown");
  if (shownBtn) shownBtn.onclick = () => setPicked([...new Set([...state.emailPicked, ...filteredRecipients().filter((r) => !r.unsubscribed).map((r) => r.id)])]);

  document.querySelectorAll("[data-rcpt]").forEach((box) => {
    box.onchange = () => {
      const id = box.dataset.rcpt;
      state.emailPicked = box.checked
        ? [...new Set([...state.emailPicked, id])]
        : state.emailPicked.filter((x) => x !== id);
      state.emailConfirming = false;
      paintAdmin();
    };
  });

  const rcptFilter = document.getElementById("rcpt-filter");
  if (rcptFilter) {
    rcptFilter.oninput = () => {
      state.emailRecipientFilter = rcptFilter.value;
      const cursor = rcptFilter.selectionStart;
      paintAdmin();
      const again = document.getElementById("rcpt-filter");
      if (again) { again.focus(); again.setSelectionRange(cursor, cursor); }
    };
  }

  const previewBtn = document.getElementById("email-preview-btn");
  if (previewBtn) {
    previewBtn.onclick = async () => {
      previewBtn.disabled = true;
      previewBtn.textContent = "Rendering…";
      try {
        state.emailPreview = await api("/api/admin/email/preview", {
          method: "POST",
          body: { subject: state.emailSubject, body: state.emailBody, memberId: state.emailPicked[0] || null },
        });
        state.emailNote = "";
      } catch (e) {
        state.emailNote = `Couldn't render the preview (${e.message}).`;
      }
      paintAdmin();
    };
  }
  const sendBtn = document.getElementById("email-send-btn");
  if (sendBtn) sendBtn.onclick = () => { state.emailConfirming = true; paintAdmin(); };
  const cancelBtn = document.getElementById("email-send-cancel");
  if (cancelBtn) cancelBtn.onclick = () => { state.emailConfirming = false; paintAdmin(); };
  const confirmBtn = document.getElementById("email-send-confirm");
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Starting…";
      try {
        const out = await api("/api/admin/email/send", {
          method: "POST",
          body: {
            subject: state.emailSubject,
            body: state.emailBody,
            templateName: state.emailTemplateName,
            recipientIds: state.emailPicked,
          },
        });
        state.emailConfirming = false;
        state.emailNote = `Sending to ${out.total} member${out.total === 1 ? "" : "s"}.`;
        state.emailProgress = { id: out.campaignId, status: "sending", total: out.total, sent: 0, failed: 0, skipped: 0, last_error: "" };
        paintAdmin();
        pollCampaign(out.campaignId);
      } catch (e) {
        state.emailConfirming = false;
        state.emailNote = e.message === "no_recipients"
          ? "Nobody in that selection can be mailed — they've all opted out."
          : `Couldn't start the send (${e.message}).`;
        paintAdmin();
      }
    };
  }
  const clearProg = document.getElementById("email-clear-progress");
  if (clearProg) clearProg.onclick = () => { state.emailProgress = null; state.emailNote = ""; paintAdmin(); };

  // --- templates ---
  const newBtn = document.getElementById("tpl-new");
  if (newBtn) newBtn.onclick = () => { state.emailEditing = { id: null, name: "", category: "", subject: "", body: "" }; state.emailNote = ""; paintAdmin(); };
  document.querySelectorAll("[data-tpl-edit]").forEach((btn) => {
    btn.onclick = () => {
      const t = (state.emailTemplates || []).find((x) => x.id === btn.dataset.tplEdit);
      if (t) state.emailEditing = { id: t.id, name: t.name, category: t.category || "", subject: t.subject, body: t.body };
      state.emailNote = "";
      paintAdmin();
    };
  });
  document.querySelectorAll("[data-tpl-use]").forEach((btn) => {
    btn.onclick = () => {
      const t = (state.emailTemplates || []).find((x) => x.id === btn.dataset.tplUse);
      if (!t) return;
      state.emailSubject = t.subject; state.emailBody = t.body; state.emailTemplateName = t.name; state.emailTemplateId = t.id;
      state.emailPane = "compose"; state.emailPreview = null;
      state.emailNote = `Loaded "${t.name}" into the compose box.`;
      paintAdmin();
    };
  });
  document.querySelectorAll("[data-tpl-del]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.tplDel;
      // Two taps to delete — the first one arms the button, so nothing goes on a mis-tap.
      if (btn.dataset.armed !== "1") {
        btn.dataset.armed = "1";
        btn.textContent = "Tap again to delete";
        return;
      }
      try {
        await api(`/api/admin/templates/${id}`, { method: "DELETE" });
        state.emailTemplates = (state.emailTemplates || []).filter((t) => t.id !== id);
        state.emailNote = "Template deleted.";
      } catch (e) {
        state.emailNote = `Couldn't delete that template (${e.message}).`;
      }
      paintAdmin();
    };
  });
  document.querySelectorAll("[data-tpl-token]").forEach((btn) => {
    btn.onclick = () => insertAtCursor(document.getElementById("tpl-body"), btn.dataset.tplToken, (v) => {
      if (state.emailEditing) state.emailEditing.body = v;
    });
  });
  [["tpl-name", "name"], ["tpl-category", "category"], ["tpl-subject", "subject"], ["tpl-body", "body"]].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.oninput = () => { if (state.emailEditing) state.emailEditing[key] = el.value; };
  });
  const tplCancel = document.getElementById("tpl-cancel");
  if (tplCancel) tplCancel.onclick = () => { state.emailEditing = null; paintAdmin(); };
  const tplSave = document.getElementById("tpl-save");
  if (tplSave) {
    tplSave.onclick = async () => {
      const ed = state.emailEditing;
      if (!ed) return;
      if (!ed.name.trim() || !ed.subject.trim() || !ed.body.trim()) {
        state.emailNote = "A template needs a name, a subject and a body.";
        paintAdmin();
        return;
      }
      tplSave.disabled = true;
      tplSave.textContent = "Saving…";
      try {
        const out = ed.id
          ? await api(`/api/admin/templates/${ed.id}`, { method: "PUT", body: ed })
          : await api("/api/admin/templates", { method: "POST", body: ed });
        const list = (state.emailTemplates || []).filter((t) => t.id !== out.template.id);
        state.emailTemplates = [...list, out.template].sort(
          (a, b) => `${a.category}${a.name}`.localeCompare(`${b.category}${b.name}`)
        );
        state.emailEditing = null;
        state.emailNote = `Saved "${out.template.name}".`;
      } catch (e) {
        state.emailNote = `Couldn't save that template (${e.message}).`;
      }
      paintAdmin();
    };
  }

  // --- sent ---
  document.querySelectorAll("[data-campaign]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.campaign;
      if (state.emailOpenCampaign === id) { state.emailOpenCampaign = null; state.emailCampaignDetail = null; paintAdmin(); return; }
      state.emailOpenCampaign = id;
      state.emailCampaignDetail = null;
      paintAdmin();
      try {
        state.emailCampaignDetail = await api(`/api/admin/campaigns/${id}`);
      } catch { state.emailCampaignDetail = { recipients: [] }; }
      paintAdmin();
    };
  });
}

// Follows a send until the server says it's finished. The send runs server-side, so
// closing the tab doesn't stop it — this only keeps the count on screen honest.
async function pollCampaign(id) {
  try {
    const data = await api(`/api/admin/campaigns/${id}`);
    state.emailProgress = data.campaign;
    if (state.adminTab === "email") paintAdmin();
    if (data.campaign.status !== "done") {
      setTimeout(() => pollCampaign(id), 2000);
      return;
    }
    const c = await api("/api/admin/campaigns");
    state.emailCampaigns = c.campaigns || [];
    if (state.adminTab === "email") paintAdmin();
  } catch {
    setTimeout(() => pollCampaign(id), 5000);
  }
}

init();
