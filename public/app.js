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
  { key: "staffing", label: "Staffing & Support", weight: 0.15, anchors: [[5, "fully staffed, backup always available, call burden reasonable"], [3, "generally covered, but backup or call load tight at times"], [1, "chronically understaffed, no real backup, unsustainable call"]] },
  { key: "equipment", label: "Equipment & Resources", weight: 0.1, anchors: [[5, "modern, well maintained, drugs and supplies always on hand"], [3, "workable, but occasional equipment issues or shortages"], [1, "outdated/broken equipment or frequent drug shortages"]] },
  { key: "culture", label: "Culture & Collegiality", weight: 0.15, anchors: [[5, "welcoming, treated as part of the team from day one"], [3, "professional but distant, tolerated rather than welcomed"], [1, "openly unwelcoming or difficult toward locum staff"]] },
  { key: "orientation", label: "Orientation / Onboarding", weight: 0.1, anchors: [[5, "smooth EMR/badge/access setup, productive from day one"], [3, "got you functional, but took longer than it should have"], [1, "disorganized onboarding that ate into productive days"]] },
  { key: "schedule", label: "Schedule Reliability", weight: 0.1, anchors: [[5, "ran exactly as promised, essentially no last-minute changes"], [3, "mostly reliable, with occasional last-minute changes"], [1, "frequent last-minute changes or shifts not honored"]] },
  { key: "locationLogistics", label: "Location / Logistics", weight: 0.1, anchors: [[5, "easy commute, convenient parking, housing close by"], [3, "workable, but commute/parking/housing added real friction"], [1, "difficult commute, poor parking, or housing far from site"]] },
  { key: "supervision", label: "Supervision / Practice Autonomy", weight: 0.2, anchors: [[5, "independent practice"], [3, "medically directed/supervised loosely"], [1, "medically directed"]] },
];

const COLORS = { agency: "#123C3A", agent: "#B87F1E", hospital: "#8C3A32" };

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
  let sum = 0;
  categories.forEach((c) => { sum += (values[c.key] || 0) * c.weight; });
  return sum;
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
  view: "loading", // loading | home | gate | app | admin
  user: null,
  reviews: [],
  tab: "search",
  query: "",
  detail: null,
  toast: "",
  gateMode: "signin", // signin | request
  adminUnlocked: false,
  adminRequests: [],
};

const aaForm = { agencyName: "", agentName: "", payRate: "", ratings: {}, wouldReturn: "", comment: "" };
const hospForm = { name: "", ratings: {}, wouldReturn: "", comment: "" };
function resetForms() {
  AGENCY_CATEGORIES.forEach((c) => (aaForm.ratings[c.key] = 0));
  HOSPITAL_CATEGORIES.forEach((c) => (hospForm.ratings[c.key] = 0));
  aaForm.agencyName = ""; aaForm.agentName = ""; aaForm.payRate = ""; aaForm.wouldReturn = ""; aaForm.comment = "";
  hospForm.name = ""; hospForm.wouldReturn = ""; hospForm.comment = "";
}
resetForms();

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
    state.view = "app";
    await loadReviews();
  } catch {
    state.view = "home";
  }
  render();
}

async function loadReviews() {
  const data = await api("/api/reviews");
  state.reviews = data.reviews;
}

// ---------- computed helpers ----------

function typeLabel(t) { return t === "agency" ? "Agency" : t === "agent" ? "Agent" : "Hospital"; }

