require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const path = require("path");

const db = require("./db");
const { sign, verify, hashPassword, verifyPassword } = require("./auth");
const { sendEmail, escapeHtml } = require("./email");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || "";
const isProd = process.env.NODE_ENV === "production";
const SESSION_SECONDS = 60 * 60 * 24 * 90; // members stay signed in for 90 days per device
const MIN_PASSWORD_LENGTH = 8;

app.use(express.json());
app.use(cookieParser());

const cookieOpts = (maxAgeSeconds) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
  maxAge: maxAgeSeconds * 1000,
  path: "/",
});

// ---------- auth middleware ----------

function requireSession(req, res, next) {
  const payload = verify(req.cookies.session);
  if (!payload || !payload.email) return res.status(401).json({ error: "not_signed_in" });
  const row = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(payload.email);
  if (!row || row.status !== "approved") return res.status(401).json({ error: "not_approved" });
  req.user = { email: row.email, name: row.name, credentials: "CRNA", hasPassword: !!row.password_hash, employmentType: row.employment_type || null };
  next();
}

function requireAdmin(req, res, next) {
  const payload = verify(req.cookies.admin_session);
  if (!payload || payload.role !== "admin") return res.status(401).json({ error: "not_admin" });
  next();
}

// ---------- access requests ----------

app.post("/api/request-access", async (req, res) => {
  const { name, nbcrnaNumber, phone } = req.body || {};
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!name || !nbcrnaNumber || !phone || !email) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email);
  if (existing) {
    db.prepare(
      "UPDATE access_requests SET name=?, nbcrna_number=?, phone=?, status='pending', requested_at=?, decided_at=NULL WHERE email=?"
    ).run(name, nbcrnaNumber, phone, now, email);
  } else {
    db.prepare(
      "INSERT INTO access_requests (id, name, nbcrna_number, email, phone, status, requested_at) VALUES (?,?,?,?,?, 'pending', ?)"
    ).run(crypto.randomUUID(), name, nbcrnaNumber, email, phone, now);
  }
  const row = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email);

  const approveToken = sign({ id: row.id, decision: "approved" }, 60 * 60 * 24 * 30);
  const rejectToken = sign({ id: row.id, decision: "rejected" }, 60 * 60 * 24 * 30);
  const approveUrl = `${BASE_URL}/api/admin/decide/${approveToken}`;
  const rejectUrl = `${BASE_URL}/api/admin/decide/${rejectToken}`;

  if (process.env.ADMIN_EMAIL) {
    sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `CRNA Critics — verify ${escapeHtml(name)}?`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#123C3A;">New CRNA verification request</h2>
          <p><strong>${escapeHtml(name)}</strong></p>
          <p>NBCRNA #: ${escapeHtml(row.nbcrna_number)}<br/>
             Email: ${escapeHtml(row.email)}<br/>
             Phone: ${escapeHtml(row.phone)}</p>
          <p style="margin-top:24px;">
            <a href="${approveUrl}" style="background:#1F5C57;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;margin-right:12px;">Approve</a>
            <a href="${rejectUrl}" style="background:#8C3A32;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Reject</a>
          </p>
          <p style="color:#888;font-size:12px;margin-top:24px;">These links work without logging in — one tap decides it. Expires in 30 days.</p>
        </div>
      `,
    }).catch((e) => console.error("Failed to send admin notification email:", e.message));
  }

  res.json({ ok: true });
});

// One-click approve/reject from the emailed link — no admin login required,
// the signed token itself is the credential.
app.get("/api/admin/decide/:token", async (req, res) => {
  const payload = verify(req.params.token);
  const page = (title, body) => `
    <html><body style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;text-align:center;color:#14231F;">
      <h2 style="color:#123C3A;">${title}</h2>
      <p>${body}</p>
    </body></html>
  `;
  if (!payload || !payload.id || !payload.decision) {
    return res.status(400).send(page("Link expired or invalid", "Ask the applicant to check the admin dashboard directly."));
  }
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(payload.id);
  if (!row) return res.status(404).send(page("Request not found", "It may have been removed."));

  db.prepare("UPDATE access_requests SET status=?, decided_at=? WHERE id=?").run(
    payload.decision,
    new Date().toISOString(),
    row.id
  );

  if (payload.decision === "approved") {
    sendWelcomeEmail(row).catch((e) => console.error("Failed to send welcome email:", e.message));
  }

  res.send(page(payload.decision === "approved" ? "Approved ✓" : "Rejected", `${escapeHtml(row.name)} has been marked ${payload.decision}.`));
});

// ---------- CRNA sign-in ----------
//
// First sign-in happens through the emailed welcome link (valid 24h); the member
// then creates a password and signs in with email + password from there on.
// Emailed links remain available as a "forgot password" fallback.

function sendWelcomeEmail(row) {
  const loginToken = sign({ email: row.email, purpose: "login" }, 60 * 60 * 24);
  const loginUrl = `${BASE_URL}/api/auth/verify?token=${loginToken}`;
  return sendEmail({
    to: row.email,
    subject: "You're verified on CRNA Critics",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#123C3A;">You're verified</h2>
        <p>Hi ${escapeHtml(row.name)}, you're approved as a verified CRNA on CRNA Critics.</p>
        <p>Use the button below to sign in for the first time and create your password. After that, you'll sign in with your email and password — no more links.</p>
        <p><a href="${loginUrl}" style="background:#123C3A;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Sign in &amp; create password</a></p>
        <p style="color:#888;font-size:12px;">This link expires in 24 hours. If it expires, use "Forgot password" on the sign-in screen to get a new one.</p>
      </div>
    `,
  });
}

