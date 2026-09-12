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

const COLORS = { agency: "#123C3A", agent: "#B87F1E", hospital: "#8C3A32", group: "#3F5E8C" };

// One place that knows, for each rateable thing, which review fields hold its data.
const ENTITY = {
  agency:   { label: "Agency",           field: "agencyName",   ratings: "agencyAgentRatings", comment: "agencyAgentComment", ret: "agencyAgentWouldReturn", categories: AGENCY_CATEGORIES,   hasPay: true },
  agent:    { label: "Agent",            field: "agentName",    ratings: "agencyAgentRatings", comment: "agencyAgentComment", ret: "agencyAgentWouldReturn", categories: AGENCY_CATEGORIES,   hasPay: true },
  group:    { label: "Anesthesia Group", field: "groupName",    ratings: "groupRatings",       comment: "groupComment",       ret: "groupWouldReturn",       categories: GROUP_CATEGORIES,    hasPay: false },
  hospital: { label: "Hospital",         field: "hospitalName", ratings: "hospitalRatings",    comment: "hospitalComment",    ret: "hospitalWouldReturn",    categories: HOSPITAL_CATEGORIES, hasPay: false },
};
const EMPLOYMENT = {
  locum: { label: "Locum / 1099 contractor", short: "Locum", reviews: "agencies, agents, and hospitals" },
  staff: { label: "Full-time / part-time staff", short: "Staff", reviews: "anesthesia groups and hospitals" },
};

function payScore(rate) {
  const r = Number(rate);
  if (!isFinite(r) || rate === "" || rate == null) return null;
  if (r <= 180) return 0;
  if (r <= 190) return 1;
  if (r <= 210) return 2;
  if (r <= 230) return 3;
  if (r <= 250) return 4;
  return 5;
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
  view: "loading", // loading | home | gate | setpw | app | admin
  user: null,
  reviews: [],
  tab: "search",
  query: "",
  detail: null,
  toast: "",
  gateMode: "signin", // signin | request | link
  adminUnlocked: false,
  adminRequests: [],
  editingId: null, // id of the member's own review being edited in the Post a review form
};