function searchResults() {
  const q = state.query.trim().toLowerCase();
  const byType = { agency: new Map(), agent: new Map(), hospital: new Map() };
  state.reviews.forEach((r) => {
    if (r.agencyName) byType.agency.set(r.agencyName, (byType.agency.get(r.agencyName) || []).concat(r));
    if (r.agentName) byType.agent.set(r.agentName, (byType.agent.get(r.agentName) || []).concat(r));
    if (r.hospitalName) byType.hospital.set(r.hospitalName, (byType.hospital.get(r.hospitalName) || []).concat(r));
  });
  const items = [];
  ["agency", "agent", "hospital"].forEach((type) => {
    byType[type].forEach((rows, name) => {
      if (q && !name.toLowerCase().includes(q)) return;
      const cats = type === "hospital" ? HOSPITAL_CATEGORIES : AGENCY_CATEGORIES;
      const scores = rows.map((r) => weighted(cats, type === "hospital" ? r.hospitalRatings : r.agencyAgentRatings));
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
    .filter((r) => r.reviewer.email === state.user.email)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- render ----------

function render() {
  if (state.view === "loading") { root.innerHTML = `<div class="body"><p>Loading the chart room…</p></div>`; return; }
  if (state.view === "home") { root.innerHTML = headerHtml(true) + toastHtml() + landingHtml() + footerHtml(); attachFooterHandlers(); attachLandingHandlers(); return; }
  if (state.view === "gate") { root.innerHTML = headerHtml() + toastHtml() + gateHtml() + footerHtml(); attachFooterHandlers(); attachGateHandlers(); return; }
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
  <svg class="hero-art" viewBox="0 0 340 210" role="img" aria-label="A verified CRNA review file">
    <rect x="0" y="0" width="340" height="210" fill="#123C3A"/>
    <g opacity="0.10">
      <circle cx="292" cy="34" r="70" fill="#E3A73B"/>
      <circle cx="34" cy="186" r="56" fill="#F2F4F1"/>
    </g>
    <!-- back file -->
    <rect x="46" y="40" width="190" height="140" rx="3" fill="#0D2E2C"/>
    <!-- main file card -->
    <rect x="36" y="30" width="190" height="140" rx="3" fill="#F7F8F5"/>
    <rect x="36" y="30" width="190" height="8" fill="#E3A73B"/>
    <rect x="52" y="52" width="96" height="9" rx="1" fill="#123C3A"/>
    <rect x="52" y="68" width="58" height="6" rx="1" fill="#9BA59E"/>
    <text x="52" y="102" font-size="19" fill="#E3A73B" letter-spacing="3">★★★★</text>
    <text x="128" y="102" font-size="19" fill="#D8DDD5" letter-spacing="3">★</text>
    <rect x="52" y="118" width="146" height="5" rx="1" fill="#C9D2C6"/>
    <rect x="52" y="130" width="160" height="5" rx="1" fill="#C9D2C6"/>
    <rect x="52" y="142" width="112" height="5" rx="1" fill="#C9D2C6"/>
    <!-- beware stamp -->
    <g transform="rotate(-9 236 140)">
      <rect x="186" y="122" width="112" height="30" fill="none" stroke="#8C3A32" stroke-width="2.5"/>
      <text x="242" y="143" text-anchor="middle" font-size="14" font-weight="700" fill="#8C3A32" letter-spacing="1.5">BEWARE</text>
    </g>
    <!-- verification badge -->
    <g transform="translate(232,26)">
      <path d="M36 0 L70 13 V44 C70 63 54 75 36 82 C18 75 2 63 2 44 V13 Z" fill="#E3A73B"/>
      <path d="M21 41 L31 52 L51 29" fill="none" stroke="#123C3A" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
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
        <li>Every review is tied to a verified account — no drive-by anonymous posts</li>
        <li>Reviews can't be bought, removed, or edited by the parties being rated</li>
      </ul>
    </section>

    <section class="lp-section">
      <div class="lp-label">WHAT YOU CAN RATE</div>
      <h3 class="lp-h">Full-time staff or locum contractor — rate the assignment end to end.</h3>
      <div class="feature-grid">
        <div class="feature f-hospital">
          <div class="feature-kicker">HOSPITALS &amp; ANESTHESIA GROUPS</div>
          <p>Case mix and acuity, staffing and backup, equipment, culture toward outside staff, onboarding, schedule reliability, and practice autonomy — independent, supervised, or medically directed.</p>
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
        <li><span class="step-n">2</span><div><strong>Get your sign-in link.</strong> Once approved, you sign in by email — no password to manage.</div></li>
        <li><span class="step-n">3</span><div><strong>Search, then contribute.</strong> Look up any facility, agency, or agent by name, and post your own rated review of the places you've worked.</div></li>
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
      <button class="nav-btn${state.gateMode === "signin" ? " active" : ""}" id="gate-signin-tab">Already a member</button>
      <button class="nav-btn${state.gateMode === "request" ? " active" : ""}" id="gate-request-tab">First time here</button>
    </div>`;
  const body = state.gateMode === "signin" ? signinFormHtml() : requestFormHtml();
  return tabs + `<div class="body"><button class="back-btn" id="gate-home-btn" style="margin-bottom:10px">&larr; Back to home</button><div id="gate-body">${body}</div></div>`;
}
function signinFormHtml() {
  return `
    <div class="card">
      <div class="section-label">ALREADY A MEMBER — SIGN IN</div>
      <p class="hint-text" style="margin-top:0">Already verified? Enter your email and we'll send you a one-tap sign-in link.</p>
      <input id="signin-email" type="email" placeholder="Email" />
      <div id="gate-error" class="error-text"></div>
      <button class="primary-btn" id="signin-submit" style="margin-top:10px">Email me a sign-in link</button>
    </div>`;
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
    document.getElementById("signin-submit").onclick = async () => {
      const email = document.getElementById("signin-email").value.trim();
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
    <input class="search-input" id="search-box" placeholder="Search an agency, agent, or hospital…" value="${esc(state.query)}" />
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
  const isHospital = type === "hospital";
  const field = type === "agency" ? "agencyName" : type === "agent" ? "agentName" : "hospitalName";
  const rows = state.reviews.filter((r) => r[field] === name).sort((a, b) => b.date.localeCompare(a.date));
  const categories = isHospital ? HOSPITAL_CATEGORIES : AGENCY_CATEGORIES;
  const scores = rows.map((r) => weighted(categories, isHospital ? r.hospitalRatings : r.agencyAgentRatings));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const payRows = rows.filter((r) => r.payRate != null && !isHospital);
  const avgPay = payRows.length ? payRows.reduce((a, b) => a + b.payRate, 0) / payRows.length : null;

  const rowsHtml = rows.map((r) => {
    const ratings = isHospital ? r.hospitalRatings : r.agencyAgentRatings;
    const comment = isHospital ? r.hospitalComment : r.agencyAgentComment;
    const wouldReturn = isHospital ? r.hospitalWouldReturn : r.agencyAgentWouldReturn;
    const pairedLabel = !isHospital && type === "agency" && r.agentName ? `Agent: ${esc(r.agentName)}` :
      !isHospital && type === "agent" && r.agencyName ? `Agency: ${esc(r.agencyName)}` : "";
    const isMine = state.user && r.reviewer.email === state.user.email;
    const chips = categories.map((c) => `<span class="chip">${esc(c.label.split(" ")[0])} ${ratings[c.key] || 0}</span>`).join("");
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:800;font-size:16px">${weighted(categories, ratings).toFixed(2)}</span>
          <span style="font-size:12px;color:#6B756F">${new Date(r.date).toLocaleDateString()}</span>
        </div>
        ${pairedLabel ? `<div style="font-size:12px;color:#6B756F;margin-bottom:4px">${pairedLabel}</div>` : ""}
        ${!isHospital && r.payRate != null ? `<div style="font-size:12px;color:#6B756F;margin-bottom:4px">Pay: $${r.payRate}/hr (pay score ${payScore(r.payRate)}/5)</div>` : ""}
        <div style="margin:6px 0">${chips}</div>
        <div style="margin:4px 0">${returnBadge(wouldReturn)}</div>
        ${comment ? `<p style="margin:6px 0">${esc(comment)}</p>` : ""}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <p style="margin:0;font-size:12px;color:#6B756F">— ${esc(r.reviewer.name || "Anonymous CRNA")}, ${esc(r.reviewer.credentials)}</p>
          ${isMine ? `<span data-delete="${r.id}"><button class="tiny-btn">Delete</button></span>` : ""}
        </div>
      </div>`;
  }).join("");

  return `
    <button class="back-btn" id="detail-back">&larr; Back to search</button>
    <div class="card border-${type}" style="margin-top:10px">
      <div style="font-size:11px;letter-spacing:0.3px;color:${COLORS[type]};font-weight:700">${typeLabel(type).toUpperCase()}</div>
      <div style="font-family:'Special Elite',monospace;font-size:24px;margin:4px 0">${esc(name)}</div>
      ${rows.length > 0
        ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${starsHtml(Math.round(avg), 18)}<span style="font-weight:700">${avg.toFixed(2)}</span><span style="color:#6B756F;font-size:13px">${rows.length} review${rows.length !== 1 ? "s" : ""}</span>${avgPay != null ? `<span style="color:#6B756F;font-size:13px">· avg $${Math.round(avgPay)}/hr</span>` : ""}</div>`
        : `<div style="color:#6B756F;font-size:13px">No reviews yet.</div>`}
    </div>
    ${rowsHtml}`;
}

// ---------- submit ----------

function categoryRowHtml(cat, group) {
  const val = group === "aa" ? aaForm.ratings[cat.key] : hospForm.ratings[cat.key];
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
  return `
    <div class="card">
      <div class="section-label">POSTING AS</div>
      <div style="font-family:'Special Elite',monospace;font-size:17px">${esc(state.user.name)}, ${esc(state.user.credentials)}</div>
      <p class="hint-text">Tied to your verified account — real names keep the ratings honest.</p>
    </div>

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
    </div>

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
    </div>

    <div id="submit-error" class="error-text"></div>
    <button class="primary-btn" id="submit-btn">Post review</button>`;
}

function attachSubmitHandlers() {
  document.getElementById("aa-agency").oninput = (e) => (aaForm.agencyName = e.target.value);
  document.getElementById("aa-agent").oninput = (e) => (aaForm.agentName = e.target.value);
  document.getElementById("aa-pay").oninput = (e) => {
    aaForm.payRate = e.target.value;
    const ps = payScore(aaForm.payRate);
    document.getElementById("aa-pay-score").textContent = ps != null ? `Pay score: ${ps}/5` : "";
  };
  document.getElementById("aa-comment").oninput = (e) => (aaForm.comment = e.target.value);
  document.getElementById("hosp-name").oninput = (e) => (hospForm.name = e.target.value);
  document.getElementById("hosp-comment").oninput = (e) => (hospForm.comment = e.target.value);

  ["aa", "hosp"].forEach((group) => {
    const cats = group === "aa" ? AGENCY_CATEGORIES : HOSPITAL_CATEGORIES;
    cats.forEach((c) => attachSubmitHandlers.rebindStars(group, c.key));
  });
  rebindReturnToggle("aa");
  rebindReturnToggle("hosp");

  document.getElementById("submit-btn").onclick = async () => {
    const errEl = document.getElementById("submit-error");
    if (!aaForm.agencyName.trim() || !hospForm.name.trim()) { errEl.textContent = "An agency name and a hospital name are required."; return; }
    const aaRated = AGENCY_CATEGORIES.every((c) => aaForm.ratings[c.key] > 0);
    const hospRated = HOSPITAL_CATEGORIES.every((c) => hospForm.ratings[c.key] > 0);
    if (!aaRated || !hospRated) { errEl.textContent = "Give a star rating for every category in both sections."; return; }
    errEl.textContent = "";
    try {
      await api("/api/reviews", {
        method: "POST",
        body: {
          agencyName: aaForm.agencyName.trim(),
          agentName: aaForm.agentName.trim(),
          payRate: aaForm.payRate === "" ? null : Number(aaForm.payRate),
          agencyAgentRatings: aaForm.ratings,
          agencyAgentWouldReturn: aaForm.wouldReturn,
          agencyAgentComment: aaForm.comment.trim(),
          hospitalName: hospForm.name.trim(),
          hospitalRatings: hospForm.ratings,
          hospitalWouldReturn: hospForm.wouldReturn,
          hospitalComment: hospForm.comment.trim(),
        },
      });
      await loadReviews();
      resetForms();
      state.tab = "search";
      flash("Review posted.");
      render();
    } catch (e) {
      errEl.textContent = "Something went wrong posting your review. Try again.";
    }
  };
}
// simple rebind helpers so newly-replaced DOM nodes keep working
function rebindReturnToggle(group) {
  document.querySelectorAll(`#return-${group} [data-return]`).forEach((btn) => {
    btn.onclick = () => {
      const [g, v] = btn.dataset.return.split("::");
      const form = g === "aa" ? aaForm : hospForm;
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
      const form = g === "aa" ? aaForm : hospForm;
      form.ratings[k] = Number(n);
      document.getElementById(`stars-${g}-${k}`).innerHTML = starsInteractiveHtml(form.ratings[k], g, k);
      attachSubmitHandlers.rebindStars(g, k);
      const cats = g === "aa" ? AGENCY_CATEGORIES : HOSPITAL_CATEGORIES;
      document.getElementById(g === "aa" ? "aa-score" : "hosp-score").textContent = weighted(cats, form.ratings).toFixed(2);
    };
  });
};

