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
  view: "loading", // loading | gate | app | admin
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
    state.view = "gate";
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

function headerHtml() {
  return `
    <div class="header">
      <div class="header-tab">CASE FILE</div>
      <h1 class="h1">CRNA Critics</h1>
      <p class="tagline">Know before you sign. Rate the agency & agent, the pay, and the hospital — separately, honestly.</p>
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
    state.view = state.view === "admin" ? (state.user ? "app" : "gate") : "admin";
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
        state.user = null; state.view = "gate"; state.tab = "search"; state.detail = null;
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

// ---------- gate (sign in / request access) ----------

function gateHtml() {
  const tabs = `
    <div class="nav">
      <button class="nav-btn${state.gateMode === "signin" ? " active" : ""}" id="gate-signin-tab">Sign in</button>
      <button class="nav-btn${state.gateMode === "request" ? " active" : ""}" id="gate-request-tab">Request verification</button>
    </div>`;
  const body = state.gateMode === "signin" ? signinFormHtml() : requestFormHtml();
  return tabs + `<div class="body" id="gate-body">${body}</div>`;
}
function signinFormHtml() {
  return `
    <div class="card">
      <div class="section-label">SIGN IN</div>
      <p class="hint-text" style="margin-top:0">Already verified? Enter your email and we'll send you a one-tap sign-in link.</p>
      <input id="signin-email" type="email" placeholder="Email" />
      <div id="gate-error" class="error-text"></div>
      <button class="primary-btn" id="signin-submit" style="margin-top:10px">Email me a sign-in link</button>
    </div>`;
}
function requestFormHtml() {
  return `
    <div class="card">
      <div class="section-label">CRNA VERIFICATION</div>
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
          errEl.textContent = "No account found with that email. Try 'Request verification' instead.";
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
  const anchors = cat.anchors.map(([s, t]) => `<li>
