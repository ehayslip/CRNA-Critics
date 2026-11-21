/* CRNA Critics — iPhone app.
 *
 * A native-shell app (bundled in the binary, not a web page) that talks to the crnacritics.com JSON API.
 * Native pieces: tab bar + navigation stacks, Face ID app lock, Keychain-free token storage in
 * Capacitor Preferences, offline cache of every review and of saved places, haptics, the iOS share
 * sheet, network-status banner, in-app Safari for legal pages, and a native review form.
 */
(function () {
  "use strict";

  const SITE = "https://crnacritics.com";
  const CAP = window.Capacitor || null;
  const P = (CAP && CAP.Plugins) || {};
  const NATIVE = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
  const NA = -1;

  // ---------------------------------------------------------------- storage
  const store = {
    async get(key, fallback) {
      try {
        if (P.Preferences) {
          const { value } = await P.Preferences.get({ key });
          return value == null ? fallback : JSON.parse(value);
        }
        const v = localStorage.getItem("cc_" + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    async set(key, val) {
      try {
        const value = JSON.stringify(val);
        if (P.Preferences) await P.Preferences.set({ key, value });
        else localStorage.setItem("cc_" + key, value);
      } catch (e) { /* storage is best-effort */ }
    },
    async remove(key) {
      try {
        if (P.Preferences) await P.Preferences.remove({ key });
        else localStorage.removeItem("cc_" + key);
      } catch (e) { /* ignore */ }
    },
  };

  // ---------------------------------------------------------------- native helpers
  const haptic = {
    tap() { try { P.Haptics && P.Haptics.impact({ style: "LIGHT" }); } catch (e) {} },
    pick() { try { P.Haptics && P.Haptics.selectionChanged(); } catch (e) {} },
    ok() { try { P.Haptics && P.Haptics.notification({ type: "SUCCESS" }); } catch (e) {} },
    warn() { try { P.Haptics && P.Haptics.notification({ type: "WARNING" }); } catch (e) {} },
  };
  function openUrl(url) {
    if (P.Browser) return P.Browser.open({ url, presentationStyle: "popover", toolbarColor: "#0B1526" });
    window.open(url, "_blank");
  }
  async function shareText(title, text, url) {
    haptic.tap();
    try {
      if (P.Share) return await P.Share.share({ title, text, url, dialogTitle: title });
      if (navigator.share) return await navigator.share({ title, text, url });
      toast("Sharing isn't available here");
    } catch (e) { /* user cancelled */ }
  }
  function statusBar(dark) {
    try { P.StatusBar && P.StatusBar.setStyle({ style: dark ? "DARK" : "LIGHT" }); } catch (e) {}
  }
  const bio = {
    async available() {
      try {
        if (!P.NativeBiometric) return null;
        const r = await P.NativeBiometric.isAvailable();
        if (!r || !r.isAvailable) return null;
        return r.biometryType === 1 ? "Touch ID" : "Face ID";
      } catch (e) { return null; }
    },
    async verify(reason) {
      try {
        await P.NativeBiometric.verifyIdentity({ reason, title: "CRNA Critics", subtitle: reason, useFallback: true });
        return true;
      } catch (e) { return false; }
    },
  };

  // ---------------------------------------------------------------- state
  const S = {
    token: null, me: null, reviews: [], access: { unlocked: true }, cachedAt: null,
    entities: [], byKey: new Map(),
    tab: "search", stacks: { search: [{ v: "search" }], saved: [{ v: "saved" }], rate: [{ v: "rate" }], inbox: [{ v: "inbox" }], account: [{ v: "account" }] },
    saved: [], online: true, unread: 0, loading: false,
    q: "", kind: "all", bioName: null, bioOn: false, locked: false,
    conversations: null, msgSettings: null, versions: { terms: "", guidelines: "" },
    rf: null, guest: [{ v: "welcome" }],
  };

  // ---------------------------------------------------------------- API
  async function api(path, opts = {}) {
    const headers = { "Content-Type": "application/json", Accept: "application/json", "X-CRNA-App": "ios" };
    if (S.token) headers.Authorization = "Bearer " + S.token;
    let res;
    try {
      res = await fetch(SITE + path, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined, credentials: "include" });
    } catch (e) {
      const err = new Error("offline"); err.offline = true; throw err;
    }
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      const err = new Error(data.error || "http_" + res.status);
      err.status = res.status; err.data = data;
      if (res.status === 401 && path !== "/api/auth/login" && ["not_signed_in", "not_approved", "access_expired"].includes(data.error)) {
        await signOut(true);
        toast(data.error === "access_expired" ? "Your student access has expired." : "Please sign in again.");
      }
      throw err;
    }
    return data;
  }
  async function loadVersions() {
    const pick = async (file) => {
      try {
        const r = await fetch(SITE + "/" + file);
        const t = await r.text();
        const m = t.match(/version:\s*"([^"]+)"/);
        return m ? m[1] : "";
      } catch (e) { return ""; }
    };
    const [terms, guidelines] = await Promise.all([pick("terms.js"), pick("guidelines.js")]);
    S.versions = { terms: terms || S.versions.terms, guidelines: guidelines || S.versions.guidelines };
    store.set("versions", S.versions);
  }

  // ---------------------------------------------------------------- data shaping
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  function weighted(cats, values) {
    let sum = 0, w = 0;
    cats.forEach((c) => { const v = values && values[c.key]; if (v > 0) { sum += v * c.weight; w += c.weight; } });
    return w > 0 ? sum / w : 0;
  }
  const KINDS = {
    hospital: { label: "Hospital", plural: "Hospitals", cats: () => HOSPITAL_CATEGORIES, color: "#2563EB" },
    agency: { label: "Staffing agency", plural: "Agencies", cats: () => AGENCY_CATEGORIES, color: "#13A15A" },
    agent: { label: "Recruiter", plural: "Recruiters", cats: () => AGENT_CATEGORIES, color: "#7C3AED" },
    group: { label: "Anesthesia group", plural: "Groups", cats: () => GROUP_CATEGORIES, color: "#D97706" },
  };
  function buildEntities() {
    const map = new Map();
    const add = (type, name, extra, item) => {
      if (!String(name || "").trim()) return;
      const key = type + "|" + norm(name) + (type === "hospital" ? "|" + norm(extra.state) : "");
      let e = map.get(key);
      if (!e) { e = { key, type, name: name.trim(), city: extra.city || "", state: extra.state || "", sub: extra.sub || "", items: [] }; map.set(key, e); }
      if (!e.city && extra.city) e.city = extra.city;
      if (!e.sub && extra.sub) e.sub = extra.sub;
      e.items.push(item);
    };
    S.reviews.forEach((r) => {
      if (r.hospitalName) add("hospital", r.hospitalName, { city: r.hospitalCity, state: r.hospitalState }, { r, ratings: r.hospitalRatings || {}, wr: r.hospitalWouldReturn, comment: r.hospitalComment });
      if (r.agencyName) add("agency", r.agencyName, {}, { r, ratings: r.agencyAgentRatings || {}, wr: r.agencyAgentWouldReturn, comment: r.agencyAgentComment });
      if (r.agentName) add("agent", r.agentName, { sub: r.agencyName }, { r, ratings: r.agentRatings || {}, wr: r.agentWouldReturn, comment: r.agentComment });
      if (r.groupName) add("group", r.groupName, {}, { r, ratings: r.groupRatings || {}, wr: r.groupWouldReturn, comment: r.groupComment });
    });
    S.entities = [...map.values()].map((e) => {
      const cats = KINDS[e.type].cats();
      const scores = e.items.map((it) => weighted(cats, it.ratings)).filter((x) => x > 0);
      e.score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      e.catAvg = cats.map((c) => {
        const vals = e.items.map((it) => it.ratings[c.key]).filter((v) => v > 0);
        return { c, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, n: vals.length };
      });
      const wr = e.items.map((it) => it.wr).filter(Boolean);
      e.returnPct = wr.length ? Math.round((wr.filter((x) => x === "Y").length / wr.length) * 100) : null;
      e.items.sort((a, b) => String(b.r.date).localeCompare(String(a.r.date)));
      e.latest = e.items[0] ? e.items[0].r.date : "";
      return e;
    }).sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
    S.byKey = new Map(S.entities.map((e) => [e.key, e]));
  }

  async function refreshReviews(quiet) {
    if (!S.token) return;
    S.loading = !S.reviews.length && !quiet;
    if (S.loading) render();
    try {
      const data = await api("/api/reviews");
      S.reviews = data.reviews || [];
      S.access = data.access || { unlocked: true };
      S.cachedAt = new Date().toISOString();
      buildEntities();
      store.set("reviews_cache", { reviews: S.reviews, access: S.access, at: S.cachedAt });
    } catch (e) {
      if (e.offline) S.online = false;
    }
    S.loading = false;
    render();
  }
  async function refreshUnread() {
    if (!S.token) return;
    try { const d = await api("/api/messages/unread"); S.unread = d.unread || 0; renderTabbar(); } catch (e) {}
  }

  // ---------------------------------------------------------------- utils
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
  const fmtTime = (iso) => { const d = new Date(iso); if (isNaN(d)) return ""; const now = new Date(); return d.toDateString() === now.toDateString() ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const scoreClass = (s) => (s <= 0 ? "none" : s >= 4 ? "" : s >= 3 ? "mid" : "low");
  const scoreText = (s) => (s > 0 ? s.toFixed(1) : "—");
  const starsText = (s) => { const n = Math.round(s); return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); };
  const locOf = (e) => [e.city, e.state].filter(Boolean).join(", ");
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---------------------------------------------------------------- icons (SF Symbols-style outlines)
  const I = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    bookmarkFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
    rate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.3l-5.2 2.8 1-5.8L3.5 9.2l5.9-.8z"/><path d="M12 9v5M9.5 11.5h5" stroke-linecap="round"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m1 1 6 6-6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    face: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M9 9v1M15 9v1M12 9v4h-1M9 16c1.7 1.3 4.3 1.3 6 0"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5" stroke-linecap="round"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9zM4 4l16 16"/></svg>',
  };
  const logo = '<svg class="logo" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#13A15A"/><path d="M32 12 16 18v12c0 10 7 18 16 21 9-3 16-11 16-21V18z" fill="#0B1526"/><path d="m32 22 3 6.2 6.8 1-4.9 4.8 1.2 6.8L32 37.6l-6.1 3.2 1.2-6.8-4.9-4.8 6.8-1z" fill="#E8A317"/></svg>';

  // ---------------------------------------------------------------- navigation
  const stack = () => (S.token ? S.stacks[S.tab] : S.guest);
  const top = () => stack()[stack().length - 1];
  function push(view) { haptic.tap(); stack().push(view); render(); scrollTop(); }
  function pop() { if (stack().length > 1) { stack().pop(); render(); } }
  function setTab(tab) {
    haptic.pick();
    if (S.tab === tab) { S.stacks[tab] = [S.stacks[tab][0]]; }
    S.tab = tab;
    if (tab === "inbox") loadInbox();
    if (tab === "rate" && !S.rf) resetRateForm();
    render(); scrollTop();
  }
  function scrollTop() { const s = document.querySelector(".scroll"); if (s) s.scrollTop = 0; }

  function navbar({ title, large, back, actions, extra }) {
    return `<div class="navbar">
      ${large && !back && !actions ? "" : `<div class="row">
        ${back ? `<button class="back" data-act="back">${I.back}<span>${esc(back)}</span></button>` : "<span style='min-width:70px'></span>"}
        ${large ? "" : `<div class="title-sm">${esc(title)}</div>`}
        <div class="actions">${actions || ""}</div>
      </div>`}
      ${large ? `<div class="large-title">${esc(title)}</div>` : ""}
      ${extra || ""}
    </div>`;
  }
  const offlineBanner = () => (S.online ? "" : `<div class="banner off">You're offline. Showing reviews saved on this iPhone${S.cachedAt ? " from " + fmtDate(S.cachedAt) : ""}.</div>`);

  // ---------------------------------------------------------------- render
  function render() {
    const app = document.getElementById("app");
    const v = top();
    let html = "";
    if (!S.token) {
      statusBar(v.v === "welcome");
      html = v.v === "signin" ? viewSignIn() : v.v === "request" ? viewRequest() : v.v === "requested" ? viewRequested() : viewWelcome();
      app.innerHTML = html;
      return;
    }
    statusBar(false);
    const views = {
      search: viewSearch, entity: viewEntity, saved: viewSaved, rate: viewRate, inbox: viewInbox, thread: viewThread,
      account: viewAccount, settings: viewMsgSettings,
    };
    html = (views[v.v] || viewSearch)(v);
    app.innerHTML = html + tabbarHtml() + (S.locked ? lockHtml() : "");
    afterRender(v);
  }
  function renderTabbar() {
    const t = document.querySelector(".tabbar");
    if (t) t.outerHTML = tabbarHtml();
  }
  function tabbarHtml() {
    const tabs = [["search", "Search", I.search], ["saved", "Saved", I.bookmark], ["rate", "Rate", I.rate], ["inbox", "Inbox", I.inbox], ["account", "Account", I.person]];
    return `<nav class="tabbar">${tabs.map(([k, l, ic]) => `<button data-tab="${k}" class="${S.tab === k ? "on" : ""}" aria-label="${l}">${ic}<span>${l}</span>${k === "inbox" && S.unread ? `<span class="dot">${S.unread}</span>` : ""}</button>`).join("")}</nav>`;
  }
  function lockHtml() {
    return `<div class="lock">${logo}<div style="font-size:20px;font-weight:600">CRNA Critics is locked</div><button class="btn" data-act="unlock">Unlock with ${esc(S.bioName || "Face ID")}</button></div>`;
  }

  // ---------------------------------------------------------------- guest views
  function viewWelcome() {
    return `<div class="welcome">
      ${logo}
      <div class="tag-line" style="margin-top:22px">Know before you sign</div>
      <h1>CRNA Critics</h1>
      <p>Anonymous reviews of staffing agencies, recruiters, anesthesia groups and hospitals, written by verified CRNAs.</p>
      <ul>
        <li>${I.shield}<span>Every member is checked against their NBCRNA credential. Your name is never shown on a review.</span></li>
        <li>${I.star}<span>Category scores for pay accuracy, contract terms, staffing, autonomy and more.</span></li>
        <li>${I.bookmark}<span>Save places you're considering and read them offline, even in the OR break room.</span></li>
      </ul>
      <div class="spacer"></div>
      <button class="btn" data-go="signin">Sign in</button>
      <button class="btn secondary" data-go="request">Request access</button>
      <div class="links"><button data-url="${SITE}/privacy">Privacy Policy</button> &nbsp;·&nbsp; <button data-url="${SITE}/#terms">Terms of Use</button></div>
    </div>`;
  }
  function viewSignIn() {
    return `<div class="screen">${navbar({ title: "Sign in", back: "Back" })}
      <div class="scroll">
        <div class="section-title">Your CRNA Critics account</div>
        <div class="list">
          <div class="field"><label for="si-email">Email</label><input id="si-email" type="email" autocomplete="username" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
          <div class="field"><label for="si-pass">Password</label><input id="si-pass" type="password" autocomplete="current-password"></div>
        </div>
        <div class="err" id="si-err"></div>
        <button class="btn" data-act="signin">Sign in</button>
        <div class="section-title">No password yet?</div>
        <div class="footnote">Approved members who haven't created a password can get a one-time link by email. It opens crnacritics.com, where you set a password; then come back and sign in here.</div>
        <button class="btn secondary" data-act="emaillink">Email me a link</button>
        <div class="footnote" style="margin-top:18px">Not a member yet? <a href="#" data-go="request">Request access</a> with your NBCRNA number.</div>
      </div></div>`;
  }
  function viewRequest() {
    return `<div class="screen">${navbar({ title: "Request access", back: "Back" })}
      <div class="scroll">
        <div class="footnote" style="margin-top:14px">Membership is free and open to every certified CRNA in the U.S. Your name and NBCRNA number must match your credential; we check it before approving. Your name is never shown on reviews.</div>
        <div class="section-title">About you</div>
        <div class="list">
          <div class="field"><label for="rq-first">First name</label><input id="rq-first" autocomplete="given-name"></div>
          <div class="field"><label for="rq-last">Last name</label><input id="rq-last" autocomplete="family-name"></div>
          <div class="field"><label for="rq-nbcrna">NBCRNA certification number</label><input id="rq-nbcrna" inputmode="numeric"></div>
          <div class="field"><label for="rq-email">Email</label><input id="rq-email" type="email" inputmode="email" autocapitalize="off" autocorrect="off" autocomplete="email"></div>
          <div class="field"><label for="rq-phone">Mobile phone</label><input id="rq-phone" type="tel" inputmode="tel" autocomplete="tel"></div>
          <div class="field"><label for="rq-role">I am a…</label><select id="rq-role">
            <option value="">Choose one</option>
            <option value="practicing">Practicing CRNA</option>
            <option value="chief">Chief CRNA / department lead (read-only)</option>
            <option value="recruiter">CRNA who recruits or works for an agency (read-only)</option>
            <option value="owner">Owns or manages an anesthesia group (read-only)</option>
          </select></div>
        </div>
        <div class="list" style="margin-top:14px">
          <button class="check" data-act="toggle-terms"><span class="box" id="rq-terms-box">${""}</span><span>I agree to the <a href="#" data-url="${SITE}/#terms">Terms of Use &amp; Member Agreement</a> and the <a href="#" data-url="${SITE}/privacy">Privacy Policy</a>.</span></button>
        </div>
        <div class="err" id="rq-err"></div>
        <button class="btn" data-act="request">Send request</button>
        <div class="footnote" style="margin-top:16px">Nurse anesthesia student? <a href="#" data-url="${SITE}/">Request student access on crnacritics.com</a>.</div>
      </div></div>`;
  }
  function viewRequested() {
    return `<div class="screen">${navbar({ title: "Request sent" })}
      <div class="scroll"><div class="empty">${I.check}<div class="big">Request received</div>We check your NBCRNA credential, usually within a day. When you're approved you'll get an email with a link to create your password. Then sign in here.</div>
      <button class="btn" data-act="home">Done</button></div></div>`;
  }

  // ---------------------------------------------------------------- search
  function filteredEntities() {
    const q = norm(S.q);
    return S.entities.filter((e) => (S.kind === "all" || e.type === S.kind) && (!q || norm(e.name + " " + e.city + " " + e.state + " " + e.sub).includes(q)));
  }
  function accessBanner() {
    const a = S.access || {};
    if (a.unlocked === false) return `<div class="banner warn"><strong>Reviews are locked.</strong> Names and locations are still searchable. Post one review of your own to unlock every rating and comment.<button data-tab="rate">Write a review</button></div>`;
    if (a.reason === "trial" && a.daysLeft) return `<div class="banner info">You have full access for ${a.daysLeft} more day${a.daysLeft === 1 ? "" : "s"}. Post a review to keep it.</div>`;
    return "";
  }
  function entityCell(e) {
    const k = KINDS[e.type];
    const sub = [k.label, e.type === "agent" && e.sub ? e.sub : locOf(e), e.items.length + " review" + (e.items.length === 1 ? "" : "s")].filter(Boolean).join(" · ");
    return `<button class="cell" data-entity="${esc(e.key)}">
      <span class="icon" style="background:${k.color}">${e.type === "hospital" ? I.doc : e.type === "agent" ? I.person : e.type === "group" ? I.shield : I.globe}</span>
      <span class="main"><div class="t">${esc(e.name)}</div><div class="s">${esc(sub)}</div></span>
      <span class="score-pill ${scoreClass(e.score)}">${scoreText(e.score)}</span>${I.chev}</button>`;
  }
  function searchResults() {
    const list = filteredEntities();
    return S.loading ? '<div class="spinner"></div>'
      : !S.entities.length ? `<div class="empty">${I.search}<div class="big">No reviews yet</div>Pull down to refresh.</div>`
      : !list.length ? `<div class="empty">${I.search}<div class="big">No matches</div>Try another spelling, or be the first to <a href="#" data-tab="rate">review it</a>.</div>`
      : `<div class="section-title">${list.length} ${S.kind === "all" ? "places and people" : KINDS[S.kind].plural.toLowerCase()}</div><div class="list">${list.slice(0, 300).map(entityCell).join("")}</div>`;
  }
  function viewSearch() {
    const kinds = [["all", "All"], ["hospital", "Hospitals"], ["agency", "Agencies"], ["agent", "Recruiters"], ["group", "Groups"]];
    const body = `<div id="results">${searchResults()}</div>`;
    return `<div class="screen has-tabs">${navbar({
      title: "Search", large: true,
      extra: `<div class="searchbar">${I.search}<input id="q" type="search" placeholder="Hospital, agency, recruiter, city…" value="${esc(S.q)}" autocomplete="off" autocorrect="off" enterkeyhint="search"></div>
      <div class="segmented">${kinds.map(([k, l]) => `<button data-kind="${k}" class="${S.kind === k ? "on" : ""}">${l}</button>`).join("")}</div>`,
    })}<div class="scroll" id="scroller"><div class="ptr" id="ptr">Release to refresh</div>${offlineBanner()}${accessBanner()}${body}</div></div>`;
  }

  // ---------------------------------------------------------------- entity detail
  function isSaved(key) { return S.saved.some((s) => s.key === key); }
  function viewEntity(v) {
    const e = S.byKey.get(v.key);
    if (!e) return `<div class="screen has-tabs">${navbar({ title: "", back: "Back" })}<div class="scroll"><div class="empty">This listing isn't available right now.</div></div></div>`;
    const k = KINDS[e.type];
    const locked = S.access && S.access.unlocked === false;
    const saved = isSaved(e.key);
    const actions = `<button data-act="save" aria-label="${saved ? "Remove from saved" : "Save"}">${saved ? I.bookmarkFill : I.bookmark}</button><button data-act="share-entity" aria-label="Share">${I.share}</button>`;
    const bars = e.catAvg.filter((x) => x.n).map((x) => `<div class="bar"><span>${esc(x.c.label)}</span><span class="track"><span class="fill" style="width:${(x.avg / 5) * 100}%"></span></span><span class="num">${x.avg.toFixed(1)}</span></div>`).join("");
    const reviews = e.items.map((it) => reviewCard(e, it, locked)).join("");
    return `<div class="screen has-tabs">${navbar({ title: e.name, back: v.from || "Search", actions })}
      <div class="scroll" id="scroller">${offlineBanner()}
        <div class="hero"><div class="kind">${esc(k.label)}</div><div class="name">${esc(e.name)}</div>
          <div class="loc">${esc(e.type === "agent" && e.sub ? "Works with " + e.sub : locOf(e))}</div>
          <div class="stats">
            <div><div class="big">${locked ? "🔒" : scoreText(e.score)}</div><div class="lbl">${locked ? "Locked" : "Overall"}</div></div>
            <div><div class="big" style="font-size:28px">${e.items.length}</div><div class="lbl">Review${e.items.length === 1 ? "" : "s"}</div></div>
            ${e.returnPct != null && !locked ? `<div><div class="big" style="font-size:28px">${e.returnPct}%</div><div class="lbl">Would return</div></div>` : ""}
          </div></div>
        ${locked ? accessBanner() : bars ? `<div class="section-title">Category scores</div><div class="list bars">${bars}</div>` : ""}
        <div class="section-title">Reviews</div>${reviews}
        <button class="btn secondary" data-act="rate-this">Review ${esc(e.name)}</button>
      </div></div>`;
  }
  function reviewCard(e, it, locked) {
    const r = it.r;
    const s = weighted(KINDS[e.type].cats(), it.ratings);
    const about = [];
    if (e.type !== "hospital" && r.hospitalName) about.push("at " + r.hospitalName);
    if (e.type !== "agency" && r.agencyName) about.push("through " + r.agencyName);
    if (e.type === "hospital" && r.groupName) about.push("with " + r.groupName);
    const tags = [];
    if (it.wr) tags.push(`<span class="tag ${it.wr === "Y" ? "y" : it.wr === "N" ? "n" : "m"}">${it.wr === "Y" ? "Would return" : it.wr === "N" ? "Would not return" : "Maybe"}</span>`);
    if (e.type === "agency" && r.payRange) tags.push(`<span class="tag">${esc(r.payRange)}/hr</span>`);
    if (e.type === "agency" && r.travelCovered) tags.push(`<span class="tag">${esc(r.travelCovered)}</span>`);
    if (e.type === "group" && r.staffPayRange) tags.push(`<span class="tag">${esc(r.staffPayRange)}</span>`);
    tags.push(`<span class="tag">${r.employmentType === "staff" ? "Staff" : "Locum"}</span>`);
    const acts = [];
    if (!locked && !r.isMine && r.acceptsQuestions && !(S.me && S.me.role === "srna")) acts.push(`<button data-act="ask" data-id="${esc(r.id)}">Ask this reviewer</button>`);
    if (!r.isMine && !(S.me && S.me.readOnly)) acts.push(`<button class="muted" data-act="report" data-id="${esc(r.id)}">Report</button>`);
    if (r.isMine) acts.push(`<button class="muted" data-act="delete-review" data-id="${esc(r.id)}">Delete my review</button>`);
    return `<div class="review">
      <div class="top"><div><div class="who">${r.isMine ? "Your review" : "Anonymous CRNA"}</div><div class="date">${fmtDate(r.date)}${r.editedAt ? " · edited" : ""}</div></div>
        ${r.locked ? "" : `<span class="score-pill ${scoreClass(s)}">${scoreText(s)}</span>`}</div>
      ${about.length ? `<div class="about">${esc(about.join(" · "))}</div>` : ""}
      ${r.locked ? `<div class="locked-note">${I.lock}Ratings and comments unlock when you post a review.</div>`
        : `${s > 0 ? `<div class="stars" style="margin-top:6px">${starsText(s)}</div>` : ""}${it.comment ? `<div class="comment">${esc(it.comment)}</div>` : ""}<div class="meta">${tags.join("")}</div>`}
      ${acts.length ? `<div class="acts">${acts.join("")}</div>` : ""}
    </div>`;
  }

  // ---------------------------------------------------------------- saved
  async function toggleSave(e) {
    if (isSaved(e.key)) { S.saved = S.saved.filter((s) => s.key !== e.key); toast("Removed from Saved"); }
    else { S.saved.unshift({ key: e.key, type: e.type, name: e.name, loc: locOf(e) || e.sub, at: new Date().toISOString() }); haptic.ok(); toast("Saved — available offline"); }
    await store.set("saved", S.saved);
    render();
  }
  function viewSaved() {
    const rows = S.saved.map((s) => {
      const e = S.byKey.get(s.key);
      if (e) return entityCell(e);
      return `<div class="cell"><span class="main"><div class="t">${esc(s.name)}</div><div class="s">${esc(KINDS[s.type] ? KINDS[s.type].label : "")} · no longer listed</div></span><button data-act="unsave" data-key="${esc(s.key)}" style="color:var(--red);font-size:15px">Remove</button></div>`;
    }).join("");
    return `<div class="screen has-tabs">${navbar({ title: "Saved", large: true })}
      <div class="scroll">${offlineBanner()}
        ${S.saved.length ? `<div class="section-title">Places you're considering</div><div class="list">${rows}</div><div class="footnote">Saved places and their reviews are stored on this iPhone, so you can read them without a connection.</div>`
        : `<div class="empty">${I.bookmark}<div class="big">Nothing saved yet</div>Tap the bookmark on any hospital, agency, recruiter or group to keep it here — and readable offline.</div>`}
      </div></div>`;
  }

  // ---------------------------------------------------------------- rate (native review form)
  function resetRateForm(kind, name) {
    S.rf = { kind: kind || "", emp: "locum", name: name || "", city: "", state: "", ratings: {}, wr: "", comment: "", payRange: "", accepted: false, err: "" };
  }
  function rateCats() { return S.rf.kind ? KINDS[S.rf.kind].cats() : []; }
  function viewRate() {
    const me = S.me || {};
    if (me.readOnly) {
      return `<div class="screen has-tabs">${navbar({ title: "Rate", large: true })}<div class="scroll"><div class="empty">${I.lock}<div class="big">Read-only account</div>${me.role === "srna" ? "Student accounts can read every review. Posting is for practicing CRNAs." : "Your account can read reviews but not post them, because of the role you declared when you joined."}</div></div></div>`;
    }
    const f = S.rf;
    const kinds = [["hospital", "Hospital"], ["agency", "Agency"], ["agent", "Recruiter"], ["group", "Group"]];
    let form = "";
    if (f.kind) {
      const label = f.kind === "hospital" ? "Hospital name" : f.kind === "agency" ? "Agency name" : f.kind === "agent" ? "Recruiter's full name" : "Anesthesia group name";
      form += `<div class="section-title">Who</div><div class="list">
        <div class="field"><label for="rf-name">${label}</label><input id="rf-name" value="${esc(f.name)}" autocomplete="off" autocorrect="off"></div>
        ${f.kind === "hospital" ? `<div class="field"><label for="rf-city">City</label><input id="rf-city" value="${esc(f.city)}"></div>
          <div class="field"><label for="rf-state">State</label><select id="rf-state"><option value="">Choose</option>${US_STATES.map((s) => `<option ${f.state === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>` : ""}
      </div><div class="suggest" id="rf-suggest"></div>`;
      if (f.kind === "hospital") {
        form += `<div class="section-title">You worked there as</div><div class="choice">${[["locum", "Locum"], ["staff", "Staff"]].map(([k, l]) => `<button data-emp="${k}" class="${f.emp === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
      }
      form += `<div class="section-title">Rate each category</div><div class="footnote" style="margin:0 20px 8px">Tap 1–5 stars, or N/A if it didn't apply to you.</div><div class="list">${rateCats().map((c) => {
        const v = f.ratings[c.key] || 0;
        return `<div class="rate-row"><div class="lab">${esc(c.label)}</div><div class="hint">${esc(c.hint)}</div><div class="pick">
          ${[1, 2, 3, 4, 5].map((n) => `<button class="star ${v >= n ? "on" : ""}" data-rate="${c.key}" data-n="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">${I.star}</button>`).join("")}
          <button class="na ${v === NA ? "on" : ""}" data-rate="${c.key}" data-n="${NA}">N/A</button></div></div>`;
      }).join("")}</div>`;
      if (f.kind === "agency") {
        form += `<div class="section-title">Hourly rate (optional, never scored)</div><div class="chips" style="flex-wrap:wrap;padding:0 16px">${PAY_RANGES.map((p) => `<button class="chip ${f.payRange === p ? "on" : ""}" data-pay="${esc(p)}">${esc(p)}</button>`).join("")}</div>`;
      }
      form += `<div class="section-title">Would you go back?</div><div class="choice">${[["Y", "Yes"], ["Maybe", "Maybe"], ["N", "No"]].map(([k, l]) => `<button data-wr="${k}" class="${f.wr === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <div class="section-title">What should other CRNAs know?</div><div class="list"><div class="field"><textarea id="rf-comment" placeholder="Facts about your own experience. No names of staff, no patient details.">${esc(f.comment)}</textarea></div></div>
        <div class="list" style="margin-top:14px"><button class="check" data-act="toggle-guidelines"><span class="box ${f.accepted ? "on" : ""}">${f.accepted ? I.check : ""}</span><span>This is my own first-hand experience and follows the <a href="#" data-url="${SITE}/#guidelines">review guidelines</a>. It will be posted anonymously.</span></button></div>
        <div class="err" id="rf-err">${esc(f.err)}</div>
        <button class="btn" data-act="submit-review">Post review</button>`;
    }
    return `<div class="screen has-tabs">${navbar({ title: "Write a review", large: true })}
      <div class="scroll">${S.access && S.access.unlocked === false ? `<div class="banner warn">Post one review to unlock every rating and comment on CRNA Critics.</div>` : ""}
        <div class="section-title">What are you reviewing?</div>
        <div class="choice">${kinds.map(([k, l]) => `<button data-kind-rate="${k}" class="${f.kind === k ? "on" : ""}">${l}</button>`).join("")}</div>
        ${f.kind ? form : `<div class="footnote">Pick one. You can post a separate review for each place or person you worked with. Reviews are always anonymous.</div>`}
      </div></div>`;
  }
  function readRateInputs() {
    const f = S.rf; if (!f) return;
    const g = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
    if (g("rf-name") != null) f.name = g("rf-name");
    if (g("rf-city") != null) f.city = g("rf-city");
    if (g("rf-state") != null) f.state = g("rf-state");
    if (g("rf-comment") != null) f.comment = g("rf-comment");
  }
  async function submitReview() {
    readRateInputs();
    const f = S.rf;
    const name = f.name.trim();
    const cats = rateCats();
    const what = f.kind === "hospital" ? "the hospital" : f.kind === "agency" ? "the agency" : f.kind === "agent" ? "the recruiter" : "the group";
    const fail = (msg) => { f.err = msg; haptic.warn(); render(); const el = document.getElementById("rf-err"); if (el) el.scrollIntoView({ block: "center" }); };
    if (!name) return fail(`Enter the full name of ${what}.`);
    if (f.kind === "hospital" && !f.state) return fail("Choose the hospital's state.");
    if (!cats.every((c) => f.ratings[c.key] > 0 || f.ratings[c.key] === NA)) return fail(`Rate every category for ${what} — stars, or N/A.`);
    if (!cats.some((c) => f.ratings[c.key] > 0)) return fail("Give at least one star rating — every category can't be N/A.");
    if (!f.accepted) return fail("Confirm this is your own experience and follows the guidelines.");
    const emp = f.kind === "group" ? "staff" : f.kind === "hospital" ? f.emp : "locum";
    const body = { employmentType: emp, anonymous: true, acceptedGuidelines: true, guidelinesVersion: S.versions.guidelines || "" };
    if (f.kind === "hospital") Object.assign(body, { hospitalName: name, hospitalCity: f.city.trim(), hospitalState: f.state, hospitalRatings: f.ratings, hospitalWouldReturn: f.wr, hospitalComment: f.comment.trim() });
    if (f.kind === "agency") Object.assign(body, { agencyName: name, agencyAgentRatings: f.ratings, agencyAgentWouldReturn: f.wr, agencyAgentComment: f.comment.trim(), payRange: f.payRange });
    if (f.kind === "agent") Object.assign(body, { agentName: name, agentRatings: f.ratings, agentWouldReturn: f.wr, agentComment: f.comment.trim() });
    if (f.kind === "group") Object.assign(body, { groupName: name, groupRatings: f.ratings, groupWouldReturn: f.wr, groupComment: f.comment.trim() });
    try {
      await api("/api/reviews", { method: "POST", body });
      haptic.ok();
      toast("Review posted. Thank you!");
      const kind = f.kind;
      resetRateForm();
      await refreshReviews(true);
      const e = S.entities.find((x) => x.type === kind && norm(x.name) === norm(name));
      if (e) { S.tab = "search"; S.stacks.search = [{ v: "search" }, { v: "entity", key: e.key }]; }
      render();
    } catch (err) {
      fail(err.offline ? "You're offline. Your review is still here — post it when you're back online." : err.message === "read_only" || err.message === "student_read_only" ? "Your account is read-only." : "Couldn't post the review. Check every category and try again.");
    }
  }

  // ---------------------------------------------------------------- inbox
  async function loadInbox() {
    try {
      const d = await api("/api/messages");
      S.conversations = d.conversations || [];
      S.msgSettings = d.settings || null;
      S.unread = d.unread || 0;
      store.set("inbox_cache", S.conversations);
    } catch (e) {
      if (e.offline) { S.online = false; S.conversations = S.conversations || (await store.get("inbox_cache", [])); }
    }
    if (S.tab === "inbox") render(); else renderTabbar();
  }
  function viewInbox() {
    const list = S.conversations;
    const body = list == null ? '<div class="spinner"></div>'
      : !list.length ? `<div class="empty">${I.chat}<div class="big">No messages</div>When you ask a reviewer a question, or someone asks about your review, the conversation shows up here. Names and emails are never shared.</div>`
      : `<div class="section-title">Private conversations</div><div class="list">${list.map((c) => `<button class="cell" data-thread="${esc(c.id)}">
          <span class="main"><div class="t" style="${c.unread ? "font-weight:600" : ""}">${esc(c.subject)}</div><div class="s">${c.lastFromMe ? "You: " : ""}${esc(c.preview)}</div></span>
          <span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="value" style="font-size:13px">${fmtTime(c.lastMessageAt)}</span>${c.unread ? `<span class="badge-count">${c.unread}</span>` : ""}</span>${I.chev}</button>`).join("")}</div>
        <div class="footnote">Both sides stay anonymous. You can report or close any conversation.</div>`;
    return `<div class="screen has-tabs">${navbar({ title: "Inbox", large: true, actions: `<button data-go-settings="1" aria-label="Message settings">${I.bell}</button>` })}<div class="scroll" id="scroller"><div class="ptr" id="ptr">Release to refresh</div>${offlineBanner()}${body}</div></div>`;
  }
  async function openThread(id) {
    push({ v: "thread", id, data: null });
    try {
      const d = await api("/api/messages/" + encodeURIComponent(id));
      const v = top(); if (v.v === "thread" && v.id === id) { v.data = d; render(); scrollThread(); }
      loadInbox();
    } catch (e) { toast(e.offline ? "You're offline." : "Couldn't open this conversation."); }
  }
  function scrollThread() { const s = document.querySelector(".scroll"); if (s) s.scrollTop = s.scrollHeight; }
  function viewThread(v) {
    const d = v.data;
    const c = d && d.conversation;
    const actions = c ? `<button data-act="thread-more" aria-label="More">•••</button>` : "";
    let body = '<div class="spinner"></div>';
    if (d) {
      let last = "";
      body = `<div class="thread">${d.messages.map((m) => {
        const day = fmtDate(m.createdAt); const stamp = day !== last ? `<div class="stamp">${day}</div>` : ""; last = day;
        return stamp + `<div class="bubble ${m.removed ? "removed" : m.mine ? "me" : "them"}">${m.removed ? "Message removed by CRNA Critics" : esc(m.body)}</div>`;
      }).join("")}</div>`;
    }
    const closed = c && c.closed;
    const composer = d ? (closed ? `<div class="composer" style="justify-content:center;color:var(--muted);font-size:14px">This conversation is closed.</div>`
      : `<div class="composer"><textarea id="reply" rows="1" placeholder="Message"></textarea><button data-act="send-reply" aria-label="Send">${I.send}</button></div>`) : "";
    return `<div class="screen has-tabs">${navbar({ title: c ? c.subject : "Conversation", back: "Inbox", actions })}<div class="scroll">${body}</div>${composer}</div>`;
  }
  async function sendReply(anyway) {
    const v = top(); const ta = document.getElementById("reply");
    const text = (ta ? ta.value : v.pending || "").trim();
    if (!text) return;
    try {
      await api(`/api/messages/${encodeURIComponent(v.id)}/reply`, { method: "POST", body: { body: text, sendAnyway: !!anyway } });
      haptic.tap();
      const d = await api("/api/messages/" + encodeURIComponent(v.id));
      v.data = d; v.pending = ""; render(); scrollThread();
    } catch (e) {
      if (e.status === 409 && e.data && e.data.warnings) {
        v.pending = text;
        return guardSheet(e.data.warnings, () => sendReply(true));
      }
      toast(e.offline ? "You're offline." : e.message === "slow_down" ? "You're sending a lot. Try again later." : e.message === "closed" ? "This conversation is closed." : "Couldn't send.");
    }
  }

  // ---------------------------------------------------------------- account
  function viewAccount() {
    const me = S.me || {};
    const a = S.access || {};
    const accessLine = me.readOnly ? "Read-only member" : a.unlocked === false ? "Reviews locked — post a review to unlock" : a.reason === "trial" ? `Full access · ${a.daysLeft} day${a.daysLeft === 1 ? "" : "s"} left in your trial` : "Full access";
    const cell = (act, icon, color, t, extra, cls) => `<button class="cell ${cls || ""}" ${act}><span class="icon" style="background:${color}">${icon}</span><span class="main"><div class="t">${t}</div></span>${extra || I.chev}</button>`;
    return `<div class="screen has-tabs">${navbar({ title: "Account", large: true })}
      <div class="scroll">
        <div class="list" style="margin-top:8px"><div class="cell"><span class="icon" style="background:var(--navy);width:46px;height:46px;border-radius:23px;font-weight:700;font-size:18px">${esc((me.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join(""))}</span>
          <span class="main"><div class="t" style="font-weight:600">${esc(me.name || "")}</div><div class="s">${esc(me.credentials || "")}${me.declaredRole ? " · " + esc(me.declaredRole) : ""}</div><div class="s">${esc(accessLine)}</div></span></div></div>
        <div class="footnote">Only you see your name. Every review you post is anonymous.</div>
        <div class="section-title">Security</div>
        <div class="list">${S.bioName ? `<button class="cell" data-act="toggle-bio"><span class="icon" style="background:#34C759">${I.face}</span><span class="main"><div class="t">Lock with ${esc(S.bioName)}</div></span><span class="value">${S.bioOn ? "On" : "Off"}</span></button>`
          : `<div class="cell"><span class="icon" style="background:#8E8E93">${I.face}</span><span class="main"><div class="t">Face ID lock</div><div class="s">Not set up on this iPhone</div></span></div>`}</div>
        <div class="section-title">Messages</div>
        <div class="list">${cell('data-go-settings="1"', I.bell, "#FF9500", "Questions &amp; email alerts")}</div>
        <div class="section-title">About</div>
        <div class="list">
          ${cell(`data-url="${SITE}/#guidelines"`, I.doc, "#5856D6", "Review guidelines")}
          ${cell(`data-url="${SITE}/#terms"`, I.doc, "#8E8E93", "Terms of Use")}
          ${cell(`data-url="${SITE}/privacy"`, I.shield, "#0A84FF", "Privacy Policy")}
          ${cell('data-mail="1"', I.mail, "#13A15A", "Contact support")}
          ${cell(`data-url="${SITE}/"`, I.globe, "#0B1526", "crnacritics.com")}
        </div>
        <div class="list" style="margin-top:22px">
          ${cell('data-act="signout"', I.out, "#8E8E93", "Sign out", " ")}
          ${cell('data-act="delete-account"', I.trash, "#C0392B", "Delete my account", " ", "danger")}
        </div>
        <div class="footnote" style="text-align:center;margin-top:18px">CRNA Critics for iPhone · Medcrisis Anesthesia LLC</div>
      </div></div>`;
  }
  function viewMsgSettings() {
    const s = S.msgSettings || { acceptQuestions: true, messageEmails: true };
    const row = (k, t, d) => `<button class="cell" data-setting="${k}"><span class="main"><div class="t">${t}</div><div class="s" style="white-space:normal">${d}</div></span><span class="value">${s[k] ? "On" : "Off"}</span></button>`;
    return `<div class="screen has-tabs">${navbar({ title: "Message settings", back: "Back" })}<div class="scroll"><div class="list" style="margin-top:16px">
      ${row("acceptQuestions", "Let members ask about my reviews", "Other CRNAs can send you an anonymous question from a review you posted.")}
      ${row("messageEmails", "Email me when I get a message", "We email you a heads-up; the message itself stays in the app.")}
    </div></div></div>`;
  }

  // ---------------------------------------------------------------- sheets
  function sheet(html, onMount) {
    const wrap = document.createElement("div");
    wrap.className = "sheet-wrap";
    wrap.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
    wrap.addEventListener("click", (ev) => { if (ev.target === wrap) wrap.remove(); });
    document.body.appendChild(wrap);
    if (onMount) onMount(wrap);
    return wrap;
  }
  function confirmSheet(title, text, okLabel, danger) {
    return new Promise((resolve) => {
      const w = sheet(`<h3>${esc(title)}</h3><p>${text}</p><button class="btn ${danger ? "danger" : ""}" data-ok>${esc(okLabel)}</button><button class="btn secondary" data-cancel>Cancel</button>`);
      w.querySelector("[data-ok]").onclick = () => { w.remove(); resolve(true); };
      w.querySelector("[data-cancel]").onclick = () => { w.remove(); resolve(false); };
    });
  }
  function textSheet({ title, text, placeholder, okLabel, minLen }) {
    return new Promise((resolve) => {
      const w = sheet(`<h3>${esc(title)}</h3><p>${text}</p><div class="list" style="margin-top:10px"><div class="field"><textarea id="sheet-text" placeholder="${esc(placeholder || "")}"></textarea></div></div><div class="err" id="sheet-err"></div><button class="btn" data-ok>${esc(okLabel)}</button><button class="btn secondary" data-cancel>Cancel</button>`);
      const ta = w.querySelector("#sheet-text");
      setTimeout(() => ta.focus(), 250);
      w.querySelector("[data-ok]").onclick = () => {
        const v = ta.value.trim();
        if (v.length < (minLen || 1)) { w.querySelector("#sheet-err").textContent = minLen > 1 ? `Please write at least ${minLen} characters.` : "Write something first."; return; }
        w.remove(); resolve(v);
      };
      w.querySelector("[data-cancel]").onclick = () => { w.remove(); resolve(null); };
    });
  }
  function guardSheet(warnings, onSend) {
    haptic.warn();
    const w = sheet(`<h3>Before you send</h3>${warnings.map((x) => `<p><strong>${esc(x.label)}.</strong> ${esc(x.warning)}</p>`).join("")}<button class="btn" data-edit>Edit message</button><button class="btn secondary" data-send>Send anyway</button>`);
    w.querySelector("[data-edit]").onclick = () => w.remove();
    w.querySelector("[data-send]").onclick = () => { w.remove(); onSend(); };
  }

  async function askReviewer(reviewId, preset, anyway) {
    const text = preset || await textSheet({ title: "Ask this reviewer", text: "Your question goes to the reviewer privately. Neither of you sees the other's name or email.", placeholder: "e.g. Was call shared fairly with the staff CRNAs?", okLabel: "Send question" });
    if (!text) return;
    try {
      const d = await api("/api/messages", { method: "POST", body: { reviewId, body: text, sendAnyway: !!anyway } });
      haptic.ok(); toast("Question sent");
      S.tab = "inbox"; S.stacks.inbox = [{ v: "inbox" }];
      await loadInbox();
      if (d.conversationId) openThread(d.conversationId);
    } catch (e) {
      if (e.status === 409 && e.data && e.data.warnings) return guardSheet(e.data.warnings, () => askReviewer(reviewId, text, true));
      const m = { not_accepting: "This reviewer isn't taking questions.", too_many_today: "You've started a lot of conversations today. Try tomorrow.", reviews_locked: "Post a review to unlock questions.", reviewer_unavailable: "This reviewer's account is no longer active.", closed: "That conversation was closed." };
      toast(e.offline ? "You're offline." : m[e.message] || "Couldn't send your question.");
    }
  }
  async function reportReview(id) {
    const reason = await textSheet({ title: "Report this review", text: "Tell us why. For example: it reads like a recruiter or employer wrote it, it names staff, or it shares patient details. CRNA Critics reviews every report.", placeholder: "What's wrong with this review?", okLabel: "Send report", minLen: 10 });
    if (!reason) return;
    try { await api(`/api/reviews/${encodeURIComponent(id)}/report`, { method: "POST", body: { reason } }); haptic.ok(); toast("Thanks — we'll review it"); }
    catch (e) { toast(e.offline ? "You're offline." : "Couldn't send the report."); }
  }
  async function deleteReview(id) {
    if (!(await confirmSheet("Delete your review?", "It will be removed from CRNA Critics right away. This can't be undone.", "Delete review", true))) return;
    try {
      const d = await api(`/api/reviews/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast(d.locked ? "Deleted. Reviews are locked until you post another." : "Review deleted");
      await refreshReviews(true);
      if (top().v === "entity" && !S.byKey.get(top().key)) pop();
    } catch (e) { toast(e.offline ? "You're offline." : "Couldn't delete the review."); }
  }
  function threadMore() {
    const v = top(); const c = v.data && v.data.conversation; if (!c) return;
    const w = sheet(`<h3>${esc(c.subject)}</h3>
      <button class="btn secondary" data-report>Report this conversation</button>
      ${c.blockedByMe ? `<button class="btn secondary" data-reopen>Reopen conversation</button>` : `<button class="btn danger" data-block>Block &amp; close conversation</button>`}
      <button class="btn secondary" data-cancel>Cancel</button>`);
    w.querySelector("[data-cancel]").onclick = () => w.remove();
    w.querySelector("[data-report]").onclick = async () => {
      w.remove();
      const reason = await textSheet({ title: "Report conversation", text: "CRNA Critics will read this conversation and act on it. You can also block the other member.", placeholder: "What happened?", okLabel: "Send report" });
      if (!reason) return;
      const block = await confirmSheet("Also block this member?", "Blocking closes the conversation so they can't message you here again.", "Report and block", true);
      try { await api(`/api/messages/${encodeURIComponent(c.id)}/report`, { method: "POST", body: { reason, block } }); haptic.ok(); toast("Report sent"); openThreadRefresh(); }
      catch (e) { toast("Couldn't send the report."); }
    };
    const blk = w.querySelector("[data-block]"), rop = w.querySelector("[data-reopen]");
    if (blk) blk.onclick = async () => { w.remove(); try { await api(`/api/messages/${encodeURIComponent(c.id)}/block`, { method: "POST", body: { block: true } }); toast("Conversation closed"); openThreadRefresh(); } catch (e) { toast("Couldn't close it."); } };
    if (rop) rop.onclick = async () => { w.remove(); try { await api(`/api/messages/${encodeURIComponent(c.id)}/block`, { method: "POST", body: { block: false } }); toast("Conversation reopened"); openThreadRefresh(); } catch (e) { toast("Couldn't reopen it."); } };
  }
  async function openThreadRefresh() {
    const v = top(); if (v.v !== "thread") return;
    try { v.data = await api("/api/messages/" + encodeURIComponent(v.id)); render(); } catch (e) {}
    loadInbox();
  }
  async function deleteAccount() {
    let alsoReviews = false;
    const w = sheet(`<h3>Delete your account</h3>
      <p>This removes your name, email, phone number and NBCRNA number from CRNA Critics, and deletes your private messages. It can't be undone.</p>
      <div class="list" style="margin-top:10px"><button class="check" data-also><span class="box" id="also-box"></span><span>Also delete my reviews. If you leave this off, your reviews stay up, anonymous and no longer linked to you.</span></button></div>
      <p>Type DELETE to confirm.</p>
      <div class="list"><div class="field"><input id="del-confirm" autocapitalize="characters" autocorrect="off" placeholder="DELETE"></div></div>
      <div class="err" id="del-err"></div>
      <button class="btn danger" data-ok>Delete my account</button><button class="btn secondary" data-cancel>Cancel</button>`);
    w.querySelector("[data-also]").onclick = () => { alsoReviews = !alsoReviews; haptic.pick(); const b = w.querySelector("#also-box"); b.className = "box" + (alsoReviews ? " on" : ""); b.innerHTML = alsoReviews ? I.check : ""; };
    w.querySelector("[data-cancel]").onclick = () => w.remove();
    w.querySelector("[data-ok]").onclick = async () => {
      if (w.querySelector("#del-confirm").value.trim().toUpperCase() !== "DELETE") { w.querySelector("#del-err").textContent = "Type DELETE to confirm."; haptic.warn(); return; }
      try {
        await api("/api/me", { method: "DELETE", body: { confirm: "DELETE", deleteReviews: alsoReviews } });
        w.remove(); haptic.ok();
        await signOut(true);
        toast("Your account was deleted");
      } catch (e) { w.querySelector("#del-err").textContent = e.offline ? "You're offline." : "Couldn't delete the account. Try again, or email support."; }
    };
  }

  // ---------------------------------------------------------------- auth
  async function signIn() {
    const email = document.getElementById("si-email").value.trim().toLowerCase();
    const password = document.getElementById("si-pass").value;
    const err = document.getElementById("si-err");
    if (!email || !password) { err.textContent = "Enter your email and password."; haptic.warn(); return; }
    err.textContent = "";
    try {
      const d = await api("/api/auth/login", { method: "POST", body: { email, password } });
      if (!d.token) throw new Error("no_token");
      S.token = d.token;
      await store.set("token", d.token);
      haptic.ok();
      await afterSignIn(true);
    } catch (e) {
      const m = {
        not_found: "No account uses that email. Request access first.", pending: "Your request is still being reviewed. You'll get an email when you're approved.",
        rejected: "That request wasn't approved. Email support if you think that's a mistake.", bad_password: "That password isn't right.",
        no_password: "You haven't created a password yet. Use \"Email me a link\" below.", locked: "Too many tries. Wait 15 minutes and try again.",
        expired: "Your student access has expired.",
      };
      err.textContent = e.offline ? "You're offline." : m[e.message] || "Couldn't sign in. Try again.";
      haptic.warn();
    }
  }
  async function emailLink() {
    const email = document.getElementById("si-email").value.trim().toLowerCase();
    const err = document.getElementById("si-err");
    if (!email) { err.textContent = "Enter your email first."; return; }
    try {
      const d = await api("/api/auth/request-link", { method: "POST", body: { email } });
      if (d.ok) { haptic.ok(); toast("Check your email for the link"); }
      else err.textContent = d.reason === "pending" ? "Your request is still being reviewed." : "We couldn't find an approved account with that email.";
    } catch (e) { err.textContent = e.offline ? "You're offline." : "Couldn't send the link."; }
  }
  async function sendRequest() {
    const g = (id) => document.getElementById(id).value.trim();
    const err = document.getElementById("rq-err");
    const body = { firstName: g("rq-first"), lastName: g("rq-last"), nbcrnaNumber: g("rq-nbcrna"), email: g("rq-email").toLowerCase(), phone: g("rq-phone"), declaredRole: g("rq-role"), acceptedTerms: !!S.termsOk, termsVersion: S.versions.terms || "", smsConsent: false, source: "ios-app" };
    if (!body.firstName || !body.lastName) { err.textContent = "Enter your first and last name as they appear on your NBCRNA credential."; return haptic.warn(); }
    if (!body.nbcrnaNumber || !body.email || !body.phone) { err.textContent = "Fill in every field."; return haptic.warn(); }
    if (!body.declaredRole) { err.textContent = "Choose what best describes you."; return haptic.warn(); }
    if (!body.acceptedTerms) { err.textContent = "Agree to the Terms to continue."; return haptic.warn(); }
    try {
      await api("/api/request-access", { method: "POST", body });
      haptic.ok();
      S.guest = [{ v: "welcome" }, { v: "requested" }];
      render();
    } catch (e) { err.textContent = e.offline ? "You're offline." : "Couldn't send your request. Check the fields and try again."; }
  }
  async function afterSignIn(fresh) {
    try { const d = await api("/api/me"); S.me = d.user; store.set("me", S.me); } catch (e) { if (e.offline) S.online = false; else if (!S.token) return; }
    S.tab = "search";
    render();
    refreshReviews();
    refreshUnread();
    if (fresh && S.bioName && !S.bioOn) {
      const yes = await confirmSheet(`Use ${S.bioName}?`, `Lock CRNA Critics with ${S.bioName} so no one else can open it on this iPhone.`, `Turn on ${S.bioName}`);
      if (yes && (await bio.verify("Turn on " + S.bioName))) { S.bioOn = true; store.set("bio_on", true); toast(`${S.bioName} lock is on`); render(); }
    }
  }
  async function signOut(quiet) {
    if (!quiet) { if (!(await confirmSheet("Sign out?", "Saved places stay on this iPhone.", "Sign out"))) return; }
    try { if (S.token && !quiet) await api("/api/auth/logout", { method: "POST" }); } catch (e) {}
    S.token = null; S.me = null; S.reviews = []; S.entities = []; S.byKey = new Map(); S.conversations = null; S.unread = 0; S.locked = false;
    S.stacks = { search: [{ v: "search" }], saved: [{ v: "saved" }], rate: [{ v: "rate" }], inbox: [{ v: "inbox" }], account: [{ v: "account" }] };
    S.guest = [{ v: "welcome" }];
    await Promise.all([store.remove("token"), store.remove("reviews_cache"), store.remove("me"), store.remove("inbox_cache")]);
    render();
  }
  async function unlock() {
    if (await bio.verify("Unlock CRNA Critics")) { S.locked = false; haptic.ok(); render(); }
  }

  // ---------------------------------------------------------------- events
  document.addEventListener("click", async (ev) => {
    const el = ev.target.closest("[data-act],[data-tab],[data-go],[data-url],[data-entity],[data-kind],[data-kind-rate],[data-rate],[data-wr],[data-emp],[data-pay],[data-thread],[data-mail],[data-setting],[data-go-settings]");
    if (!el || el.closest(".sheet")) return;
    if (el.tagName === "A") ev.preventDefault();
    const d = el.dataset;
    if (d.url) { ev.stopPropagation(); return openUrl(d.url); }
    if (d.tab) return setTab(d.tab);
    if (d.go) { haptic.tap(); S.guest.push({ v: d.go }); S.termsOk = false; return render(); }
    if (d.entity) return push({ v: "entity", key: d.entity, from: S.tab === "saved" ? "Saved" : "Search" });
    if (d.kind) { S.kind = d.kind; haptic.pick(); return render(); }
    if (d.kindRate) { readRateInputs(); const keep = S.rf.kind === d.kindRate; if (!keep) { const n = S.rf.name; resetRateForm(d.kindRate, n); } haptic.pick(); return render(); }
    if (d.rate) { readRateInputs(); const n = Number(d.n); S.rf.ratings[d.rate] = S.rf.ratings[d.rate] === n && n !== NA ? 0 : n; S.rf.err = ""; haptic.pick(); return renderKeepScroll(); }
    if (d.wr) { readRateInputs(); S.rf.wr = S.rf.wr === d.wr ? "" : d.wr; haptic.pick(); return renderKeepScroll(); }
    if (d.emp) { readRateInputs(); S.rf.emp = d.emp; haptic.pick(); return renderKeepScroll(); }
    if (d.pay) { readRateInputs(); S.rf.payRange = S.rf.payRange === d.pay ? "" : d.pay; haptic.pick(); return renderKeepScroll(); }
    if (d.thread) return openThread(d.thread);
    if (d.mail) return openUrl("mailto:eric@crnacritics.com?subject=" + encodeURIComponent("CRNA Critics app"));
    if (d.goSettings) { push({ v: "settings" }); if (!S.msgSettings) loadInbox(); return; }
    if (d.setting) {
      const s = S.msgSettings || { acceptQuestions: true, messageEmails: true };
      try { const r = await api("/api/messages/settings", { method: "POST", body: { [d.setting]: !s[d.setting] } }); S.msgSettings = r.settings; haptic.pick(); render(); }
      catch (e) { toast(e.offline ? "You're offline." : "Couldn't save that setting."); }
      return;
    }
    switch (d.act) {
      case "back": haptic.tap(); return S.token ? pop() : (S.guest.length > 1 && S.guest.pop(), render());
      case "home": S.guest = [{ v: "welcome" }]; return render();
      case "signin": return signIn();
      case "emaillink": return emailLink();
      case "request": return sendRequest();
      case "toggle-terms": { S.termsOk = !S.termsOk; haptic.pick(); const b = document.getElementById("rq-terms-box"); b.className = "box" + (S.termsOk ? " on" : ""); b.innerHTML = S.termsOk ? I.check : ""; return; }
      case "toggle-guidelines": readRateInputs(); S.rf.accepted = !S.rf.accepted; haptic.pick(); return renderKeepScroll();
      case "submit-review": return submitReview();
      case "save": { const e = S.byKey.get(top().key); if (e) toggleSave(e); return; }
      case "unsave": S.saved = S.saved.filter((s) => s.key !== d.key); await store.set("saved", S.saved); return render();
      case "share-entity": { const e = S.byKey.get(top().key); if (!e) return; return shareText(e.name, `${e.name} (${KINDS[e.type].label}${locOf(e) ? ", " + locOf(e) : ""}) — ${e.items.length} anonymous review${e.items.length === 1 ? "" : "s"} from verified CRNAs on CRNA Critics.`, SITE); }
      case "rate-this": { const e = S.byKey.get(top().key); if (!e) return; resetRateForm(e.type, e.name); if (e.type === "hospital") { S.rf.city = e.city; S.rf.state = e.state; } S.tab = "rate"; S.stacks.rate = [{ v: "rate" }]; haptic.tap(); return render(); }
      case "ask": return askReviewer(d.id);
      case "report": return reportReview(d.id);
      case "delete-review": return deleteReview(d.id);
      case "send-reply": return sendReply(false);
      case "thread-more": return threadMore();
      case "signout": return signOut(false);
      case "delete-account": return deleteAccount();
      case "unlock": return unlock();
      case "toggle-bio": {
        if (S.bioOn) { S.bioOn = false; store.set("bio_on", false); toast(`${S.bioName} lock is off`); return render(); }
        if (await bio.verify("Turn on " + S.bioName)) { S.bioOn = true; store.set("bio_on", true); haptic.ok(); toast(`${S.bioName} lock is on`); render(); }
        return;
      }
    }
  });
  function renderKeepScroll() {
    const s = document.querySelector(".scroll"); const y = s ? s.scrollTop : 0;
    render();
    const s2 = document.querySelector(".scroll"); if (s2) s2.scrollTop = y;
  }
  document.addEventListener("input", (ev) => {
    if (ev.target.id === "q") {
      S.q = ev.target.value;
      // Re-render only the results so the keyboard stays up.
      const box = document.getElementById("results");
      if (box) box.innerHTML = searchResults();
      return;
    }
    if (ev.target.id === "rf-name") {
      S.rf.name = ev.target.value;
      const box = document.getElementById("rf-suggest");
      const q = norm(ev.target.value);
      if (!box) return;
      const hits = q.length < 2 ? [] : S.entities.filter((e) => e.type === S.rf.kind && norm(e.name).includes(q) && norm(e.name) !== q).slice(0, 6);
      box.innerHTML = hits.map((e) => `<button data-suggest="${esc(e.key)}">${esc(e.name)}${locOf(e) ? ` <span style="color:var(--muted)">· ${esc(locOf(e))}</span>` : ""}</button>`).join("");
    }
  });
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-suggest]");
    if (!b) return;
    const e = S.byKey.get(b.dataset.suggest); if (!e) return;
    readRateInputs();
    S.rf.name = e.name; if (e.type === "hospital") { S.rf.city = e.city; S.rf.state = e.state; }
    haptic.pick(); renderKeepScroll();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter") return;
    if (ev.target.id === "si-pass") { ev.preventDefault(); signIn(); }
    if (ev.target.id === "q") { ev.preventDefault(); ev.target.blur(); }
  });

  // pull to refresh
  let pullStart = null;
  document.addEventListener("touchstart", (ev) => { const s = ev.target.closest("#scroller"); pullStart = s && s.scrollTop <= 0 ? ev.touches[0].clientY : null; }, { passive: true });
  document.addEventListener("touchmove", (ev) => {
    if (pullStart == null) return;
    const ptr = document.getElementById("ptr"); if (!ptr) return;
    ptr.classList.toggle("on", ev.touches[0].clientY - pullStart > 70);
  }, { passive: true });
  document.addEventListener("touchend", async () => {
    const ptr = document.getElementById("ptr");
    if (pullStart != null && ptr && ptr.classList.contains("on")) {
      ptr.textContent = "Refreshing…"; haptic.tap();
      await Promise.all([refreshReviews(true), S.tab === "inbox" ? loadInbox() : refreshUnread()]);
    }
    pullStart = null;
  });

  function afterRender(v) {
    if (v.v === "thread") {
      const ta = document.getElementById("reply");
      if (ta) {
        if (v.pending) ta.value = v.pending;
        ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; v.pending = ta.value; });
      }
    }
  }

  // ---------------------------------------------------------------- lifecycle
  let backgroundAt = 0;
  async function boot() {
    S.versions = await store.get("versions", S.versions);
    S.saved = await store.get("saved", []);
    S.token = await store.get("token", null);
    S.bioName = await bio.available();
    S.bioOn = !!(S.bioName && (await store.get("bio_on", false)));
    if (P.Network) {
      try { const st = await P.Network.getStatus(); S.online = !!st.connected; } catch (e) {}
      P.Network.addListener("networkStatusChange", (st) => { const was = S.online; S.online = !!st.connected; if (!was && S.online) { refreshReviews(true); refreshUnread(); } else render(); });
    }
    if (P.App) {
      P.App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) { backgroundAt = Date.now(); return; }
        if (S.token && S.bioOn && backgroundAt && Date.now() - backgroundAt > 60 * 1000) { S.locked = true; render(); unlock(); }
        if (S.token) { refreshUnread(); if (Date.now() - backgroundAt > 5 * 60 * 1000) refreshReviews(true); }
      });
    }
    if (S.token) {
      const cache = await store.get("reviews_cache", null);
      S.me = await store.get("me", null);
      if (cache) { S.reviews = cache.reviews || []; S.access = cache.access || S.access; S.cachedAt = cache.at; buildEntities(); }
      if (S.bioOn) S.locked = true;
      render();
      if (S.bioOn) unlock();
      afterSignIn(false);
    } else {
      render();
    }
    try { P.SplashScreen && P.SplashScreen.hide(); } catch (e) {}
    loadVersions();
    setInterval(() => { if (S.token && S.online) refreshUnread(); }, 60 * 1000);
  }
  boot();
})();