const aaForm = { agencyName: "", agentName: "", payRate: "", ratings: {}, wouldReturn: "", comment: "" };
const grpForm = { name: "", ratings: {}, wouldReturn: "", comment: "" };
const hospForm = { name: "", ratings: {}, wouldReturn: "", comment: "" };
const postOpts = { anonymous: false };
const FORMS = { aa: { form: aaForm, categories: AGENCY_CATEGORIES }, grp: { form: grpForm, categories: GROUP_CATEGORIES }, hosp: { form: hospForm, categories: HOSPITAL_CATEGORIES } };
function resetForms() {
  AGENCY_CATEGORIES.forEach((c) => (aaForm.ratings[c.key] = 0));
  GROUP_CATEGORIES.forEach((c) => (grpForm.ratings[c.key] = 0));
  HOSPITAL_CATEGORIES.forEach((c) => (hospForm.ratings[c.key] = 0));
  aaForm.agencyName = ""; aaForm.agentName = ""; aaForm.payRate = ""; aaForm.wouldReturn = ""; aaForm.comment = "";
  grpForm.name = ""; grpForm.wouldReturn = ""; grpForm.comment = "";
  hospForm.name = ""; hospForm.wouldReturn = ""; hospForm.comment = "";
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
  aaForm.payRate = r.payRate == null ? "" : String(r.payRate);
  AGENCY_CATEGORIES.forEach((c) => (aaForm.ratings[c.key] = (r.agencyAgentRatings || {})[c.key] || 0));
  aaForm.wouldReturn = r.agencyAgentWouldReturn || ""; aaForm.comment = r.agencyAgentComment || "";
  grpForm.name = r.groupName || "";
  GROUP_CATEGORIES.forEach((c) => (grpForm.ratings[c.key] = (r.groupRatings || {})[c.key] || 0));
  grpForm.wouldReturn = r.groupWouldReturn || ""; grpForm.comment = r.groupComment || "";
  hospForm.name = r.hospitalName || "";
  HOSPITAL_CATEGORIES.forEach((c) => (hospForm.ratings[c.key] = (r.hospitalRatings || {})[c.key] || 0));
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
      const name = r[ENTITY[t].field];
      if (name) byType[t].set(name, (byType[t].get(name) || []).concat(r));
    });
  });
  const items = [];
  types.forEach((type) => {
    byType[type].forEach((rows, name) => {
      if (q && !name.toLowerCase().includes(q)) return;
      const cats = ENTITY[type].categories;
      const scores = rows.map((r) => weighted(cats, r[ENTITY[type].ratings]));
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      items.push({ type, name, count: rows.length, avg });
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
      <button type="button" class="admin-link" id="admin-link-btn">Site admin</button>
    </div>`;
}
function attachFooterHandlers() {
  document.getElementById("admin-link-btn").onclick = () => {
    state.view = state.view === "admin" ? (state.user ? "app" : "home") : "admin";
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
        <p class="hero-fine">Free for CRNAs. No agency, hospital, or group can pay to remove a review.</p>
      </div>
      ${heroArtHtml()}
    </section>

    <section class="lp-section">
      <div class="lp-label">WHY THIS EXISTS</div>
      <p class="lp-lead">Anesthesia careers turn on information most of us never get until it's too late — how a facility really staffs its rooms, whether an agency pays what it quoted, whether a recruiter told you the truth about the assignment.</p>
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
          <p>Pay and billing accuracy, contract terms, credentialing support, travel and housing logistics, and whether the assignment matched what you were sold.</p>
        </div>
        <div class="feature f-agent">
          <div class="feature-kicker">AGENTS &amp; RECRUITERS</div>
          <p>Communication and responsiveness rated 0–5, from misinformation and pressure tactics at the low end to honest, transparent, trustworthy at the high end.</p>
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
      <div id="gate-error" class="error-text"></div>
      <button class="primary-btn" id="request-submit" style="margin-top:10px">Submit for verification</button>
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
          document.getElementById("gate-body").innerHTML = `<div class="empty-box"><p style="margin:0;font-weight:700">Check your email.</p><p class="hint-text">We sent a sign-in link to ${esc(email)}. It expires in 15 minutes.</p></div>`;
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
    document.getElementById("request-submit").onclick = async () => {
      const name = document.getElementById("req-name").value.trim();
      const nbcrnaNumber = document.getElementById("req-nbcrna").value.trim();
      const email = document.getElementById("req-email").value.trim();
      const phone = document.getElementById("req-phone").value.trim();
      const attest = document.getElementById("req-attest").checked;
      const errEl = document.getElementById("gate-error");
      if (!name || !nbcrnaNumber || !email || !phone) { errEl.textContent = "Fill in every field — this is how we verify you're a practicing CRNA."; return; }
      if (!attest) { errEl.textContent = "Please confirm the attestation above."; return; }
      errEl.textContent = "";
      try {
        await api("/api/request-access", { method: "POST", body: { name, nbcrnaNumber, email, phone } });
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
  return results.map((item) => `
    <button class="card clickable border-${item.type}" data-open="${item.type}::${esc(item.name)}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:11px;letter-spacing:0.3px;color:${COLORS[item.type]};font-weight:700;margin-bottom:3px">${typeLabel(item.type).toUpperCase()}</div>
          <div style="font-family:'Special Elite',monospace;font-size:18px">${esc(item.name)}</div>
        </div>
        ${item.count > 0
          ? `<div style="text-align:right"><div style="font-size:22px;font-weight:800">${item.avg.toFixed(1)}</div><div style="font-size:11px;color:#6B756F">${item.count} review${item.count !== 1 ? "s" : ""}</div></div>`
          : `<div style="font-size:11px;color:#6B756F">no ratings yet</div>`}
      </div>
    </button>`).join("");
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
  const rows = state.reviews.filter((r) => r[ent.field] === name).sort((a, b) => b.date.localeCompare(a.date));
  const categories = ent.categories;
  const scores = rows.map((r) => weighted(categories, r[ent.ratings]));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const payRows = rows.filter((r) => r.payRate != null && ent.hasPay);
  const avgPay = payRows.length ? payRows.reduce((a, b) => a + b.payRate, 0) / payRows.length : null;

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
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:800;font-size:16px">${weighted(categories, ratings).toFixed(2)}</span>
          <span style="font-size:12px;color:#6B756F">${new Date(r.date).toLocaleDateString()}${r.editedAt ? ` · <span title="Edited ${new Date(r.editedAt).toLocaleDateString()}">edited</span>` : ""}</span>
        </div>
        ${pairedLabel ? `<div style="font-size:12px;color:#6B756F;margin-bottom:4px">${pairedLabel}</div>` : ""}
        ${ent.hasPay && r.payRate != null ? `<div style="font-size:12px;color:#6B756F;margin-bottom:4px">Pay: $${r.payRate}/hr (pay score ${payScore(r.payRate)}/5)</div>` : ""}
        <div style="margin:6px 0">${chips}</div>
        <div style="margin:4px 0">${returnBadge(wouldReturn)}</div>
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
    return { label: c.label, n: vals.length, avg: catAvg };
  });
  const returnField = ent.ret;
  const returnTally = { Y: 0, Maybe: 0, N: 0 };
  rows.forEach((r) => { if (r[returnField] in returnTally) returnTally[r[returnField]] += 1; });
  const statsHtml = rows.length === 0 ? "" : `
    <div class="card" style="margin-top:0">
      <div class="section-label">CATEGORY AVERAGES · ${rows.length} REVIEW${rows.length !== 1 ? "S" : ""}</div>
      <table class="stats-table">
        ${categoryStats.map((st) => `
          <tr>
            <td class="stats-label">${esc(st.label)}</td>
            <td class="stats-stars">${st.avg != null ? starsHtml(Math.round(st.avg), 13) : ""}</td>
            <td class="stats-avg">${st.avg != null ? st.avg.toFixed(1) : "—"}</td>
            <td class="stats-n">${st.n > 0 ? `n=${st.n}` : "no data"}</td>
          </tr>`).join("")}
      </table>
      <div class="stats-return">
        <span>Would ${isHospital ? "work here" : "work with them"} again:</span>
        <span class="badge y">${returnTally.Y} YES</span>
        <span class="badge maybe">${returnTally.Maybe} MAYBE</span>
        <span class="badge n">${returnTally.N} NO</span>
      </div>
    </div>`;

  return `
    <button class="back-btn" id="detail-back">&larr; Back to search</button>
    <div class="card border-${type}" style="margin-top:10px">
      <div style="font-size:11px;letter-spacing:0.3px;color:${COLORS[type]};font-weight:700">${typeLabel(type).toUpperCase()}</div>
      <div style="font-family:'Special Elite',monospace;font-size:24px;margin:4px 0">${esc(name)}</div>
      ${rows.length > 0
        ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${starsHtml(Math.round(avg), 18)}<span style="font-weight:700">${avg.toFixed(2)}</span><span style="color:#6B756F;font-size:13px">overall · ${rows.length} review${rows.length !== 1 ? "s" : ""}</span>${avgPay != null ? `<span style="color:#6B756F;font-size:13px">· avg $${Math.round(avgPay)}/hr quoted</span>` : ""}</div>`
        : `<div style="color:#6B756F;font-size:13px">No reviews yet.</div>`}
    </div>
    ${statsHtml}
    <div class="section-label" style="margin:14px 0 8px">INDIVIDUAL REVIEWS</div>
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
    </div>`;
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
      <input id="grp-name" placeholder="Anesthesia group / practice name" value="${esc(grpForm.name)}" />
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
      <div class="section-label" style="color:${COLORS.agency}">AGENCY &amp; AGENT</div>
      <input id="aa-agency" placeholder="Agency name" value="${esc(aaForm.agencyName)}" />
      <input id="aa-agent" style="margin-top:8px" placeholder="Agent / recruiter name" value="${esc(aaForm.agentName)}" />
      <div style="margin-top:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:4px">Pay range</div>
        <input id="aa-pay" type="number" placeholder="Hourly rate quoted ($/hr)" value="${esc(aaForm.payRate)}" />
        <div id="aa-pay-score" class="hint-text">${payScore(aaForm.payRate) != null ? `Pay score: ${payScore(aaForm.payRate)}/5` : ""}</div>
        <div class="hint-text">≤$180 → 0 · $181–190 → 1 · $191–210 → 2 · $211–230 → 3 · $231–250 → 4 · $251+ → 5. Scored separately, not part of the weighted score below.</div>
      </div>
      <div style="margin-top:14px">${AGENCY_CATEGORIES.map((c) => categoryRowHtml(c, "aa")).join("")}</div>
      <div class="score-row"><span style="font-size:12px;color:#6B756F">Weighted score</span><span class="big" id="aa-score">${weighted(AGENCY_CATEGORIES, aaForm.ratings).toFixed(2)}</span></div>
      <div style="margin-top:8px">
        <div style="font-size:13px;font-weight:600;margin-bottom:4px">Would you work with them again?</div>
        ${returnToggleHtml(aaForm.wouldReturn, "aa")}
      </div>
      <textarea id="aa-comment" style="margin-top:10px" rows="3" placeholder="Anything else another CRNA should know about this agency/agent?">${esc(aaForm.comment)}</textarea>
    </div>`;
  const hospitalCard = `
    <div class="card border-hospital" style="margin-bottom:12px">
      <div class="section-label" style="color:${COLORS.hospital}">HOSPITAL</div>
      <input id="hosp-name" placeholder="Hospital / facility name" value="${esc(hospForm.name)}" />
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
    document.getElementById("aa-pay").oninput = (e) => {
      aaForm.payRate = e.target.value;
      const ps = payScore(aaForm.payRate);
      document.getElementById("aa-pay-score").textContent = ps != null ? `Pay score: ${ps}/5` : "";
    };
    document.getElementById("aa-comment").oninput = (e) => (aaForm.comment = e.target.value);
  } else {
    document.getElementById("grp-name").oninput = (e) => (grpForm.name = e.target.value);
    document.getElementById("grp-comment").oninput = (e) => (grpForm.comment = e.target.value);
  }
  document.getElementById("hosp-name").oninput = (e) => (hospForm.name = e.target.value);
  document.getElementById("hosp-comment").oninput = (e) => (hospForm.comment = e.target.value);

  [first, "hosp"].forEach((group) => {
    FORMS[group].categories.forEach((c) => attachSubmitHandlers.rebindStars(group, c.key));
    rebindReturnToggle(group);
  });

  document.getElementById("submit-btn").onclick = async () => {
    const errEl = document.getElementById("submit-error");
    const firstName = mode === "staff" ? grpForm.name : aaForm.agencyName;
    if (!firstName.trim() || !hospForm.name.trim()) {
      errEl.textContent = mode === "staff" ? "An anesthesia group name and a hospital name are required." : "An agency name and a hospital name are required.";
      return;
    }
    const firstRated = FORMS[first].categories.every((c) => FORMS[first].form.ratings[c.key] > 0);
    const hospRated = HOSPITAL_CATEGORIES.every((c) => hospForm.ratings[c.key] > 0);
    if (!firstRated || !hospRated) { errEl.textContent = "Give a star rating for every category in both sections."; return; }
    errEl.textContent = "";
    const body = {
      employmentType: mode,
      anonymous: postOpts.anonymous,
      hospitalName: hospForm.name.trim(),
      hospitalRatings: hospForm.ratings,
      hospitalWouldReturn: hospForm.wouldReturn,
      hospitalComment: hospForm.comment.trim(),
    };
    if (mode === "staff") {
      Object.assign(body, { groupName: grpForm.name.trim(), groupRatings: grpForm.ratings, groupWouldReturn: grpForm.wouldReturn, groupComment: grpForm.comment.trim() });
    } else {
      Object.assign(body, {
        agencyName: aaForm.agencyName.trim(), agentName: aaForm.agentName.trim(),
        payRate: aaForm.payRate === "" ? null : Number(aaForm.payRate),
        agencyAgentRatings: aaForm.ratings, agencyAgentWouldReturn: aaForm.wouldReturn, agencyAgentComment: aaForm.comment.trim(),
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
      ${r.groupName ? `
      <div style="margin-bottom:10px;padding-left:10px;border-left:3px solid ${COLORS.group}">
        <div style="font-size:11px;color:${COLORS.group};font-weight:700">ANESTHESIA GROUP: ${esc(r.groupName)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
          ${starsHtml(Math.round(weighted(GROUP_CATEGORIES, r.groupRatings)), 14)}
          <span style="font-size:13px;font-weight:700">${weighted(GROUP_CATEGORIES, r.groupRatings).toFixed(2)}</span>
        </div>
        ${returnBadge(r.groupWouldReturn)}
        ${r.groupComment ? `<p style="margin:4px 0 0;font-size:13px">${esc(r.groupComment)}</p>` : ""}
      </div>` : ""}
      ${r.agencyName ? `
      <div style="margin-bottom:10px;padding-left:10px;border-left:3px solid ${COLORS.agency}">
        <div style="font-size:11px;color:${COLORS.agency};font-weight:700">AGENCY: ${esc(r.agencyName)}${r.agentName ? ` · AGENT: ${esc(r.agentName)}` : ""}</div>
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
          ${starsHtml(Math.round(weighted(AGENCY_CATEGORIES, r.agencyAgentRatings)), 14)}
          <span style="font-size:13px;font-weight:700">${weighted(AGENCY_CATEGORIES, r.agencyAgentRatings).toFixed(2)}</span>
          ${r.payRate != null ? `<span style="font-size:12px;color:#6B756F">· $${r.payRate}/hr (pay ${payScore(r.payRate)}/5)</span>` : ""}
        </div>
        ${returnBadge(r.agencyAgentWouldReturn)}
        ${r.agencyAgentComment ? `<p style="margin:4px 0 0;font-size:13px">${esc(r.agencyAgentComment)}</p>` : ""}
      </div>` : ""}
      <div style="padding-left:10px;border-left:3px solid ${COLORS.hospital}">
        <div style="font-size:11px;color:${COLORS.hospital};font-weight:700">HOSPITAL: ${esc(r.hospitalName)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
          ${starsHtml(Math.round(weighted(HOSPITAL_CATEGORIES, r.hospitalRatings)), 14)}
          <span style="font-size:13px;font-weight:700">${weighted(HOSPITAL_CATEGORIES, r.hospitalRatings).toFixed(2)}</span>
        </div>
        ${returnBadge(r.hospitalWouldReturn)}
        ${r.hospitalComment ? `<p style="margin:4px 0 0;font-size:13px">${esc(r.hospitalComment)}</p>` : ""}
      </div>
    </div>`).join("");
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
  const pending = state.adminRequests.filter((r) => r.status === "pending");
  const decided = state.adminRequests.filter((r) => r.status !== "pending");

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <button class="back-btn" id="admin-back-btn">&larr; Close admin</button>
      <button class="tiny-btn" id="admin-refresh">Refresh</button>
    </div>
    <div class="section-label" style="margin:10px 0">PENDING VERIFICATION (${pending.length})</div>
    ${pending.length === 0 ? `<p class="hint-text">Nothing waiting.</p>` : ""}
    ${pending.map((r) => `
      <div class="card">
        <div style="font-weight:700">${esc(r.name)}</div>
        <div style="font-size:12px;color:#6B756F">NBCRNA ${esc(r.nbcrna_number)}</div>
        <div style="font-size:12px;color:#6B756F">${esc(r.email)} · ${esc(r.phone)}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="tiny-btn approve" data-decide="${r.id}::approved">Approve</button>
          <button class="tiny-btn reject" data-decide="${r.id}::rejected">Reject</button>
        </div>
      </div>`).join("")}
    <div class="section-label" style="margin:14px 0 10px">DECIDED</div>
    ${decided.length === 0 ? `<p class="hint-text">None yet.</p>` : ""}
    ${decided.map((r) => `
      <div class="card" style="opacity:0.7">
        <div style="display:flex;justify-content:space-between">
          <span style="font-weight:700">${esc(r.name)}</span>
          <span style="font-size:11px;font-weight:700;color:${r.status === "approved" ? "#1F5C57" : "#8C3A32"}">${r.status.toUpperCase()}</span>
        </div>
        <div style="font-size:12px;color:#6B756F">NBCRNA ${esc(r.nbcrna_number)}</div>
      </div>`).join("")}`;

  document.getElementById("admin-back-btn").onclick = () => { state.view = state.user ? "app" : "home"; render(); };
  document.getElementById("admin-refresh").onclick = () => renderAdmin();
  document.querySelectorAll("[data-decide]").forEach((btn) => {
    btn.onclick = async () => {
      const [id, decision] = btn.dataset.decide.split("::");
      await api(`/api/admin/requests/${id}/decide`, { method: "POST", body: { decision } });
      renderAdmin();
    };
  });
}

init();