// Simple in-memory brute-force guard: 5 failed attempts locks an email for 15 minutes.
const loginFailures = new Map();
function loginLocked(email) {
  const f = loginFailures.get(email);
  return !!(f && f.count >= 5 && Date.now() - f.last < 15 * 60 * 1000);
}
function recordLoginFailure(email) {
  const f = loginFailures.get(email) || { count: 0, last: 0 };
  if (Date.now() - f.last > 15 * 60 * 1000) f.count = 0;
  f.count += 1; f.last = Date.now();
  loginFailures.set(email, f);
}

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "missing_fields" });
  if (loginLocked(email)) return res.status(429).json({ error: "locked" });

  const row = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email);
  if (!row) return res.status(401).json({ error: "not_found" });
  if (row.status !== "approved") return res.status(401).json({ error: row.status });
  if (!row.password_hash) return res.status(401).json({ error: "no_password" });
  if (!verifyPassword(password, row.password_hash)) {
    recordLoginFailure(email);
    return res.status(401).json({ error: "bad_password" });
  }
  loginFailures.delete(email);
  const session = sign({ email: row.email }, SESSION_SECONDS);
  res.cookie("session", session, cookieOpts(SESSION_SECONDS));
  res.json({ ok: true });
});

app.post("/api/auth/set-password", requireSession, (req, res) => {
  const password = String(req.body?.password || "");
  if (password.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ error: "too_short" });
  db.prepare("UPDATE access_requests SET password_hash = ? WHERE email = ?").run(hashPassword(password), req.user.email);
  res.json({ ok: true });
});

const EMPLOYMENT_TYPES = ["locum", "staff"];
app.post("/api/auth/employment", requireSession, (req, res) => {
  const employmentType = String(req.body?.employmentType || "");
  if (!EMPLOYMENT_TYPES.includes(employmentType)) return res.status(400).json({ error: "bad_type" });
  db.prepare("UPDATE access_requests SET employment_type = ? WHERE email = ?").run(employmentType, req.user.email);
  res.json({ ok: true, employmentType });
});

app.post("/api/auth/request-link", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "missing_email" });
  const row = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email);
  if (!row) return res.json({ ok: false, reason: "not_found" });
  if (row.status !== "approved") return res.json({ ok: false, reason: row.status });

  const token = sign({ email, purpose: "login" }, 60 * 15);
  const loginUrl = `${BASE_URL}/api/auth/verify?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Your CRNA Critics sign-in link",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#123C3A;">Sign in to CRNA Critics</h2>
        <p>This one-time link signs you in. Once you're in, you can set a new password from the sign-in prompt.</p>
        <p><a href="${loginUrl}" style="background:#123C3A;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Sign in</a></p>
        <p style="color:#888;font-size:12px;">This link expires in 15 minutes.</p>
      </div>
    `,
  }).catch((e) => console.error("Failed to send login email:", e.message));

  res.json({ ok: true });
});

