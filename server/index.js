require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const path = require("path");

const db = require("./db");
const { sign, verify, hashPassword, verifyPassword } = require("./auth");
const { sendEmail, REPLY_TO, escapeHtml, campaignHtml, fillTokens, TOKENS } = require("./email");
const { EMAIL_LOGO_PNG_BASE64, emailHeaderHtml } = require("./brand");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || "";
const isProd = process.env.NODE_ENV === "production";
const SESSION_SECONDS = 60 * 60 * 24 * 90; // members stay signed in for 90 days per device
const LINK_SECONDS = 60 * 60 * 48; // emailed sign-in links (welcome + forgot-password) are good for 48 hours
const FEEDBACK_LINK_SECONDS = 60 * 60 * 24 * 60; // beta feedback links stay open for 60 days — testers take their time
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
  const { name, nbcrnaNumber, phone, acceptedTerms, termsVersion, smsConsent } = req.body || {};
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!name || !nbcrnaNumber || !phone || !email) {
    return res.status(400).json({ error: "missing_fields" });
  }
  // Click-wrap: no account request is accepted without an affirmative acceptance of the Terms.
  if (!acceptedTerms) return res.status(400).json({ error: "terms_not_accepted" });
  const now = new Date().toISOString();
  const termsV = String(termsVersion || "unknown").slice(0, 32);
  const termsIp = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim().slice(0, 64);
  const termsUa = String(req.headers["user-agent"] || "").slice(0, 300);
  const sms = smsConsent ? 1 : 0;
  const existing = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email);
  if (existing) {
    db.prepare(
      "UPDATE access_requests SET name=?, nbcrna_number=?, phone=?, status='pending', requested_at=?, decided_at=NULL, terms_version=?, terms_accepted_at=?, terms_ip=?, terms_user_agent=?, sms_consent=? WHERE email=?"
    ).run(name, nbcrnaNumber, phone, now, termsV, now, termsIp, termsUa, sms, email);
  } else {
    db.prepare(
      "INSERT INTO access_requests (id, name, nbcrna_number, email, phone, status, requested_at, terms_version, terms_accepted_at, terms_ip, terms_user_agent, sms_consent) VALUES (?,?,?,?,?, 'pending', ?,?,?,?,?,?)"
    ).run(crypto.randomUUID(), name, nbcrnaNumber, email, phone, now, termsV, now, termsIp, termsUa, sms);
  }
  const row = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email);

  const approveToken = sign({ id: row.id, decision: "approved" }, 60 * 60 * 24 * 30);
  const rejectToken = sign({ id: row.id, decision: "rejected" }, 60 * 60 * 24 * 30);
  const approveUrl = `${BASE_URL}/api/admin/decide/${approveToken}`;
  const rejectUrl = `${BASE_URL}/api/admin/decide/${rejectToken}`;

  if (process.env.ADMIN_EMAIL) {
    sendEmail({
      to: process.env.ADMIN_EMAIL,
      // Replying to the alert writes to the CRNA who just applied, not to the site.
      replyTo: row.email,
      subject: `CRNA Critics — verify ${escapeHtml(name)}?`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
          ${emailHeaderHtml(BASE_URL, 480)}
          <h2 style="color:#123C3A;">New CRNA verification request</h2>
          <p><strong>${escapeHtml(name)}</strong></p>
          <p>NBCRNA #: ${escapeHtml(row.nbcrna_number)}<br/>
             Email: ${escapeHtml(row.email)}<br/>
             Phone: ${escapeHtml(row.phone)}</p>
          <p style="color:#555;font-size:12px;">Terms v${escapeHtml(String(row.terms_version || "?"))} accepted ${escapeHtml(String(row.terms_accepted_at || ""))} from ${escapeHtml(String(row.terms_ip || "unknown IP"))}${row.sms_consent ? " &middot; opted in to automated calls/texts" : ""}</p>
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
  const loginToken = sign({ email: row.email, purpose: "login" }, LINK_SECONDS);
  const loginUrl = `${BASE_URL}/api/auth/verify?token=${loginToken}`;
  return sendEmail({
    to: row.email,
    replyTo: REPLY_TO,
    subject: "You're verified on CRNA Critics",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        ${emailHeaderHtml(BASE_URL, 480)}
        <h2 style="color:#123C3A;">You're verified</h2>
        <p>Hi ${escapeHtml(row.name)}, you're approved as a verified CRNA on CRNA Critics.</p>
        <p>Use the button below to sign in for the first time and create your password. After that, you'll sign in with your email and password — no more links.</p>
        <p><a href="${loginUrl}" style="background:#123C3A;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Sign in &amp; create password</a></p>
        <p style="color:#888;font-size:12px;">This link expires in 48 hours. If it expires, use "Forgot password" on the sign-in screen to get a new one.</p>
      </div>
    `,
  });
}

// Sent when the admin resets someone by hand from the dashboard. Same one-time
// link machinery as "forgot password" — it lands on the create-password screen.
function sendResetEmail(row) {
  const token = sign({ email: row.email, purpose: "login" }, LINK_SECONDS);
  const url = `${BASE_URL}/api/auth/verify?token=${token}`;
  return sendEmail({
    to: row.email,
    subject: "Reset your CRNA Critics password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        ${emailHeaderHtml(BASE_URL, 480)}
        <h2 style="color:#123C3A;">Set a new password</h2>
        <p>Hi ${escapeHtml(row.name)}, an administrator started a password reset for your CRNA Critics account.</p>
        <p>The button below signs you in once and takes you straight to the create-password screen.</p>
        <p><a href="${url}" style="background:#123C3A;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Set a new password</a></p>
        <p style="color:#888;font-size:12px;">This link expires in 48 hours. If you didn't expect this, you can ignore it — your current password still works until you change it.</p>
      </div>
    `,
  });
}

// Beta tester feedback link. No login required — the signed token in the URL
// is the credential, same idea as the approve/reject links.
function sendFeedbackRequestEmail(row, token) {
  const url = `${BASE_URL}/feedback?token=${token}`;
  return sendEmail({
    to: row.email,
    replyTo: REPLY_TO,
    subject: "Quick favor — 3 min of feedback on CRNA Critics",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        ${emailHeaderHtml(BASE_URL, 480)}
        <h2 style="color:#123C3A;">A quick favor</h2>
        <p>Hi ${escapeHtml(row.name)}, thanks for trialing CRNA Critics. Since you're one of the first CRNAs on the site, your feedback will directly shape what gets fixed and built next.</p>
        <p>Tap your answers below — no typing required unless you want to add a note. Takes about 3 minutes.</p>
        <p><a href="${url}" style="background:#123C3A;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Give feedback</a></p>
        <p style="color:#888;font-size:12px;">This link works without signing in and stays open for 60 days.</p>
        <p style="margin-top:28px;">Thank you so much,</p>
        <p style="margin:0;"><strong>Eric Hayslip, CRNA</strong><br/>
          <a href="${BASE_URL}" style="color:#1F5C57;">www.crnacritics.com</a><br/>
          <a href="mailto:eric@crnacritics.com" style="color:#1F5C57;">eric@crnacritics.com</a></p>
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

  const token = sign({ email, purpose: "login" }, LINK_SECONDS);
  const loginUrl = `${BASE_URL}/api/auth/verify?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Your CRNA Critics sign-in link",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        ${emailHeaderHtml(BASE_URL, 480)}
        <h2 style="color:#123C3A;">Sign in to CRNA Critics</h2>
        <p>This one-time link signs you in. Once you're in, you can set a new password from the sign-in prompt.</p>
        <p><a href="${loginUrl}" style="background:#123C3A;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Sign in</a></p>
        <p style="color:#888;font-size:12px;">This link expires in 48 hours.</p>
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

// The admin list never carries the password hash off the server. What the admin
// gets instead is whether a password exists — resetting it is the only way in.
function adminRow(r) {
  const { password_hash, ...rest } = r;
  const counted = db.prepare("SELECT COUNT(*) AS n FROM reviews WHERE reviewer_email = ?").get(r.email);
  const fb = db
    .prepare("SELECT submitted_at FROM beta_feedback WHERE request_id = ? ORDER BY submitted_at DESC LIMIT 1")
    .get(r.id);
  return {
    ...rest,
    hasPassword: !!password_hash,
    reviewCount: counted ? counted.n : 0,
    feedbackSubmittedAt: fb ? fb.submitted_at : null,
  };
}

app.get("/api/admin/requests", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM access_requests ORDER BY requested_at DESC").all();
  res.json({ requests: rows.map(adminRow) });
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

// Resend the welcome/sign-in link, or send a password reset, for one member.
app.post("/api/admin/requests/:id/send-link", requireAdmin, async (req, res) => {
  const kind = req.body?.kind === "reset" ? "reset" : "welcome";
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.status !== "approved") return res.status(400).json({ error: "not_approved" });
  try {
    await (kind === "reset" ? sendResetEmail(row) : sendWelcomeEmail(row));
  } catch (e) {
    console.error(`Failed to send ${kind} link to ${row.email}:`, e.message);
    return res.status(502).json({ error: "send_failed" });
  }
  res.json({ ok: true, kind, sentTo: row.email });
});

// Email one member the beta feedback form. Re-sendable any time — a resend just
// mints a fresh 60-day token, it doesn't clear what they already submitted.
app.post("/api/admin/requests/:id/send-feedback", requireAdmin, async (req, res) => {
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.status !== "approved") return res.status(400).json({ error: "not_approved" });
  const token = sign({ id: row.id, purpose: "feedback" }, FEEDBACK_LINK_SECONDS);
  try {
    await sendFeedbackRequestEmail(row, token);
  } catch (e) {
    console.error(`Failed to send feedback link to ${row.email}:`, e.message);
    return res.status(502).json({ error: "send_failed" });
  }
  db.prepare("UPDATE access_requests SET feedback_sent_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
  res.json({ ok: true, sentTo: row.email });
});

// The full submission history for one member (newest first) — usually just one row.
app.get("/api/admin/requests/:id/feedback", requireAdmin, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM beta_feedback WHERE request_id = ? ORDER BY submitted_at DESC")
    .all(req.params.id);
  res.json({
    submissions: rows.map((r) => ({
      id: r.id,
      name: r.name,
      answers: JSON.parse(r.answers),
      finalComment: r.final_comment,
      submittedAt: r.submitted_at,
    })),
  });
});

// Remove a member. Their reviews only go with them when the admin says so;
// otherwise the reviews stay up and the account is gone.
app.delete("/api/admin/requests/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  const alsoReviews = req.query.reviews === "1";
  let deletedReviews = 0;
  if (alsoReviews) {
    deletedReviews = db.prepare("DELETE FROM reviews WHERE reviewer_email = ?").run(row.email).changes;
  }
  db.prepare("DELETE FROM access_requests WHERE id = ?").run(row.id);
  res.json({ ok: true, deletedReviews, name: row.name });
});

// ---------- member email: templates, campaigns, unsubscribe ----------
//
// Two kinds of mail leave this server and they are deliberately separate:
//   * account mail (welcome, sign-in link, password reset) — always sent, never
//     affected by an unsubscribe;
//   * member mailings / campaigns — written in the admin CMS, sent to a chosen set
//     of members, and skipped for anyone who opted out.

const CAMPAIGN_DELAY_MS = Number(process.env.CAMPAIGN_DELAY_MS || 600); // Resend allows ~2/sec
const UNSUB_SECONDS = 60 * 60 * 24 * 365 * 2;

// A member's personal link to the beta feedback form — the same link the per-member
// "Send feedback form" button emails, so answers land under their row in the admin.
function feedbackUrlFor(row) {
  return `${BASE_URL}/feedback?token=${sign({ id: row.id, purpose: "feedback" }, FEEDBACK_LINK_SECONDS)}`;
}
function usesFeedbackLink(text) {
  return /\{\{\s*feedback_link\s*\}\}/i.test(String(text || ""));
}

function unsubscribeUrlFor(email) {
  return `${BASE_URL}/unsubscribe?token=${sign({ email, purpose: "unsub" }, UNSUB_SECONDS)}`;
}

function reviewCountFor(email) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM reviews WHERE reviewer_email = ?").get(email);
  return row ? row.n : 0;
}

// --- templates (the CMS) ---

app.get("/api/admin/templates", requireAdmin, (req, res) => {
  res.json({
    templates: db.prepare("SELECT * FROM email_templates ORDER BY category, name").all(),
    tokens: TOKENS,
  });
});

function templateFields(b) {
  const name = String(b?.name || "").trim().slice(0, 120);
  const subject = String(b?.subject || "").trim().slice(0, 300);
  const body = String(b?.body || "").trim().slice(0, 20000);
  const category = String(b?.category || "").trim().slice(0, 40);
  if (!name || !subject || !body) return { error: "missing_fields" };
  return { values: { name, subject, body, category } };
}

app.post("/api/admin/templates", requireAdmin, (req, res) => {
  const parsed = templateFields(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { name, subject, body, category } = parsed.values;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO email_templates (id, name, category, subject, body, created_at, updated_at) VALUES (?,?,?,?,?,?,?)"
  ).run(id, name, category, subject, body, now, now);
  res.json({ template: db.prepare("SELECT * FROM email_templates WHERE id = ?").get(id) });
});

app.put("/api/admin/templates/:id", requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM email_templates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not_found" });
  const parsed = templateFields(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { name, subject, body, category } = parsed.values;
  db.prepare("UPDATE email_templates SET name=?, category=?, subject=?, body=?, updated_at=? WHERE id=?")
    .run(name, category, subject, body, new Date().toISOString(), existing.id);
  res.json({ template: db.prepare("SELECT * FROM email_templates WHERE id = ?").get(existing.id) });
});

app.delete("/api/admin/templates/:id", requireAdmin, (req, res) => {
  const changed = db.prepare("DELETE FROM email_templates WHERE id = ?").run(req.params.id).changes;
  if (!changed) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

// --- who can be mailed ---

// Every decided member, with what the admin needs to pick from: whether they've
// opted out of mailings, how many reviews they've posted, and when they last posted.
app.get("/api/admin/email/recipients", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM access_requests WHERE status = 'approved' ORDER BY name").all();
  const recipients = rows.map((r) => {
    const last = db
      .prepare("SELECT date FROM reviews WHERE reviewer_email = ? ORDER BY date DESC LIMIT 1")
      .get(r.email);
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      employmentType: r.employment_type || "",
      reviewCount: reviewCountFor(r.email),
      lastReviewAt: last ? last.date : null,
      unsubscribed: !!r.bulk_unsubscribed,
      hasPassword: !!r.password_hash,
    };
  });
  res.json({ recipients });
});

// Renders one member's copy of a draft, exactly as it will be sent.
app.post("/api/admin/email/preview", requireAdmin, (req, res) => {
  const subject = String(req.body?.subject || "");
  const body = String(req.body?.body || "");
  const row = req.body?.memberId
    ? db.prepare("SELECT * FROM access_requests WHERE id = ?").get(req.body.memberId)
    : db.prepare("SELECT * FROM access_requests WHERE status = 'approved' ORDER BY requested_at DESC LIMIT 1").get();
  const ctx = row
    ? { name: row.name, email: row.email, reviewCount: reviewCountFor(row.email), baseUrl: BASE_URL, feedbackUrl: feedbackUrlFor(row) }
    : { name: "Jane Doe, CRNA", email: "jane@example.com", reviewCount: 2, baseUrl: BASE_URL, feedbackUrl: `${BASE_URL}/feedback` };
  res.json({
    to: ctx.email,
    subject: fillTokens(subject, ctx),
    html: campaignHtml({ body, ctx, unsubscribeUrl: `${BASE_URL}/unsubscribe?token=preview` }),
  });
});

// --- sending ---

// Sends one campaign in the background, one message at a time with a small gap so
// Resend's rate limit is never the reason a send half-finishes. Progress lands in
// the campaign row, which the dashboard polls.
async function runCampaign(campaignId, subject, body) {
  const recipients = db
    .prepare("SELECT * FROM email_campaign_recipients WHERE campaign_id = ? AND status = 'queued'")
    .all(campaignId);
  const markRecipient = db.prepare("UPDATE email_campaign_recipients SET status=?, error=?, sent_at=? WHERE id=?");
  const bump = db.prepare(`UPDATE email_campaigns SET sent=?, failed=?, skipped=?, last_error=? WHERE id=?`);
  let sent = 0, failed = 0, skipped = 0, lastError = "";

  for (const r of recipients) {
    const member = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(r.email);
    if (!member || member.status !== "approved") {
      skipped += 1;
      markRecipient.run("skipped", "no longer an approved member", new Date().toISOString(), r.id);
    } else if (member.bulk_unsubscribed) {
      skipped += 1;
      markRecipient.run("skipped", "unsubscribed from mailings", new Date().toISOString(), r.id);
    } else {
      const ctx = { name: member.name, email: member.email, reviewCount: reviewCountFor(member.email), baseUrl: BASE_URL, feedbackUrl: feedbackUrlFor(member) };
      try {
        await sendEmail({
          to: member.email,
          subject: fillTokens(subject, ctx),
          html: campaignHtml({ body, ctx, unsubscribeUrl: unsubscribeUrlFor(member.email) }),
          replyTo: REPLY_TO,
        });
        sent += 1;
        // A campaign that carried their feedback link counts as "feedback form sent" on their member row.
        if (usesFeedbackLink(body)) {
          db.prepare("UPDATE access_requests SET feedback_sent_at = ? WHERE id = ?").run(new Date().toISOString(), member.id);
        }
        markRecipient.run("sent", "", new Date().toISOString(), r.id);
      } catch (e) {
        failed += 1;
        lastError = e.message || "send failed";
        markRecipient.run("failed", lastError.slice(0, 300), new Date().toISOString(), r.id);
        console.error(`Campaign ${campaignId}: failed to ${member.email}:`, lastError);
      }
      await new Promise((resolve) => setTimeout(resolve, CAMPAIGN_DELAY_MS));
    }
    bump.run(sent, failed, skipped, lastError, campaignId);
  }
  db.prepare("UPDATE email_campaigns SET status='done', finished_at=?, sent=?, failed=?, skipped=?, last_error=? WHERE id=?")
    .run(new Date().toISOString(), sent, failed, skipped, lastError, campaignId);
  console.log(`Campaign ${campaignId} finished — ${sent} sent, ${failed} failed, ${skipped} skipped.`);
}

// Start a send. Returns immediately with the campaign id; the dashboard polls it.
app.post("/api/admin/email/send", requireAdmin, (req, res) => {
  const subject = String(req.body?.subject || "").trim();
  const body = String(req.body?.body || "").trim();
  const templateName = String(req.body?.templateName || "").slice(0, 120);
  if (!subject || !body) return res.status(400).json({ error: "missing_fields" });

  const all = !!req.body?.all;
  const ids = Array.isArray(req.body?.recipientIds) ? req.body.recipientIds.map(String) : [];
  const approved = db.prepare("SELECT * FROM access_requests WHERE status = 'approved'").all();
  const chosen = all ? approved : approved.filter((r) => ids.includes(r.id));
  const mailable = chosen.filter((r) => !r.bulk_unsubscribed);
  if (mailable.length === 0) return res.status(400).json({ error: "no_recipients" });

  const campaignId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO email_campaigns (id, subject, body, template_name, status, total, created_at) VALUES (?,?,?,?, 'sending', ?, ?)"
  ).run(campaignId, subject, body, templateName, mailable.length, now);
  const insert = db.prepare(
    "INSERT INTO email_campaign_recipients (id, campaign_id, email, name, status) VALUES (?,?,?,?, 'queued')"
  );
  db.transaction(() => {
    mailable.forEach((r) => insert.run(crypto.randomUUID(), campaignId, r.email, r.name));
  })();

  runCampaign(campaignId, subject, body).catch((e) => {
    console.error("Campaign crashed:", e.message);
    db.prepare("UPDATE email_campaigns SET status='done', last_error=?, finished_at=? WHERE id=?")
      .run(String(e.message || "crashed").slice(0, 300), new Date().toISOString(), campaignId);
  });

  res.json({ ok: true, campaignId, total: mailable.length, excluded: chosen.length - mailable.length });
});

// ---------- automatic nudges (built into the site, no admin login needed) ----------
// Two programs, both checked hourly during the day (Eastern) and both sent as ordinary
// campaigns through runCampaign(), so they show in the Sent pane and honour unsubscribe:
//   review   — approved members with NO review yet get the "Ask for a review" template
//              (first one NUDGE_FIRST_AFTER_DAYS after approval, then weekly, max NUDGE_MAX;
//              stops the moment they post).
//   feedback — members who HAVE posted but have not filled in the site feedback form get
//              the feedback template (first one NUDGE_FIRST_AFTER_DAYS after their first
//              review, then weekly, max NUDGE_MAX; stops the moment they submit the form).
// Eric edits the wording of either template in the Email tab.
const NUDGE_FIRST_AFTER_DAYS = Number(process.env.NUDGE_FIRST_AFTER_DAYS || 2);
const NUDGE_EVERY_DAYS = Number(process.env.NUDGE_EVERY_DAYS || 7);
const NUDGE_MAX = Number(process.env.NUDGE_MAX || 4);
const NUDGE_HOURS = String(process.env.NUDGE_HOURS || "9-18"); // Eastern; "0-24" sends any time
const NUDGE_CHECK_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function firstReviewAt(email) {
  const row = db.prepare("SELECT MIN(date) AS d FROM reviews WHERE reviewer_email = ?").get(email);
  return row && row.d ? row.d : null;
}
function feedbackSubmittedFor(id) {
  return !!db.prepare("SELECT 1 FROM beta_feedback WHERE request_id = ? LIMIT 1").get(id);
}
function latest(...isoDates) {
  const ms = isoDates.filter(Boolean).map((d) => Date.parse(d)).filter((n) => !Number.isNaN(n));
  return ms.length ? Math.max(...ms) : 0;
}

const NUDGE_PROGRAMS = {
  review: {
    label: "Ask for a review",
    templateName: process.env.NUDGE_TEMPLATE_NAME || "Ask for a review",
    countCol: "nudge_count",
    lastCol: "last_nudged_at",
    // Eligible: approved, no review yet. Anchor = when they were approved.
    anchor: (r) => (reviewCountFor(r.email) > 0 ? null : (r.decided_at || r.requested_at)),
    lastSent: (r) => r.last_nudged_at,
  },
  feedback: {
    label: "Site feedback",
    templateName: process.env.NUDGE_FEEDBACK_TEMPLATE_NAME || "CRNACritics.com Review",
    countCol: "feedback_nudge_count",
    lastCol: "last_feedback_nudged_at",
    // Eligible: has posted, hasn't submitted the feedback form. Anchor = first review.
    anchor: (r) => (feedbackSubmittedFor(r.id) ? null : firstReviewAt(r.email)),
    // A form Eric sent by hand counts as a nudge for spacing purposes.
    lastSent: (r) => { const t = latest(r.last_feedback_nudged_at, r.feedback_sent_at); return t ? new Date(t).toISOString() : null; },
  },
};

function easternHour(date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(date));
}

function nudgeDue(program, row, nowMs) {
  if (row.status !== "approved" || row.bulk_unsubscribed) return false;
  if ((row[program.countCol] || 0) >= NUDGE_MAX) return false;
  const anchor = program.anchor(row);
  const anchorMs = anchor ? Date.parse(anchor) : NaN;
  if (!anchorMs || Number.isNaN(anchorMs) || nowMs - anchorMs < NUDGE_FIRST_AFTER_DAYS * DAY_MS) return false;
  const last = program.lastSent(row);
  if (last && nowMs - Date.parse(last) < NUDGE_EVERY_DAYS * DAY_MS) return false;
  return true;
}

function runNudgeProgram(key) {
  const program = NUDGE_PROGRAMS[key];
  const tpl = db.prepare("SELECT * FROM email_templates WHERE name = ? ORDER BY updated_at DESC LIMIT 1").get(program.templateName);
  if (!tpl) { console.log(`Nudges (${key}): no email template named "${program.templateName}" — nothing sent.`); return; }
  const nowMs = Date.now();
  const due = db.prepare("SELECT * FROM access_requests WHERE status = 'approved'").all().filter((r) => nudgeDue(program, r, nowMs));
  if (due.length === 0) return;

  const campaignId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO email_campaigns (id, subject, body, template_name, status, total, created_at) VALUES (?,?,?,?, 'sending', ?, ?)"
  ).run(campaignId, tpl.subject, tpl.body, `Auto — ${tpl.name}`, due.length, now);
  const insert = db.prepare("INSERT INTO email_campaign_recipients (id, campaign_id, email, name, status) VALUES (?,?,?,?, 'queued')");
  const stamp = db.prepare(`UPDATE access_requests SET ${program.countCol} = COALESCE(${program.countCol}, 0) + 1, ${program.lastCol} = ? WHERE id = ?`);
  db.transaction(() => {
    due.forEach((r) => { insert.run(crypto.randomUUID(), campaignId, r.email, r.name); stamp.run(now, r.id); });
  })();
  console.log(`Nudges (${key}): sending "${tpl.name}" to ${due.length} member(s).`);
  runCampaign(campaignId, tpl.subject, tpl.body).catch((e) => {
    console.error(`Nudge campaign (${key}) crashed:`, e.message);
    db.prepare("UPDATE email_campaigns SET status='done', last_error=?, finished_at=? WHERE id=?")
      .run(String(e.message || "crashed").slice(0, 300), new Date().toISOString(), campaignId);
  });
}

function runReviewNudges() {
  if (NUDGE_MAX <= 0) return;
  const [from, to] = NUDGE_HOURS.split("-").map(Number);
  const hour = easternHour();
  if (hour < from || hour >= to) return; // only send during the day, Eastern
  Object.keys(NUDGE_PROGRAMS).forEach((key) => {
    try { runNudgeProgram(key); } catch (e) { console.error(`Nudge program ${key} failed:`, e.message); }
  });
}

// Admin can see who is due for each program and force a check.
app.get("/api/admin/nudges", requireAdmin, (req, res) => {
  const nowMs = Date.now();
  const rows = db.prepare("SELECT * FROM access_requests WHERE status = 'approved'").all();
  const programs = {};
  Object.entries(NUDGE_PROGRAMS).forEach(([key, p]) => {
    programs[key] = {
      template: p.templateName,
      dueNow: rows.filter((r) => nudgeDue(p, r, nowMs)).map((r) => ({ id: r.id, name: r.name, email: r.email, sent: r[p.countCol] || 0 })),
    };
  });
  res.json({ firstAfterDays: NUDGE_FIRST_AFTER_DAYS, everyDays: NUDGE_EVERY_DAYS, max: NUDGE_MAX, hours: NUDGE_HOURS, programs });
});
app.post("/api/admin/nudges/run", requireAdmin, (req, res) => {
  runReviewNudges();
  res.json({ ok: true });
});

app.get("/api/admin/campaigns", requireAdmin, (req, res) => {
  res.json({ campaigns: db.prepare("SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT 50").all() });
});

app.get("/api/admin/campaigns/:id", requireAdmin, (req, res) => {
  const campaign = db.prepare("SELECT * FROM email_campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "not_found" });
  res.json({
    campaign,
    recipients: db
      .prepare("SELECT email, name, status, error, sent_at FROM email_campaign_recipients WHERE campaign_id = ? ORDER BY status, name")
      .all(campaign.id),
  });
});

// Admin can flip a member's mailing opt-out by hand (someone who asks by phone).
app.post("/api/admin/requests/:id/unsubscribe", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  const value = req.body?.unsubscribed ? 1 : 0;
  db.prepare("UPDATE access_requests SET bulk_unsubscribed=?, unsubscribed_at=? WHERE id=?")
    .run(value, value ? new Date().toISOString() : null, row.id);
  res.json({ ok: true, unsubscribed: !!value });
});

// --- the member-facing unsubscribe page ---

function unsubPage(title, body) {
  return `
    <html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>CRNA Critics</title></head>
    <body style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:60px auto;padding:0 20px;color:#14231F;text-align:center;">
      <h2 style="color:#123C3A;">${title}</h2>
      ${body}
    </body></html>`;
}

app.get("/unsubscribe", (req, res) => {
  const payload = verify(req.query.token);
  if (!payload || payload.purpose !== "unsub" || !payload.email) {
    return res.status(400).send(unsubPage("That link isn't valid", `<p>Ask us to take you off the list by replying to any CRNA Critics email.</p>`));
  }
  const row = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(payload.email);
  if (!row) return res.status(404).send(unsubPage("Account not found", `<p>There's no CRNA Critics account with that address.</p>`));
  if (row.bulk_unsubscribed) {
    return res.send(unsubPage("You're already unsubscribed", `<p>${escapeHtml(row.email)} won't get member mailings. Account email — sign-in links and password resets — still comes through.</p>`));
  }
  res.send(
    unsubPage(
      "Unsubscribe from member mailings?",
      `<p>${escapeHtml(row.email)}</p>
       <p style="color:#6B756F;font-size:14px;">You'll stop getting review reminders and announcements. You'll still get account email — sign-in links and password resets — and your reviews stay up.</p>
       <form method="POST" action="/unsubscribe">
         <input type="hidden" name="token" value="${escapeHtml(String(req.query.token))}"/>
         <button type="submit" style="background:#8C3A32;color:#fff;border:0;padding:13px 22px;border-radius:4px;font-weight:bold;font-size:15px;cursor:pointer;">Yes, unsubscribe me</button>
       </form>`
    )
  );
});

app.post("/unsubscribe", express.urlencoded({ extended: false }), (req, res) => {
  const payload = verify(req.body?.token);
  if (!payload || payload.purpose !== "unsub" || !payload.email) {
    return res.status(400).send(unsubPage("That link isn't valid", `<p>Reply to any CRNA Critics email and we'll take you off by hand.</p>`));
  }
  db.prepare("UPDATE access_requests SET bulk_unsubscribed=1, unsubscribed_at=? WHERE email=?")
    .run(new Date().toISOString(), payload.email);
  res.send(
    unsubPage(
      "Done — you're unsubscribed",
      `<p>${escapeHtml(payload.email)} won't get member mailings any more.</p>
       <p style="color:#6B756F;font-size:14px;">Account email still works, so you can always sign in. Changed your mind? Ask the admin to put you back on.</p>
       <p><a href="${BASE_URL}" style="color:#1F5C57;">Back to CRNA Critics</a></p>`
    )
  );
});

// ---------- admin view of reviews ----------

// The admin sees who wrote what, anonymous or not — moderation needs a name to act on.
// Members never get this route; `anonymous` is still flagged so the dashboard can show
// how the review appears publicly.
function adminReview(r) {
  return {
    ...rowToReview(r, null),
    isMine: false,
    anonymous: !!r.anonymous,
    reviewer: { name: r.reviewer_name, credentials: r.reviewer_credentials },
    reviewerEmail: r.reviewer_email,
  };
}

app.get("/api/admin/reviews", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM reviews ORDER BY date DESC").all();
  res.json({ reviews: rows.map(adminReview) });
});

app.get("/api/admin/requests/:id/reviews", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  const rows = db.prepare("SELECT * FROM reviews WHERE reviewer_email = ? ORDER BY date DESC").all(row.email);
  res.json({ reviews: rows.map(adminReview) });
});

// ---------- name merges ----------

// Must match normalizeName() in public/app.js — the client and the server have to agree
// on what counts as "the same spelling".
function normalizeName(s) {
  return String(s == null ? "" : s).toLowerCase().replace(/[.,'"’&\/\-_()\[\]]/g, " ").replace(/\s+/g, " ").trim();
}

// Every member needs the merge list to render names consistently.
app.get("/api/aliases", requireSession, (req, res) => {
  const aliases = db.prepare("SELECT alias_norm, canonical FROM name_aliases").all();
  const ignores = db.prepare("SELECT a_name, b_name FROM name_pair_ignores").all();
  res.json({ aliases, ignores });
});

// Merge one or more spellings into a canonical name. Re-points any alias that
// previously pointed at a name that is itself being merged, so chains can't form.
app.post("/api/admin/aliases", requireAdmin, (req, res) => {
  const canonical = String(req.body?.canonical || "").trim();
  const list = Array.isArray(req.body?.aliases) ? req.body.aliases : [];
  if (!canonical || list.length === 0) return res.status(400).json({ error: "missing_fields" });
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO name_aliases (id, alias_norm, alias_raw, canonical, created_at) VALUES (?,?,?,?,?)
     ON CONFLICT(alias_norm) DO UPDATE SET canonical = excluded.canonical, created_at = excluded.created_at`
  );
  const repoint = db.prepare("UPDATE name_aliases SET canonical = ? WHERE canonical = ?");
  const run = db.transaction(() => {
    list.forEach((raw) => {
      const norm = normalizeName(raw);
      if (!norm || norm === normalizeName(canonical)) return;
      insert.run(crypto.randomUUID(), norm, String(raw).trim(), canonical, now);
      repoint.run(canonical, String(raw).trim()); // anything filed under the old name follows
    });
  });
  run();
  res.json({ ok: true, aliases: db.prepare("SELECT * FROM name_aliases ORDER BY created_at DESC").all() });
});

// Undo a merge.
app.delete("/api/admin/aliases/:id", requireAdmin, (req, res) => {
  const changed = db.prepare("DELETE FROM name_aliases WHERE id = ?").run(req.params.id).changes;
  if (!changed) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

// "These two are not the same" — remembered so the suggestion never comes back.
app.post("/api/admin/name-ignores", requireAdmin, (req, res) => {
  const a = String(req.body?.a || "").trim();
  const b = String(req.body?.b || "").trim();
  if (!a || !b) return res.status(400).json({ error: "missing_fields" });
  const key = [normalizeName(a), normalizeName(b)].sort().join("||");
  db.prepare(
    "INSERT INTO name_pair_ignores (pair_key, a_name, b_name, created_at) VALUES (?,?,?,?) ON CONFLICT(pair_key) DO NOTHING"
  ).run(key, a, b, new Date().toISOString());
  res.json({ ok: true });
});

// Admin view of the merge state, plus every distinct name on file per entity type
// so the browser can run the similarity pass without loading every review.
app.get("/api/admin/names", requireAdmin, (req, res) => {
  const rows = db.prepare(
    `SELECT agency_name, agent_name, group_name, hospital_name, hospital_city, hospital_state FROM reviews`
  ).all();
  const buckets = { agency: {}, agent: {}, group: {}, hospital: {} };
  const add = (type, name, sub) => {
    const key = String(name || "").trim();
    if (!key) return;
    if (!buckets[type][key]) buckets[type][key] = { name: key, count: 0, sub: "" };
    buckets[type][key].count += 1;
    if (sub && !buckets[type][key].sub) buckets[type][key].sub = sub;
  };
  rows.forEach((r) => {
    add("agency", r.agency_name);
    add("agent", r.agent_name);
    add("group", r.group_name);
    const loc = [r.hospital_city, r.hospital_state].filter(Boolean).join(", ");
    add("hospital", r.hospital_name, loc);
  });
  res.json({
    names: Object.fromEntries(Object.entries(buckets).map(([t, m]) => [t, Object.values(m)])),
    aliases: db.prepare("SELECT * FROM name_aliases ORDER BY canonical, alias_raw").all(),
    ignores: db.prepare("SELECT a_name, b_name FROM name_pair_ignores").all(),
  });
});

// ---------- reviews ----------

// Per-category notes are stored as a JSON object; a legacy row (or a corrupted value)
// should never take the whole review list down.
function safeJson(text) {
  try {
    const v = JSON.parse(text || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}

// Trims a { categoryKey: comment } map down to non-empty strings, capped so one
// review can't carry an essay per category.
function cleanNotes(obj) {
  const out = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  Object.keys(obj).slice(0, 40).forEach((k) => {
    const text = String(obj[k] == null ? "" : obj[k]).trim().slice(0, 1000);
    if (text) out[String(k).slice(0, 60)] = text;
  });
  return out;
}

// viewerEmail decides ownership; the reviewer's email is never sent to the client,
// and an anonymous review hides the name from everyone but its author.
function rowToReview(r, viewerEmail) {
  const isMine = !!viewerEmail && r.reviewer_email === viewerEmail;
  const anonymous = !!r.anonymous;
  return {
    id: r.id,
    date: r.date,
    isMine,
    anonymous,
    editedAt: r.edited_at || null,
    reviewer: {
      name: anonymous && !isMine ? "Anonymous CRNA" : r.reviewer_name,
      credentials: r.reviewer_credentials,
    },
    agencyName: r.agency_name,
    agentName: r.agent_name,
    agencyAgentRatings: JSON.parse(r.agency_agent_ratings),
    agencyAgentWouldReturn: r.agency_agent_would_return,
    agencyAgentComment: r.agency_agent_comment,
    agencyAgentNotes: safeJson(r.agency_agent_notes),
    payRate: r.pay_rate,
    payRange: r.pay_range || "",
    agentRatings: JSON.parse(r.agent_ratings || "{}"),
    agentWouldReturn: r.agent_would_return || "",
    agentComment: r.agent_comment || "",
    agentNotes: safeJson(r.agent_notes),
    hospitalName: r.hospital_name,
    hospitalCity: r.hospital_city || "",
    hospitalState: r.hospital_state || "",
    hospitalRatings: JSON.parse(r.hospital_ratings),
    hospitalWouldReturn: r.hospital_would_return,
    hospitalComment: r.hospital_comment,
    hospitalNotes: safeJson(r.hospital_notes),
    employmentType: r.employment_type || "locum",
    staffPayType: r.staff_pay_type || "",
    staffPayRange: r.staff_pay_range || "",
    familyInsurance: r.family_insurance || "",
    ptoWeeks: r.pto_weeks || "",
    prnRate: r.prn_rate || "",
    groupName: r.group_name || "",
    groupRatings: JSON.parse(r.group_ratings || "{}"),
    groupWouldReturn: r.group_would_return || "",
    groupComment: r.group_comment || "",
    groupNotes: safeJson(r.group_notes),
  };
}

app.get("/api/reviews", requireSession, (req, res) => {
  const rows = db.prepare("SELECT * FROM reviews ORDER BY date DESC").all();
  res.json({ reviews: rows.map((r) => rowToReview(r, req.user.email)) });
});

// Validates a review body and returns the column values shared by create and edit,
// or { error } if something required is missing.
function reviewColumns(b) {
  const employmentType = b.employmentType === "staff" ? "staff" : "locum";
  if (!b.acceptedGuidelines) return { error: "guidelines_not_acknowledged" };
  if (!b.hospitalName || !b.hospitalRatings) return { error: "missing_fields" };
  if (employmentType === "staff" && (!b.groupName || !b.groupRatings)) return { error: "missing_fields" };
  if (employmentType === "locum" && (!b.agencyName || !b.agencyAgentRatings)) return { error: "missing_fields" };
  const isStaff = employmentType === "staff";
  return {
    values: {
      agency_name: isStaff ? "" : b.agencyName,
      agent_name: isStaff ? "" : (b.agentName || ""),
      agency_agent_ratings: JSON.stringify(isStaff ? {} : b.agencyAgentRatings),
      agency_agent_would_return: isStaff ? "" : (b.agencyAgentWouldReturn || ""),
      agency_agent_comment: isStaff ? "" : (b.agencyAgentComment || ""),
      agency_agent_notes: JSON.stringify(isStaff ? {} : cleanNotes(b.agencyAgentNotes)),
      pay_rate: isStaff || b.payRate === "" || b.payRate == null ? null : Number(b.payRate),
      pay_range: isStaff ? "" : String(b.payRange || ""),
      agent_ratings: JSON.stringify(isStaff || !b.agentName ? {} : (b.agentRatings || {})),
      agent_would_return: isStaff || !b.agentName ? "" : (b.agentWouldReturn || ""),
      agent_comment: isStaff || !b.agentName ? "" : (b.agentComment || ""),
      agent_notes: JSON.stringify(isStaff || !b.agentName ? {} : cleanNotes(b.agentNotes)),
      hospital_name: b.hospitalName,
      hospital_city: String(b.hospitalCity || "").trim(),
      hospital_state: String(b.hospitalState || "").trim().toUpperCase().slice(0, 2),
      hospital_ratings: JSON.stringify(b.hospitalRatings),
      hospital_would_return: b.hospitalWouldReturn || "",
      hospital_comment: b.hospitalComment || "",
      hospital_notes: JSON.stringify(cleanNotes(b.hospitalNotes)),
      employment_type: employmentType,
      staff_pay_type: isStaff ? String(b.staffPayType || "") : "",
      staff_pay_range: isStaff ? String(b.staffPayRange || "") : "",
      family_insurance: isStaff ? String(b.familyInsurance || "") : "",
      pto_weeks: isStaff ? String(b.ptoWeeks || "") : "",
      prn_rate: isStaff ? String(b.prnRate || "") : "",
      group_name: isStaff ? b.groupName : "",
      group_ratings: JSON.stringify(isStaff ? b.groupRatings : {}),
      group_would_return: isStaff ? (b.groupWouldReturn || "") : "",
      group_comment: isStaff ? (b.groupComment || "") : "",
      group_notes: JSON.stringify(isStaff ? cleanNotes(b.groupNotes) : {}),
      anonymous: b.anonymous ? 1 : 0,
      guidelines_version: String(b.guidelinesVersion || "").slice(0, 20),
      guidelines_accepted_at: new Date().toISOString(),
    },
  };
}

app.post("/api/reviews", requireSession, (req, res) => {
  const parsed = reviewColumns(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const v = parsed.values;
  const id = crypto.randomUUID();
  const cols = Object.keys(v);
  db.prepare(
    `INSERT INTO reviews (id, date, reviewer_name, reviewer_credentials, reviewer_email, ${cols.join(", ")})
     VALUES (?,?,?,?,?, ${cols.map(() => "?").join(",")})`
  ).run(id, new Date().toISOString(), req.user.name, req.user.credentials, req.user.email, ...cols.map((c) => v[c]));
  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
  res.json({ review: rowToReview(row, req.user.email) });
});

// Edit your own review. Every rated field can change; the original post date is kept
// and edited_at records the change.
app.put("/api/reviews/:id", requireSession, (req, res) => {
  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.reviewer_email !== req.user.email) return res.status(403).json({ error: "not_yours" });
  const parsed = reviewColumns(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const v = parsed.values;
  const cols = Object.keys(v);
  db.prepare(`UPDATE reviews SET ${cols.map((c) => `${c} = ?`).join(", ")}, edited_at = ? WHERE id = ?`)
    .run(...cols.map((c) => v[c]), new Date().toISOString(), row.id);
  const updated = db.prepare("SELECT * FROM reviews WHERE id = ?").get(row.id);
  res.json({ review: rowToReview(updated, req.user.email) });
});

app.delete("/api/reviews/:id", requireSession, (req, res) => {
  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.reviewer_email !== req.user.email) return res.status(403).json({ error: "not_yours" });
  db.prepare("DELETE FROM reviews WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- beta feedback (public, token-based — no member login required) ----------

// Same 7 questions the form renders; kept here too so a submission with a stale
// or tampered answer set still gets sane server-side bounds.
const FEEDBACK_QUESTIONS = [
  "Sign-up & verification",
  "Site navigation",
  "Glitches or bugs",
  "Clarity of instructions",
  "Design & layout",
  "Content being reviewed",
  "Value to the CRNA community",
];

app.get("/api/feedback/:token", (req, res) => {
  const payload = verify(req.params.token);
  if (!payload || !payload.id || payload.purpose !== "feedback") {
    return res.status(400).json({ error: "invalid_or_expired" });
  }
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(payload.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  const last = db
    .prepare("SELECT submitted_at FROM beta_feedback WHERE request_id = ? ORDER BY submitted_at DESC LIMIT 1")
    .get(row.id);
  res.json({ name: row.name, previousSubmittedAt: last ? last.submitted_at : null });
});

app.post("/api/feedback/:token", (req, res) => {
  const payload = verify(req.params.token);
  if (!payload || !payload.id || payload.purpose !== "feedback") {
    return res.status(400).json({ error: "invalid_or_expired" });
  }
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(payload.id);
  if (!row) return res.status(404).json({ error: "not_found" });

  const name = String(req.body?.name || row.name).trim().slice(0, 120);
  const rawAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const answers = FEEDBACK_QUESTIONS.map((title, i) => {
    const a = rawAnswers[i] || {};
    return {
      title,
      answer: a.answer ? String(a.answer).slice(0, 120) : null,
      comment: String(a.comment || "").trim().slice(0, 1000),
    };
  });
  const finalComment = String(req.body?.finalComment || "").trim().slice(0, 2000);

  db.prepare(
    "INSERT INTO beta_feedback (id, request_id, name, answers, final_comment, submitted_at) VALUES (?,?,?,?,?,?)"
  ).run(crypto.randomUUID(), row.id, name, JSON.stringify(answers), finalComment, new Date().toISOString());

  res.json({ ok: true });
});

// ---------- static frontend ----------

// The email logo, served from base64 in server/brand.js so the whole asset lives in
// source control as text. Immutable — bump the filename if the art ever changes.
const EMAIL_LOGO_BYTES = Buffer.from(EMAIL_LOGO_PNG_BASE64, "base64");
app.get("/email-logo.png", (req, res) => {
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(EMAIL_LOGO_BYTES);
});

app.get("/feedback", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "feedback.html"));
});

app.use(express.static(path.join(__dirname, "..", "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const server = app.listen(PORT, () => {
  console.log(`CRNA Critics running at ${BASE_URL}`);
  if (!process.env.RESEND_API_KEY) console.log("(RESEND_API_KEY not set — emails will be logged, not sent.)");
});

// Review nudges: first check a minute after boot, then hourly. unref() so a pending
// timer never keeps a stopping container alive.
if (process.env.NODE_ENV !== "test") {
  setTimeout(() => { try { runReviewNudges(); } catch (e) { console.error("Nudge check failed:", e.message); } }, 60 * 1000).unref();
  setInterval(() => { try { runReviewNudges(); } catch (e) { console.error("Nudge check failed:", e.message); } }, NUDGE_CHECK_MS).unref();
}

// Railway stops the old container with SIGTERM on every deploy. Without a handler,
// npm reports that as a crash and Railway emails a "Deployment crashed" alert for a
// deploy that actually succeeded. Close cleanly and exit 0 instead.
process.on("SIGTERM", () => {
  console.log("SIGTERM received — shutting down cleanly");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
});