// ---------- my reviews ----------

function mineHtml() {
  const mine = myReviews();
  if (mine.length === 0) {
    return `<div class="empty-box"><p style="margin:0">No reviews posted yet under ${esc(state.user.name)}. Head to "Post a review" to file your first case.</p></div>`;
  }
  return mine.map((r) => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;color:#6B756F">${new Date(r.date).toLocaleDateString()}</span>
        <span data-delete="${r.id}"><button class="tiny-btn">Delete</button></span>
      </div>
      <div style="margin-bottom:10px;padding-left:10px;border-left:3px solid ${COLORS.agency}">
        <div style="font-size:11px;color:${COLORS.agency};font-weight:700">AGENCY: ${esc(r.agencyName)}${r.agentName ? ` · AGENT: ${esc(r.agentName)}` : ""}</div>
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
          ${starsHtml(Math.round(weighted(AGENCY_CATEGORIES, r.agencyAgentRatings)), 14)}
          <span style="font-size:13px;font-weight:700">${weighted(AGENCY_CATEGORIES, r.agencyAgentRatings).toFixed(2)}</span>
          ${r.payRate != null ? `<span style="font-size:12px;color:#6B756F">· $${r.payRate}/hr (pay ${payScore(r.payRate)}/5)</span>` : ""}
        </div>
        ${returnBadge(r.agencyAgentWouldReturn)}
        ${r.agencyAgentComment ? `<p style="margin:4px 0 0;font-size:13px">${esc(r.agencyAgentComment)}</p>` : ""}
      </div>
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
function attachMineHandlers() { attachDeleteHandlers(); }

function attachDeleteHandlers() {
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