app.get("/api/auth/verify", (req, res) => {
  const payload = verify(req.query.token);
  if (!payload || payload.purpose !== "login" || !payload.email) {
    return res.status(400).send("Link expired or invalid. Go back and request a new sign-in link.");
  }
  const row = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(payload.email);
  if (!row || row.status !== "approved") {
    return res.status(403).send("This account is not an approved CRNA.");
  }
  const session = sign({ email: row.email }, SESSION_SECONDS);
  res.cookie("session", session, cookieOpts(SESSION_SECONDS));
  // Arriving via an emailed link always offers to (re)set the password.
  res.redirect("/?setpw=1");
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("session", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/me", requireSession, (req, res) => {
  res.json({ user: req.user });
});

// ---------- admin dashboard (passcode) ----------

app.post("/api/admin/login", (req, res) => {
  const { passcode } = req.body || {};
  if (!ADMIN_PASSCODE || passcode !== ADMIN_PASSCODE) {
    return res.status(401).json({ error: "wrong_passcode" });
  }
  const token = sign({ role: "admin" }, 60 * 60 * 24 * 7);
  res.cookie("admin_session", token, cookieOpts(60 * 60 * 24 * 7));
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("admin_session", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/admin/requests", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM access_requests ORDER BY requested_at DESC").all();
  res.json({ requests: rows });
});

app.post("/api/admin/requests/:id/decide", requireAdmin, async (req, res) => {
  const { decision } = req.body || {};
  if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ error: "bad_decision" });
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  db.prepare("UPDATE access_requests SET status=?, decided_at=? WHERE id=?").run(decision, new Date().toISOString(), row.id);

  if (decision === "approved") {
    sendWelcomeEmail(row).catch((e) => console.error("Failed to send welcome email:", e.message));
  }
  res.json({ ok: true });
});

// ---------- reviews ----------

function rowToReview(r) {
  return {
    id: r.id,
    date: r.date,
    reviewer: { name: r.reviewer_name, credentials: r.reviewer_credentials, email: r.reviewer_email },
    agencyName: r.agency_name,
    agentName: r.agent_name,
    agencyAgentRatings: JSON.parse(r.agency_agent_ratings),
    agencyAgentWouldReturn: r.agency_agent_would_return,
    agencyAgentComment: r.agency_agent_comment,
    payRate: r.pay_rate,
    hospitalName: r.hospital_name,
    hospitalRatings: JSON.parse(r.hospital_ratings),
    hospitalWouldReturn: r.hospital_would_return,
    hospitalComment: r.hospital_comment,
    employmentType: r.employment_type || "locum",
    groupName: r.group_name || "",
    groupRatings: JSON.parse(r.group_ratings || "{}"),
    groupWouldReturn: r.group_would_return || "",
    groupComment: r.group_comment || "",
  };
}

app.get("/api/reviews", requireSession, (req, res) => {
  const rows = db.prepare("SELECT * FROM reviews ORDER BY date DESC").all();
  res.json({ reviews: rows.map(rowToReview) });
});

app.post("/api/reviews", requireSession, (req, res) => {
  const b = req.body || {};
  const employmentType = b.employmentType === "staff" ? "staff" : "locum";
  if (!b.hospitalName || !b.hospitalRatings) return res.status(400).json({ error: "missing_fields" });
  if (employmentType === "staff" && (!b.groupName || !b.groupRatings)) return res.status(400).json({ error: "missing_fields" });
  if (employmentType === "locum" && (!b.agencyName || !b.agencyAgentRatings)) return res.status(400).json({ error: "missing_fields" });
  const isStaff = employmentType === "staff";
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO reviews (id, date, reviewer_name, reviewer_credentials, reviewer_email,
      agency_name, agent_name, agency_agent_ratings, agency_agent_would_return, agency_agent_comment, pay_rate,
      hospital_name, hospital_ratings, hospital_would_return, hospital_comment,
      employment_type, group_name, group_ratings, group_would_return, group_comment)
     VALUES (?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?, ?,?,?,?,?)`
  ).run(
    id,
    new Date().toISOString(),
    req.user.name,
    req.user.credentials,
    req.user.email,
    isStaff ? "" : b.agencyName,
    isStaff ? "" : (b.agentName || ""),
    JSON.stringify(isStaff ? {} : b.agencyAgentRatings),
    isStaff ? "" : (b.agencyAgentWouldReturn || ""),
    isStaff ? "" : (b.agencyAgentComment || ""),
    isStaff || b.payRate === "" || b.payRate == null ? null : Number(b.payRate),
    b.hospitalName,
    JSON.stringify(b.hospitalRatings),
    b.hospitalWouldReturn || "",
    b.hospitalComment || "",
    employmentType,
    isStaff ? b.groupName : "",
    JSON.stringify(isStaff ? b.groupRatings : {}),
    isStaff ? (b.groupWouldReturn || "") : "",
    isStaff ? (b.groupComment || "") : ""
  );
  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
  res.json({ review: rowToReview(row) });
});

app.delete("/api/reviews/:id", requireSession, (req, res) => {
  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.reviewer_email !== req.user.email) return res.status(403).json({ error: "not_yours" });
  db.prepare("DELETE FROM reviews WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- static frontend ----------

app.use(express.static(path.join(__dirname, "..", "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`CRNA Critics running at ${BASE_URL}`);
  if (!process.env.RESEND_API_KEY) console.log("(RESEND_API_KEY not set — emails will be logged, not sent.)");
});
