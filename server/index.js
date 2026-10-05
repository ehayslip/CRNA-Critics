require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const path = require("path");

const db = require("./db");
const { sign, verify, hashPassword, verifyPassword } = require("./auth");
const { sendEmail, REPLY_TO, escapeHtml, campaignHtml, fillTokens, firstNameOf, TOKENS, plainMailHtml } = require("./email");
const { EMAIL_LOGO_PNG_BASE64, emailHeaderHtml } = require("./brand");
const { SITE_ICONS } = require("./icons");
const { scanReview, SEVERITY_RANK, RULES } = require("./guard");
const registerMessages = require("./messages");
const { checkApplicant } = require("./nbcrna");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || "";
const isProd = process.env.NODE_ENV === "production";
const SESSION_SECONDS = 60 * 60 * 24 * 90; // members stay signed in for 90 days per device
const LINK_SECONDS = 60 * 60 * 48; // emailed sign-in links (welcome + forgot-password) are good for 48 hours
const FEEDBACK_LINK_SECONDS = 60 * 60 * 24 * 60; // beta feedback links stay open for 60 days — testers take their time
const MIN_PASSWORD_LENGTH = 8;
// New sign-ups are checked against the NBCRNA public lookup and approved on a clean match. AUTO_VERIFY=off turns it off.
const AUTO_VERIFY = String(process.env.AUTO_VERIFY || "on").toLowerCase() !== "off";

app.use(express.json());
app.use(cookieParser());

const cookieOpts = (maxAgeSeconds) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
  maxAge: maxAgeSeconds * 1000,
  path: "/",
});

// ---------- who writes, who only reads ----------
//
// Every member is a verified CRNA (or an SRNA). But a CRNA who sits on the staffing side of
// the table — chief, recruiter, group owner — has a stake in the ratings, so Eric's rule
// (Oct 5, 2026) is: they can read everything, and never post a review or message anyone.
// What the applicant picked on the sign-up form is kept in access_requests.declared_role;
// the tier it maps to is the account's role, and the admin can move anyone between tiers.
const DECLARED_ROLES = {
  practicing: { label: "Practicing CRNA", readOnly: false },
  chief: { label: "Chief CRNA / department lead", readOnly: true },
  recruiter: { label: "CRNA who recruits or works for a staffing agency", readOnly: true },
  owner: { label: "Owns or manages an anesthesia group", readOnly: true },
};
const READ_ONLY_ROLES = new Set(["srna", "crna_readonly"]);
function isReadOnlyRole(role) { return READ_ONLY_ROLES.has(role); }
function declaredRoleLabel(row) { return (DECLARED_ROLES[row.declared_role] || {}).label || ""; }

// ---------- auth middleware ----------

function requireSession(req, res, next) {
  const payload = verify(req.cookies.session);
  if (!payload || !payload.email) return res.status(401).json({ error: "not_signed_in" });
  const row = lapseIfExpired(db.prepare("SELECT * FROM access_requests WHERE email = ?").get(payload.email));
  if (!row || row.status !== "approved") return res.status(401).json({ error: row && row.status === "expired" ? "access_expired" : "not_approved" });
  const role = row.role === "srna" ? "srna" : row.role === "crna_readonly" ? "crna_readonly" : "crna";
  req.user = {
    email: row.email, name: row.name, credentials: role === "srna" ? "SRNA" : "CRNA", role,
    readOnly: isReadOnlyRole(role), declaredRole: declaredRoleLabel(row),
    hasPassword: !!row.password_hash, employmentType: row.employment_type || null,
    accessThrough: role === "srna" ? monthYearLabel(row) : undefined,
    needsDeclaration: needsDeclaration(row), pastDeadline: !row.declared_role && !!row.declare_deadline_at,
  };
  next();
}

// A student's access ends at the end of their expected graduation month. The moment it passes the
// account flips to 'expired' (so every route, sign-in and emailed link stops working); the
// "your access expired" email is sent by runSrnaExpiry() during the day.
function lapseIfExpired(row) {
  if (row && row.role === "srna" && row.status === "approved" && row.srna_expires_at && Date.parse(row.srna_expires_at) <= Date.now()) {
    db.prepare("UPDATE access_requests SET status='expired' WHERE id=? AND status='approved'").run(row.id);
    return { ...row, status: "expired" };
  }
  return row;
}
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthYearLabel(row) {
  const m = Number(row.srna_grad_month);
  return m >= 1 && m <= 12 ? `${MONTH_NAMES[m - 1]} ${row.srna_grad_year}` : String(row.srna_grad_year || "");
}
// First instant of the month AFTER the graduation month (05:00 UTC = midnight Eastern standard time).
function srnaExpiresAtFor(month, year) {
  return new Date(Date.UTC(Number(year), Number(month), 1, 5, 0, 0)).toISOString();
}
function runSrnaExpiry() {
  db.prepare("SELECT * FROM access_requests WHERE role='srna' AND status='approved' AND srna_expires_at IS NOT NULL").all().forEach(lapseIfExpired);
  const hour = easternHour();
  if (hour < 9 || hour >= 18) return; // the email goes out during the day, Eastern
  const due = db.prepare("SELECT * FROM access_requests WHERE role='srna' AND status='expired' AND srna_expired_emailed_at IS NULL").all();
  for (const row of due) {
    // Stamp first: never send it twice.
    db.prepare("UPDATE access_requests SET srna_expired_emailed_at=? WHERE id=?").run(new Date().toISOString(), row.id);
    sendSrnaTemplate("expired", { to: row.email, row, ctx: srnaCtx(row), replyTo: REPLY_TO })
      .catch((e) => console.error("SRNA expiry email failed:", e.message));
  }
}

// Read-only accounts — students (SRNA) and staffing-side CRNAs — can search and read, never post or message.
function requireCrna(req, res, next) {
  requireSession(req, res, () => {
    if (req.user.role === "srna") return res.status(403).json({ error: "student_read_only" });
    if (req.user.readOnly) return res.status(403).json({ error: "read_only" });
    next();
  });
}

function requireAdmin(req, res, next) {
  const payload = verify(req.cookies.admin_session);
  if (!payload || payload.role !== "admin") return res.status(401).json({ error: "not_admin" });
  next();
}

// ---------- access requests ----------

app.post("/api/request-access", async (req, res) => {
  const { nbcrnaNumber, phone, acceptedTerms, termsVersion, smsConsent } = req.body || {};
  const email = String(req.body?.email || "").trim().toLowerCase();
  // Who they say they are decides the tier. No declaration, no request — the box is not optional.
  const declaredRole = String(req.body?.declaredRole || "");
  if (!DECLARED_ROLES[declaredRole]) return res.status(400).json({ error: "role_required" });
  const role = DECLARED_ROLES[declaredRole].readOnly ? "crna_readonly" : "crna";
  // First and last name are separate required fields and must match the NBCRNA credential.
  const clean = (v) => String(v || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const firstName = clean(req.body?.firstName);
  const lastName = clean(req.body?.lastName);
  if (!firstName || !lastName) return res.status(400).json({ error: "first_last_required" });
  const name = `${firstName} ${lastName}`;
  if (!nbcrnaNumber || !phone || !email) {
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
      "UPDATE access_requests SET role=?, declared_role=?, attested_at=?, srna_school=NULL, srna_program=NULL, srna_grad_year=NULL, srna_grad_month=NULL, srna_expires_at=NULL, instructor_name=NULL, instructor_email=NULL, name=?, nbcrna_number=?, phone=?, status='pending', requested_at=?, decided_at=NULL, terms_version=?, terms_accepted_at=?, terms_ip=?, terms_user_agent=?, sms_consent=? WHERE email=?"
    ).run(role, declaredRole, now, name, nbcrnaNumber, phone, now, termsV, now, termsIp, termsUa, sms, email);
  } else {
    db.prepare(
      "INSERT INTO access_requests (id, name, nbcrna_number, email, phone, status, requested_at, terms_version, terms_accepted_at, terms_ip, terms_user_agent, sms_consent, role, declared_role, attested_at) VALUES (?,?,?,?,?, 'pending', ?,?,?,?,?,?,?,?,?)"
    ).run(crypto.randomUUID(), name, nbcrnaNumber, email, phone, now, termsV, now, termsIp, termsUa, sms, role, declaredRole, now);
  }
  const row = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email);

  res.json({ ok: true });

  // Eric chose (Sep 19, 2026): check NBCRNA in the background and approve a clean
  // match on the spot; anything else goes to his inbox with Approve / Reject.
  handleNewRequest(row, { wasRejected: existing?.status === "rejected" }).catch((e) => console.error("New-request handling failed:", e.message));
});


// ---------- SRNA (student) access requests ----------
// Students have no NBCRNA number. They give their school, program, expected graduation year and
// a program contact (instructor / director / coordinator). The contact is emailed a pre-made
// template with "Yes, verify" / "I can't verify" links; "verify" approves the student on the spot,
// sends the student a sign-in + create-password link and thanks the contact. SRNAs are read-only.

// Only these two addresses may be used without a .edu ending (testing the SRNA flow). Override with SRNA_TEST_EMAILS (comma list).
const SRNA_TEST_EMAILS = (process.env.SRNA_TEST_EMAILS || "erichayslip@gmail.com,ehayslip1@gmail.com").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);

const SRNA_TEMPLATES = {
  ask: {
    name: "SRNA — program contact verification",
    subject: "Can you verify {{student_name}} as a student in your program?",
    body: `Hi {{instructor_name}},

{{student_name}} has asked for student access to CRNA Critics, a review site where practicing CRNAs rate the agencies, recruiters, hospitals and anesthesia groups they have worked with. Students get read-only access: they can read reviews, but they can never post.

They listed you as their contact at {{school}}:

Student: {{student_name}}
Program: {{program}}
Expected graduation: {{grad_month_year}}

Can you confirm that this person is currently enrolled? It takes one tap, no account or login is needed.

{{verify_link}}

{{cant_verify_link}}

If you don't recognize this student, or you'd rather not say, tap the second button. Nothing is shared with them beyond "could not be verified", and nothing is shared about you.

Thank you for your time.

— Eric Hayslip, CRNA, CRNA Critics`,
  },
  welcome: {
    name: "SRNA — approved, sign in",
    subject: "You're approved for student access to CRNA Critics",
    body: `Hi {{first_name}},

Good news: your program contact confirmed you, and your student (SRNA) account at CRNA Critics is approved.

You can search and read every review on the site. Posting reviews and messaging are for practicing CRNAs, so your account is read-only.

Your student access runs through {{grad_month_year}}, the expected graduation date you gave us. After that month it ends automatically, and we'll email you how to join as a CRNA with your NBCRNA credentials.

Use the button below to sign in for the first time and create your password. After that you'll sign in with your email and password.

{{login_link}}

This link expires in 48 hours. If it expires, use "Forgot your password?" on the sign-in screen for a new one.

— Eric, CRNA Critics`,
  },
  expired: {
    name: "SRNA — access expired",
    subject: "Your CRNA Critics student access has expired",
    body: `Hi {{first_name}},

Your student (SRNA) access to CRNA Critics at https://www.crnacritics.com ran through {{grad_month_year}}, the expected graduation date you gave us, and it has now expired. You can no longer sign in with your student account.

If you've finished your program and earned your NBCRNA certification, we'd love to have you back as a CRNA. CRNAs can read every review and post their own, anonymously.

To join as a CRNA:

1. Go to https://www.crnacritics.com and tap "First time here? Get verified".
2. Enter your first and last name and your NBCRNA certification number exactly as they appear on your NBCRNA record.
3. Accept the Terms and submit. We check your credential against NBCRNA, and if it matches you're approved right away and get a sign-in link by email.

{{cta}}

Congratulations on finishing, and thank you for using CRNA Critics as a student.

— Eric Hayslip, CRNA, CRNA Critics`,
  },
  thanks: {
    name: "SRNA — thank you to program contact",
    subject: "Thank you for verifying {{student_name}}",
    body: `Hi {{instructor_name}},

Thank you for taking the time to verify {{student_name}}. Your confirmation let us approve their student access right away.

I know how full a program director's or instructor's inbox is, and I appreciate it. If you ever have a question about CRNA Critics, just reply to this email.

— Eric Hayslip, CRNA, CRNA Critics`,
  },
};
function ensureSrnaTemplates() {
  const now = new Date().toISOString();
  for (const t of Object.values(SRNA_TEMPLATES)) {
    if (db.prepare("SELECT 1 FROM email_templates WHERE name = ?").get(t.name)) continue;
    db.prepare("INSERT INTO email_templates (id, name, category, subject, body, created_at, updated_at) VALUES (?,?,?,?,?,?,?)")
      .run(crypto.randomUUID(), t.name, "SRNA", t.subject, t.body, now, now);
  }
}
ensureSrnaTemplates();

// ---------- "which best describes you?" for members who joined before the question ----------
//
// New sign-ups declare their role on the form. Members from before Oct 5, 2026 never did, so
// Eric emails them the same question. Each gets a personal link (no login) to a page with the
// four options; answering records declared_role / attested_at exactly like a new sign-up and
// moves staffing-side CRNAs to read-only. A member who is signed in sees the same question as
// a card in the app. Nothing here runs on its own: sending the question, and moving members
// who never answered to read-only after the deadline, are both buttons Eric clicks in Admin.
const DECLARE_DEADLINE_DAYS = Math.max(1, Number(process.env.DECLARE_DEADLINE_DAYS || 30));
const DECLARE_LINK_SECONDS = 60 * 60 * 24 * 90;

const DECLARE_TEMPLATES = {
  ask: {
    name: "Role check — which best describes you?",
    subject: "One quick question about your CRNA Critics membership",
    body: `Hi {{first_name}},

Since you joined, CRNA Critics has added one question to membership, and I need your answer to keep your account as it is.

The site now has two levels. Practicing CRNAs keep full membership: read, post reviews, message reviewers. CRNAs on the staffing side of the table — Chief CRNAs and department leads, CRNAs who recruit or work for a staffing agency, and owners or managers of an anesthesia group — are welcome to read everything but are read-only: no reviews, no messages. The ratings have to come from CRNAs with nothing at stake in them, and the people being rated can't be the ones rating.

Which best describes you? Tap below and pick one. It takes ten seconds and you don't need to sign in.

{{declare_link}}

Under the updated Terms (v1.1, Section 1), an account that hasn't answered within {{declare_days}} days moves to read-only until it does. That isn't a judgment — it's the only fair way to apply the same rule to everyone. Misstating your role is grounds for removal.

Thank you for being straight with me, and for being part of this.

— Eric Hayslip, CRNA, CRNA Critics`,
  },
  deadline: {
    name: "Role check — access paused until you answer",
    subject: "Your CRNA Critics account is read-only until you answer one question",
    body: `Hi {{first_name}},

{{declare_days}} days ago I asked which best describes you — practicing CRNA, or Chief / recruiter / group owner — and I haven't heard back. As the Terms say (v1.1, Section 1), your account is now read-only: you can still sign in, search and read every review, but posting and messaging are paused.

Answering takes ten seconds and restores full access on the spot if you're a practicing CRNA. No sign-in needed:

{{declare_link}}

If you'd rather, just sign in and the question is the first thing you'll see.

— Eric Hayslip, CRNA, CRNA Critics`,
  },
};
function ensureDeclareTemplates() {
  const now = new Date().toISOString();
  for (const t of Object.values(DECLARE_TEMPLATES)) {
    if (db.prepare("SELECT 1 FROM email_templates WHERE name = ?").get(t.name)) continue;
    db.prepare("INSERT INTO email_templates (id, name, category, subject, body, created_at, updated_at) VALUES (?,?,?,?,?,?,?)")
      .run(crypto.randomUUID(), t.name, "Members", t.subject, t.body, now, now);
  }
}
ensureDeclareTemplates();

function declareUrlFor(row) {
  return `${BASE_URL}/declare?t=${encodeURIComponent(sign({ id: row.id, purpose: "declare" }, DECLARE_LINK_SECONDS))}`;
}
// A CRNA member (not a student) who has never said what they are.
function needsDeclaration(row) {
  return !!row && row.status === "approved" && row.role !== "srna" && !row.declared_role;
}
function declareCtx(row) {
  return { name: row.name, email: row.email, reviewCount: reviewCountFor(row.email), baseUrl: BASE_URL, declareUrl: declareUrlFor(row), declareDays: DECLARE_DEADLINE_DAYS };
}
// Account mail, not a mailing: goes out even to members who unsubscribed from campaigns.
async function sendDeclareTemplate(key, row) {
  const def = DECLARE_TEMPLATES[key];
  const tpl = db.prepare("SELECT * FROM email_templates WHERE name = ? ORDER BY updated_at DESC LIMIT 1").get(def.name) || def;
  const ctx = declareCtx(row);
  await sendEmail({ to: row.email, replyTo: REPLY_TO, subject: fillTokens(tpl.subject, ctx), html: plainMailHtml({ body: tpl.body, ctx }) });
}
async function askForDeclaration(row) {
  await sendDeclareTemplate("ask", row);
  db.prepare("UPDATE access_requests SET declare_asked_at = COALESCE(declare_asked_at, ?) WHERE id = ?").run(new Date().toISOString(), row.id);
}

// Records an answer. Returns what changed so the caller can word the page / response.
// The tier only moves when Eric hasn't set it by hand — his decision always wins.
function recordDeclaration(row, declaredRole) {
  const def = DECLARED_ROLES[declaredRole];
  if (!def) return { error: "bad_role" };
  const now = new Date().toISOString();
  const wantedRole = def.readOnly ? "crna_readonly" : "crna";
  const adminLocked = !!row.role_set_by_admin_at;
  const newRole = adminLocked ? row.role : wantedRole;
  db.prepare("UPDATE access_requests SET declared_role=?, attested_at=?, role=?, declare_deadline_at=NULL WHERE id=?").run(declaredRole, now, newRole, row.id);
  const fresh = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(row.id);
  const becameReadOnly = row.role !== "crna_readonly" && newRole === "crna_readonly";
  const restoredFull = row.role === "crna_readonly" && newRole === "crna";
  if (becameReadOnly) sendTierChangeEmail(fresh, { declared: true }).catch((e) => console.error("Declared read-only email failed:", e.message));
  // Eric only hears about the answers that need a decision: a staffing-side CRNA who already has
  // reviews up (keep or pull?), or an answer that disagrees with a tier he set by hand.
  const reviews = reviewCountFor(row.email);
  if (process.env.ADMIN_EMAIL && ((def.readOnly && reviews > 0) || (adminLocked && wantedRole !== row.role))) {
    sendEmail({
      to: process.env.ADMIN_EMAIL,
      replyTo: row.email,
      subject: `CRNA Critics — ${escapeHtml(row.name)} answered the role question: ${escapeHtml(def.label)}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">${emailHeaderHtml(BASE_URL, 480)}
        <h2 style="color:#123C3A;">A member answered the role question</h2>
        <p><strong>${escapeHtml(row.name)}</strong> says they are <strong>${escapeHtml(def.label)}</strong>.</p>
        ${adminLocked && wantedRole !== row.role
          ? `<p style="background:#FFF4E5;border-left:4px solid #B87F1E;padding:10px 12px;">You set this account's access by hand (${row.role === "crna_readonly" ? "read-only" : "full"}), so their answer was recorded but nothing changed. Decide under Site admin &rarr; Members.</p>`
          : `<p style="background:#FFF4E5;border-left:4px solid #B87F1E;padding:10px 12px;">They're now read-only. They have <strong>${reviews} review${reviews === 1 ? "" : "s"}</strong> on the site from before. Keep or pull them? Open their row under Site admin &rarr; Members.</p>`}
      </div>`,
    }).catch((e) => console.error("Declaration notice failed:", e.message));
  }
  return { ok: true, declaredRole, label: def.label, readOnly: newRole === "crna_readonly", becameReadOnly, restoredFull, adminLocked };
}

function declareRowFromToken(t) {
  const payload = verify(String(t || ""));
  if (!payload || payload.purpose !== "declare" || !payload.id) return null;
  return db.prepare("SELECT * FROM access_requests WHERE id = ? AND role <> 'srna'").get(payload.id) || null;
}
function declarePage(title, inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)} · CRNA Critics</title></head>
    <body style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;padding:0 16px;color:#14231F;">
    ${emailHeaderHtml(BASE_URL, 560)}${inner}</body></html>`;
}
const DECLARE_HINTS = {
  practicing: "You take cases and you don't hire, schedule, recruit, or own the group.",
  chief: "You run or help run a CRNA department and have a say in staffing.",
  recruiter: "You're a CRNA, and you also place or recruit CRNAs.",
  owner: "Owner, partner, or manager of a group that employs or contracts CRNAs.",
};
app.get("/declare", (req, res) => {
  const row = declareRowFromToken(req.query.t);
  if (!row) return res.status(400).send(declarePage("Link expired", `<h2>Link expired or invalid</h2><p>Sign in at <a href="${BASE_URL}">crnacritics.com</a> — the question is the first thing you'll see — or reply to the email and we'll send a new link.</p>`));
  if (row.status !== "approved") return res.send(declarePage("Account not active", `<h2>This account isn't active.</h2><p>If you think that's a mistake, reply to the email.</p>`));
  if (row.declared_role) {
    return res.send(declarePage("Already answered", `<h2 style="color:#13A15A;">Already answered — thank you.</h2><p>You told us: <strong>${escapeHtml(declaredRoleLabel(row))}</strong>. If that's changed, email <a href="mailto:erichayslip@gmail.com">erichayslip@gmail.com</a>.</p>`));
  }
  const options = Object.entries(DECLARED_ROLES).map(([key, r]) => `
      <label style="display:block;border:1px solid #D8DDD9;border-radius:6px;padding:12px 14px;margin:8px 0;cursor:pointer;">
        <input type="radio" name="role" value="${key}" required style="margin-right:8px;">
        <strong>${escapeHtml(r.label)}</strong>
        <span style="font-size:11px;font-weight:bold;letter-spacing:.04em;padding:1px 6px;border-radius:3px;margin-left:6px;background:${r.readOnly ? "#FFF4E5" : "#E3F3EA"};color:${r.readOnly ? "#8A5A0A" : "#1F5C57"};">${r.readOnly ? "READ-ONLY" : "FULL MEMBERSHIP"}</span>
        <div style="font-size:12px;color:#6B756F;margin:4px 0 0 24px;">${escapeHtml(DECLARE_HINTS[key] || "")}</div>
      </label>`).join("");
  res.send(declarePage("Which best describes you?", `
    <h2 style="margin-bottom:4px;">Hi ${escapeHtml(firstNameOf(row.name))} — which best describes you?</h2>
    <p style="color:#555;margin-top:0;">CRNAs who hire, schedule, recruit, or own a group are welcome to read everything, but they don't rate — the ratings have to come from CRNAs with nothing at stake in them. Misstating your role is grounds for removal (Terms v1.1, Section 1).</p>
    <form method="post" action="/declare"><input type="hidden" name="t" value="${escapeHtml(String(req.query.t))}">
      ${options}
      <p style="font-size:12px;color:#6B756F;">We record your answer with the date, time and IP address, the same as your acceptance of the Terms.</p>
      <button type="submit" style="background:#13A15A;color:#fff;border:0;padding:13px 22px;border-radius:4px;font-weight:bold;font-size:16px;">Save my answer</button>
    </form>`));
});
app.post("/declare", express.urlencoded({ extended: false }), (req, res) => {
  const row = declareRowFromToken(req.body?.t);
  if (!row) return res.status(400).send(declarePage("Link expired", `<h2>Link expired or invalid</h2>`));
  if (row.status !== "approved") return res.send(declarePage("Account not active", `<h2>This account isn't active.</h2>`));
  if (row.declared_role) return res.send(declarePage("Already answered", `<h2 style="color:#13A15A;">Already answered — thank you.</h2>`));
  const out = recordDeclaration(row, String(req.body?.role || ""));
  if (out.error) return res.status(400).send(declarePage("Pick one", `<h2>Please pick one of the options.</h2><p><a href="/declare?t=${encodeURIComponent(String(req.body.t))}">Go back</a></p>`));
  res.send(declarePage("Thank you", `
    <h2 style="color:#13A15A;">Thank you — recorded.</h2>
    <p>You told us: <strong>${escapeHtml(out.label)}</strong>.</p>
    ${out.readOnly
      ? `<p style="background:#FFF4E5;border-left:4px solid #B87F1E;padding:10px 12px;">Your account is <strong>read-only</strong>: you can search and read every review, but can't post reviews or message reviewers. If your role changes, email <a href="mailto:erichayslip@gmail.com">erichayslip@gmail.com</a>.</p>`
      : `<p>You keep <strong>full membership</strong>${out.restoredFull ? " — posting and messaging are back on" : ""}. Nothing else to do.</p>`}
    <p><a href="${BASE_URL}" style="background:#123C3A;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Open CRNA Critics</a></p>`));
});

// The same question, answered from inside the app by a signed-in member.
app.post("/api/me/declare", requireSession, (req, res) => {
  const row = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(req.user.email);
  if (!row || row.role === "srna") return res.status(400).json({ error: "not_applicable" });
  if (row.declared_role) return res.status(400).json({ error: "already_declared", label: declaredRoleLabel(row) });
  const out = recordDeclaration(row, String(req.body?.declaredRole || ""));
  if (out.error) return res.status(400).json({ error: out.error });
  res.json(out);
});

// Admin: how the role check is going, and the buttons.
function declareOverview() {
  const rows = db.prepare("SELECT id, name, email, declared_role, declare_asked_at, declare_deadline_at, role, role_set_by_admin_at FROM access_requests WHERE status='approved' AND COALESCE(role,'crna') <> 'srna'").all();
  const cutoff = Date.now() - DECLARE_DEADLINE_DAYS * 24 * 60 * 60 * 1000;
  const open = rows.filter((r) => !r.declared_role);
  return {
    deadlineDays: DECLARE_DEADLINE_DAYS,
    total: rows.length,
    declared: rows.length - open.length,
    unasked: open.filter((r) => !r.declare_asked_at).map((r) => ({ id: r.id, name: r.name })),
    waiting: open.filter((r) => r.declare_asked_at && !r.declare_deadline_at && Date.parse(r.declare_asked_at) >= cutoff).map((r) => ({ id: r.id, name: r.name, askedAt: r.declare_asked_at })),
    // Asked more than the deadline ago, never answered, still full — ready for Eric's click.
    overdue: open.filter((r) => r.declare_asked_at && !r.declare_deadline_at && Date.parse(r.declare_asked_at) < cutoff && r.role === "crna" && !r.role_set_by_admin_at).map((r) => ({ id: r.id, name: r.name, askedAt: r.declare_asked_at })),
    paused: open.filter((r) => r.declare_deadline_at).map((r) => ({ id: r.id, name: r.name, since: r.declare_deadline_at })),
  };
}
app.get("/api/admin/declare", requireAdmin, (req, res) => res.json(declareOverview()));
// Send the question to everyone who has never been asked, or to one member (body.id) — resend included.
app.post("/api/admin/declare/send", requireAdmin, async (req, res) => {
  const id = req.body?.id ? String(req.body.id) : null;
  let rows;
  if (id) {
    const r = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(id);
    if (!r) return res.status(404).json({ error: "not_found" });
    if (!needsDeclaration(r)) return res.status(400).json({ error: "not_applicable" });
    rows = [r];
  } else {
    rows = db.prepare("SELECT * FROM access_requests WHERE status='approved' AND COALESCE(role,'crna') <> 'srna' AND declared_role IS NULL AND declare_asked_at IS NULL").all();
  }
  let sent = 0, failed = 0;
  for (const r of rows) {
    try { await askForDeclaration(r); sent += 1; } catch (e) { failed += 1; console.error("Role check send failed:", r.email, e.message); }
    if (rows.length > 1) await new Promise((resolve) => setTimeout(resolve, CAMPAIGN_DELAY_MS));
  }
  res.json({ ok: true, sent, failed, overview: declareOverview() });
});
// Eric's click: everyone overdue goes read-only until they answer, and gets the "paused" email.
app.post("/api/admin/declare/apply-deadline", requireAdmin, async (req, res) => {
  const { overdue } = declareOverview();
  let moved = 0;
  for (const o of overdue) {
    const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(o.id);
    if (!row) continue;
    db.prepare("UPDATE access_requests SET role='crna_readonly', declare_deadline_at=? WHERE id=?").run(new Date().toISOString(), row.id);
    moved += 1;
    sendDeclareTemplate("deadline", row).catch((e) => console.error("Declare deadline email failed:", e.message));
    await new Promise((resolve) => setTimeout(resolve, CAMPAIGN_DELAY_MS));
  }
  res.json({ ok: true, moved, overview: declareOverview() });
});

function srnaCtx(row, extra = {}) {
  return {
    name: row.name, email: row.email, reviewCount: 0, baseUrl: BASE_URL,
    studentName: row.name, school: row.srna_school || "", program: row.srna_program || "", gradYear: row.srna_grad_year || "", gradMonthYear: monthYearLabel(row),
    instructorName: row.instructor_name || "there",
    ...extra,
  };
}
// Sends one of the three SRNA templates (editable under Email → Templates), falling back to the built-in text.
function sendSrnaTemplate(key, { to, row, ctx, replyTo }) {
  const def = SRNA_TEMPLATES[key];
  const tpl = db.prepare("SELECT * FROM email_templates WHERE name = ? ORDER BY updated_at DESC LIMIT 1").get(def.name) || def;
  return sendEmail({ to, replyTo, subject: fillTokens(tpl.subject, ctx), html: plainMailHtml({ body: tpl.body, ctx }) });
}
function instructorTokenUrl(row, d) {
  const t = sign({ id: row.id, purpose: "srna_instructor" }, 60 * 60 * 24 * 60);
  return `${BASE_URL}/srna/verify?t=${encodeURIComponent(t)}&d=${d}`;
}
async function sendInstructorRequest(row) {
  const ctx = srnaCtx(row, { name: row.instructor_name, verifyUrl: instructorTokenUrl(row, "verify"), cantVerifyUrl: instructorTokenUrl(row, "cant") });
  await sendSrnaTemplate("ask", { to: row.instructor_email, row, ctx, replyTo: REPLY_TO });
  db.prepare("UPDATE access_requests SET instructor_asked_at=? WHERE id=?").run(new Date().toISOString(), row.id);
}
function sendSrnaWelcome(row) {
  const loginToken = sign({ email: row.email, purpose: "login" }, LINK_SECONDS);
  const ctx = srnaCtx(row, { loginUrl: `${BASE_URL}/api/auth/verify?token=${loginToken}` });
  return sendSrnaTemplate("welcome", { to: row.email, row, ctx, replyTo: REPLY_TO });
}
function notifyAdminSrna(subject, lines) {
  if (!process.env.ADMIN_EMAIL) return;
  sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">${emailHeaderHtml(BASE_URL, 480)}${lines.map((l) => `<p>${l}</p>`).join("")}<p style="color:#888;font-size:12px;">Manage SRNAs under Site admin → SRNAs.</p></div>`,
  }).catch((e) => console.error("SRNA admin notice failed:", e.message));
}

app.post("/api/request-access-srna", async (req, res) => {
  const { phone, acceptedTerms, termsVersion } = req.body || {};
  const email = String(req.body?.email || "").trim().toLowerCase();
  const instructorEmail = String(req.body?.instructorEmail || "").trim().toLowerCase();
  const clean = (v, n = 60) => String(v || "").trim().replace(/\s+/g, " ").slice(0, n);
  const firstName = clean(req.body?.firstName);
  const lastName = clean(req.body?.lastName);
  const school = clean(req.body?.school, 120);
  const program = clean(req.body?.program, 120);
  const gradYear = clean(req.body?.gradYear, 4);
  const gradMonth = parseInt(req.body?.gradMonth, 10);
  const instructorName = clean(req.body?.instructorName, 80);
  // School addresses only: both the student's and the program contact's email must end in .edu.
  // Eric's two test inboxes are exempt so he can try the student flow end to end.
  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.edu$/i.test(e) || SRNA_TEST_EMAILS.includes(String(e).toLowerCase());
  if (!firstName || !lastName) return res.status(400).json({ error: "first_last_required" });
  if (email && !emailOk(email)) return res.status(400).json({ error: "student_email_not_edu" });
  if (instructorEmail && !emailOk(instructorEmail)) return res.status(400).json({ error: "instructor_email_not_edu" });
  if (!school || !program || !/^20\d\d$/.test(gradYear) || !(gradMonth >= 1 && gradMonth <= 12) || !phone || !emailOk(email) || !instructorName || !emailOk(instructorEmail)) {
    return res.status(400).json({ error: "missing_fields" });
  }
  // Access runs through the end of the graduation month they enter, so it has to be in the future.
  const expiresAt = srnaExpiresAtFor(gradMonth, gradYear);
  if (Date.parse(expiresAt) <= Date.now()) return res.status(400).json({ error: "grad_in_past" });
  if (Number(gradYear) > new Date().getFullYear() + 6) return res.status(400).json({ error: "grad_too_far" });
  if (instructorEmail === email) return res.status(400).json({ error: "instructor_same_as_student" });
  if (!acceptedTerms) return res.status(400).json({ error: "terms_not_accepted" });
  const now = new Date().toISOString();
  const termsIp = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim().slice(0, 64);
  const termsUa = String(req.headers["user-agent"] || "").slice(0, 300);
  const termsV = String(termsVersion || "srna-unknown").slice(0, 32);
  const name = `${firstName} ${lastName}`;
  const existing = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email);
  // Never touch an approved account (a CRNA, or an SRNA already in) from this form.
  if (existing && existing.status === "approved") return res.status(409).json({ error: "already_member" });
  if (existing) {
    db.prepare(
      "UPDATE access_requests SET name=?, nbcrna_number='SRNA', phone=?, status='pending', role='srna', srna_school=?, srna_program=?, srna_grad_year=?, srna_grad_month=?, srna_expires_at=?, srna_expired_emailed_at=NULL, instructor_name=?, instructor_email=?, instructor_asked_at=NULL, instructor_decision=NULL, instructor_decided_at=NULL, requested_at=?, decided_at=NULL, terms_version=?, terms_accepted_at=?, terms_ip=?, terms_user_agent=?, sms_consent=0 WHERE email=?"
    ).run(name, String(phone).slice(0, 40), school, program, gradYear, gradMonth, expiresAt, instructorName, instructorEmail, now, termsV, now, termsIp, termsUa, email);
  } else {
    db.prepare(
      "INSERT INTO access_requests (id, name, nbcrna_number, email, phone, status, requested_at, terms_version, terms_accepted_at, terms_ip, terms_user_agent, sms_consent, role, srna_school, srna_program, srna_grad_year, srna_grad_month, srna_expires_at, instructor_name, instructor_email) VALUES (?,?,?,?,?, 'pending', ?,?,?,?,?,0,'srna',?,?,?,?,?,?,?)"
    ).run(crypto.randomUUID(), name, "SRNA", email, String(phone).slice(0, 40), now, termsV, now, termsIp, termsUa, school, program, gradYear, gradMonth, expiresAt, instructorName, instructorEmail);
  }
  const row = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email);
  res.json({ ok: true });
  try {
    await sendInstructorRequest(row);
    notifyAdminSrna(`CRNA Critics — SRNA application: ${escapeHtml(row.name)}`, [
      `<strong>${escapeHtml(row.name)}</strong> applied for student access (${escapeHtml(row.srna_school)} · ${escapeHtml(row.srna_program)} · ${escapeHtml(monthYearLabel(row))}).`,
      `Verification email sent to ${escapeHtml(row.instructor_name)} &lt;${escapeHtml(row.instructor_email)}&gt;. They'll be approved automatically when the contact taps "verify".`,
    ]);
  } catch (e) {
    console.error("Instructor email failed:", e.message);
    notifyAdminSrna(`CRNA Critics — SRNA application: ${escapeHtml(row.name)} (instructor email FAILED)`, [
      `<strong>${escapeHtml(row.name)}</strong> applied, but the email to ${escapeHtml(row.instructor_email)} failed: ${escapeHtml(e.message)}. Use "Resend" on the SRNAs tab.`,
    ]);
  }
});

// The program contact's page. GET only shows a confirm button (so a mail scanner that pre-opens
// links can't decide anything); POST records the answer.
const srnaPage = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
  <body style="font-family:Arial,sans-serif;max-width:480px;margin:50px auto;padding:0 16px;color:#14231F;">
  <div style="background:#0B1526;border-bottom:8px solid #13A15A;color:#fff;text-align:center;padding:14px;font-weight:bold;letter-spacing:1px;">CRNA CRITICS</div>${body}</body></html>`;
function srnaRowFromToken(t) {
  const payload = verify(String(t || ""));
  if (!payload || payload.purpose !== "srna_instructor" || !payload.id) return null;
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ? AND role = 'srna'").get(payload.id);
  return row || null;
}
app.get("/srna/verify", (req, res) => {
  const row = srnaRowFromToken(req.query.t);
  if (!row) return res.status(400).send(srnaPage("Link expired", `<h2>Link expired or invalid</h2><p>Please reply to the original email and we'll send a new one.</p>`));
  const d = req.query.d === "cant" ? "cant" : "verify";
  if (row.instructor_decision) {
    return res.send(srnaPage("Already answered", `<h2>Already answered</h2><p>Your answer for ${escapeHtml(row.name)} was recorded. Thank you.</p>`));
  }
  const yes = d === "verify";
  res.send(srnaPage("Confirm", `
    <h2 style="color:${yes ? "#13A15A" : "#8C3A32"};">${yes ? "Verify this student?" : "You can't verify this student?"}</h2>
    <p><strong>${escapeHtml(row.name)}</strong><br>${escapeHtml(row.srna_school || "")}<br>${escapeHtml(row.srna_program || "")} · expected graduation ${escapeHtml(monthYearLabel(row))}</p>
    <p style="color:#555;">${yes ? "This confirms they are currently enrolled in your program. They'll get student (read-only) access." : "They will not be given access automatically."}</p>
    <form method="post" action="/srna/verify"><input type="hidden" name="t" value="${escapeHtml(String(req.query.t))}"><input type="hidden" name="d" value="${d}">
      <button type="submit" style="background:${yes ? "#13A15A" : "#8C3A32"};color:#fff;border:0;padding:13px 22px;border-radius:4px;font-weight:bold;font-size:16px;">${yes ? "Yes, verify" : "Confirm: can't verify"}</button></form>`));
});
app.post("/srna/verify", express.urlencoded({ extended: false }), async (req, res) => {
  const row = srnaRowFromToken(req.body?.t);
  if (!row) return res.status(400).send(srnaPage("Link expired", `<h2>Link expired or invalid</h2>`));
  if (row.instructor_decision) return res.send(srnaPage("Already answered", `<h2>Already answered</h2><p>Your answer for ${escapeHtml(row.name)} was already recorded. Thank you.</p>`));
  const yes = req.body.d !== "cant";
  const now = new Date().toISOString();
  if (yes && row.srna_expires_at && Date.parse(row.srna_expires_at) <= Date.now()) {
    return res.send(srnaPage("Too late", `<h2>This student's graduation month has already passed.</h2><p>They can apply again as a CRNA with their NBCRNA credentials. Thank you.</p>`));
  }
  db.prepare("UPDATE access_requests SET instructor_decision=?, instructor_decided_at=? WHERE id=?").run(yes ? "verified" : "cant_verify", now, row.id);
  if (yes) {
    // Approve only if still pending: never override a decision Eric already made.
    const r = db.prepare("UPDATE access_requests SET status='approved', decided_at=? WHERE id=? AND status='pending'").run(now, row.id);
    if (r.changes === 1) {
      const fresh = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(row.id);
      sendSrnaWelcome(fresh).catch((e) => console.error("SRNA welcome failed:", e.message));
      sendSrnaTemplate("thanks", { to: row.instructor_email, row, ctx: srnaCtx(row, { name: row.instructor_name }), replyTo: REPLY_TO })
        .catch((e) => console.error("Instructor thank-you failed:", e.message));
      notifyAdminSrna(`CRNA Critics — SRNA verified: ${escapeHtml(row.name)}`, [`${escapeHtml(row.instructor_name)} verified <strong>${escapeHtml(row.name)}</strong>. Approved, sign-in link sent, instructor thanked.`]);
    }
    return res.send(srnaPage("Thank you", `<h2 style="color:#13A15A;">Verified. Thank you!</h2><p>${escapeHtml(row.name)} has been approved for student access. We'll send you a short thank-you email too.</p>`));
  }
  notifyAdminSrna(`CRNA Critics — SRNA could not be verified: ${escapeHtml(row.name)}`, [`${escapeHtml(row.instructor_name)} said they can't verify <strong>${escapeHtml(row.name)}</strong> (${escapeHtml(row.srna_school || "")}). They stay pending. Decide under Site admin → SRNAs.`]);
  res.send(srnaPage("Thank you", `<h2>Thanks for letting us know.</h2><p>${escapeHtml(row.name)} will not be given access automatically.</p>`));
});

// Back office
app.post("/api/admin/srna/:id/resend-instructor", requireAdmin, async (req, res) => {
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ? AND role = 'srna'").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.status !== "pending") return res.status(400).json({ error: "not_pending" });
  db.prepare("UPDATE access_requests SET instructor_decision=NULL, instructor_decided_at=NULL WHERE id=?").run(row.id);
  try { await sendInstructorRequest(db.prepare("SELECT * FROM access_requests WHERE id = ?").get(row.id)); res.json({ ok: true, sentTo: row.instructor_email }); }
  catch (e) { res.status(502).json({ error: "send_failed", message: e.message }); }
});
// Approve (without waiting on the contact) or reject a student by hand. Rejecting sends no email.
app.post("/api/admin/srna/:id/decide", requireAdmin, async (req, res) => {
  const decision = req.body?.decision;
  if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ error: "bad_decision" });
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ? AND role = 'srna'").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (decision === "approved" && row.srna_expires_at && Date.parse(row.srna_expires_at) <= Date.now()) return res.status(400).json({ error: "window_passed" });
  db.prepare("UPDATE access_requests SET status=?, decided_at=? WHERE id=?").run(decision, new Date().toISOString(), row.id);
  if (decision === "approved") sendSrnaWelcome(row).catch((e) => console.error("SRNA welcome failed:", e.message));
  res.json({ ok: true });
});

async function handleNewRequest(row, { wasRejected = false } = {}) {
  let check = null;
  if (AUTO_VERIFY) {
    try {
      check = await checkApplicant(row);
    } catch (e) {
      check = { verified: false, error: true, reason: `couldn't reach the NBCRNA lookup (${e.message})` };
    }
    db.prepare("UPDATE access_requests SET nbcrna_check=?, nbcrna_checked_at=? WHERE id=?").run(
      JSON.stringify(check).slice(0, 2000),
      new Date().toISOString(),
      row.id
    );
  }

  // Someone Eric rejected before never gets back in automatically — he decides.
  if (check && check.verified && wasRejected) {
    check = { ...check, verified: false, reason: "NBCRNA matches, but you rejected this email before — your call" };
  }
  // Only a request that is still pending — never overrides a decision Eric already made.
  if (check && check.verified) {
    const r = db
      .prepare("UPDATE access_requests SET status='approved', decided_at=? WHERE id=? AND status='pending'")
      .run(new Date().toISOString(), row.id);
    if (r.changes === 1) {
      sendWelcomeEmail(row).catch((e) => console.error("Failed to send welcome email:", e.message));
      // No admin notice on auto-approval (Eric turned it off Oct 5, 2026).
      return;
    }
  }
  sendVerifyRequestEmail(row, check);
}

function nbcrnaRecordLine(check) {
  const rec = check && check.record;
  if (!rec) return "";
  return `NBCRNA shows: ${escapeHtml(rec.name)} · #${escapeHtml(rec.certNumber || rec.id)} · ${escapeHtml(rec.status)} · ${escapeHtml(rec.period)}${rec.residence ? " · " + escapeHtml(rec.residence) : ""}`;
}

function sendVerifyRequestEmail(row, check) {
  const approveToken = sign({ id: row.id, decision: "approved" }, 60 * 60 * 24 * 30);
  const rejectToken = sign({ id: row.id, decision: "rejected" }, 60 * 60 * 24 * 30);
  const approveUrl = `${BASE_URL}/api/admin/decide/${approveToken}`;
  const rejectUrl = `${BASE_URL}/api/admin/decide/${rejectToken}`;

  if (process.env.ADMIN_EMAIL) {
    sendEmail({
      to: process.env.ADMIN_EMAIL,
      // Replying to the alert writes to the CRNA who just applied, not to the site.
      replyTo: row.email,
      subject: `CRNA Critics — verify ${escapeHtml(row.name)}?`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
          ${emailHeaderHtml(BASE_URL, 480)}
          <h2 style="color:#123C3A;">New ${row.role === "srna" ? "SRNA (student)" : "CRNA"} verification request</h2>
          <p><strong>${escapeHtml(row.name)}</strong></p>
          ${declaredRoleLabel(row) ? `<p>Says they are: <strong>${escapeHtml(declaredRoleLabel(row))}</strong>${isReadOnlyRole(row.role) ? ` &mdash; <span style="color:#8A5A0A;">will be read-only</span> (no reviews, no messages)` : ""}</p>` : ""}
          <p>NBCRNA #: ${escapeHtml(row.nbcrna_number)}<br/>
             Email: ${escapeHtml(row.email)}<br/>
             Phone: ${escapeHtml(row.phone)}</p>
          <p style="color:#555;font-size:12px;">Terms v${escapeHtml(String(row.terms_version || "?"))} accepted ${escapeHtml(String(row.terms_accepted_at || ""))} from ${escapeHtml(String(row.terms_ip || "unknown IP"))}${row.sms_consent ? " &middot; opted in to automated calls/texts" : ""}</p>
          ${check ? `<p style="background:#FFF4E5;border-left:4px solid #B87F1E;padding:10px 12px;">Automatic NBCRNA check: <strong>not verified</strong> &mdash; ${escapeHtml(check.reason)}.${check.record ? "<br/>" + nbcrnaRecordLine(check) : ""}</p>` : ""}
          <p style="margin-top:24px;">
            <a href="${approveUrl}" style="background:#1F5C57;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;margin-right:12px;">Approve</a>
            <a href="${rejectUrl}" style="background:#8C3A32;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Reject</a>
          </p>
          <p style="color:#888;font-size:12px;margin-top:24px;">These links work without logging in. Approve decides it in one tap; Reject lets you pick the reason they'll be emailed. Expires in 30 days.</p>
        </div>
      `,
    }).catch((e) => console.error("Failed to send admin notification email:", e.message));
  }

}


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

  // Reject no longer happens on the tap itself: it opens a page where Eric picks the
  // reason, and the applicant is emailed that reason. (Also means an email scanner
  // that pre-opens links can never reject anyone.)
  if (payload.decision === "rejected") {
    return res.send(rejectFormPage(row, `/api/admin/decide/${encodeURIComponent(req.params.token)}`));
  }

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

// ---------- Reject with a reason (Sep 25, 2026) ----------
//
// Eric picks why (preset reasons + optional note) and the applicant gets an email
// saying so, with how to fix it and re-apply. Same page from the emailed Reject
// link (token) and from the admin dashboard (admin cookie).

const REJECT_REASONS = {
  name: {
    label: "Name doesn't match the NBCRNA record",
    text: "The name you entered doesn't match the name on your NBCRNA record. Please apply again using your first and last name exactly as they appear on your NBCRNA certification (your legal name, not a nickname).",
  },
  number: {
    label: "NBCRNA number not found or doesn't match",
    text: "We couldn't match the NBCRNA number you entered to your record. Please double-check your certification number (it's in your NBCRNA portal account and on your certification card) and apply again.",
  },
  lapsed: {
    label: "Certification lapsed or not active",
    text: "NBCRNA doesn't currently show your certification as active. CRNA Critics is limited to currently certified CRNAs. If you've just recertified, NBCRNA's public record can take a few days to update, so you're welcome to apply again once it does.",
  },
  not_crna: {
    label: "Couldn't confirm they're a CRNA",
    text: "We weren't able to confirm from the NBCRNA public record that you're a certified CRNA. CRNA Critics is open only to CRNAs, so no agents, agencies, MDAs or AAs.",
  },
  other: { label: "Other (explain in the note)", text: "" },
};

// Best guess at the reason from the automatic NBCRNA check, so the right one is pre-selected.
function suggestRejectReason(row) {
  let reason = "";
  try { reason = String(JSON.parse(row.nbcrna_check || "{}").reason || ""); } catch (_) {}
  if (/name mismatch/i.test(reason)) return "name";
  if (/number|no NBCRNA record/i.test(reason)) return "number";
  if (/status is|doesn't cover today/i.test(reason)) return "lapsed";
  return "";
}

function rejectPageShell(title, inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title} · CRNA Critics</title></head>
    <body style="font-family:Arial,sans-serif;max-width:520px;margin:32px auto;padding:0 16px;color:#14231F;">${inner}</body></html>`;
}

function rejectFormPage(row, action) {
  if (row.status === "rejected") {
    return rejectPageShell("Already rejected", `<h2 style="color:#8C3A32;">Already rejected</h2>
      <p>${escapeHtml(row.name)} was already rejected${row.reject_reason ? ` (${escapeHtml(row.reject_reason)})` : ""}.</p>`);
  }
  let check = null;
  try { check = JSON.parse(row.nbcrna_check || "null"); } catch (_) {}
  const pick = suggestRejectReason(row);
  const options = Object.entries(REJECT_REASONS).map(([key, r]) => `
      <label style="display:block;border:1px solid #D8DDD9;border-radius:6px;padding:10px 12px;margin:8px 0;cursor:pointer;">
        <input type="radio" name="reason" value="${key}" ${key === pick ? "checked" : ""} required style="margin-right:8px;">
        <strong>${escapeHtml(r.label)}</strong>
        ${r.text ? `<div style="font-size:12px;color:#6B756F;margin:4px 0 0 24px;">${escapeHtml(r.text)}</div>` : ""}
      </label>`).join("");
  return rejectPageShell(`Reject ${escapeHtml(row.name)}`, `
    <h2 style="color:#8C3A32;margin-bottom:4px;">Reject ${escapeHtml(row.name)}?</h2>
    <p style="margin-top:0;color:#6B756F;font-size:14px;">NBCRNA #${escapeHtml(row.nbcrna_number)} · ${escapeHtml(row.email)}</p>
    ${row.status === "approved" ? `<p style="background:#FFF4E5;border-left:4px solid #B87F1E;padding:10px 12px;">Heads up: this person is currently <strong>approved</strong>. Rejecting will sign them out.</p>` : ""}
    ${check && check.reason ? `<p style="background:#FFF4E5;border-left:4px solid #B87F1E;padding:10px 12px;font-size:14px;">Automatic NBCRNA check: ${escapeHtml(check.reason)}.${check.record ? "<br/>" + nbcrnaRecordLine(check) : ""}</p>` : ""}
    <form method="post" action="${escapeHtml(action)}">
      <p style="font-weight:bold;margin-bottom:0;">Why? (they'll see this)</p>
      ${options}
      <p style="font-weight:bold;margin-bottom:4px;">Note to include in the email <span style="font-weight:normal;color:#6B756F;">(optional, required for Other)</span></p>
      <textarea name="note" rows="3" maxlength="1000" style="width:100%;box-sizing:border-box;font:inherit;padding:8px;border:1px solid #D8DDD9;border-radius:6px;"></textarea>
      <label style="display:block;margin:12px 0;font-size:14px;"><input type="checkbox" name="silent" value="1" style="margin-right:8px;">Reject without emailing them (e.g. obvious spam)</label>
      <button type="submit" style="background:#8C3A32;color:#fff;border:0;padding:12px 20px;border-radius:4px;font-weight:bold;font-size:16px;">Reject</button>
    </form>`);
}

function sendRejectionEmail(row, reasonKey, note) {
  const r = REJECT_REASONS[reasonKey];
  const first = firstNameOf(row.name) || row.name;
  return sendEmail({
    to: row.email,
    replyTo: REPLY_TO,
    subject: "Your CRNA Critics verification",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        ${emailHeaderHtml(BASE_URL, 480)}
        <h2 style="color:#123C3A;">We couldn't verify you yet</h2>
        <p>Hi ${escapeHtml(first)}, thanks for applying to CRNA Critics. We check every applicant against the NBCRNA public record before approving, and we weren't able to verify your account this time.</p>
        <p style="background:#F6F3EC;border-left:4px solid #B87F1E;padding:10px 12px;"><strong>Reason:</strong> ${r.text ? escapeHtml(r.text) : escapeHtml(note)}${r.text && note ? `<br/><br/>${escapeHtml(note)}` : ""}</p>
        <p><strong>How to get re-verified:</strong> signing in won't work on this account, so you'll need to apply again as a first-time user:</p>
        <ol style="padding-left:20px;margin-top:0;">
          <li>Go to <a href="${BASE_URL}" style="color:#123C3A;">crnacritics.com</a>.</li>
          <li>Tap <strong>First time here? Get verified</strong> (not <em>Already a member? Sign in</em>).</li>
          <li>Use this same email address, enter your name and NBCRNA number exactly as they appear on your NBCRNA record, accept the terms and submit.</li>
        </ol>
        <p>We'll review it again. Once you're approved you'll get a new welcome email with a link to sign in and create your password.</p>
        <p>If you think this is a mistake, just reply to this email.</p>
      </div>
    `,
  });
}

// Records the rejection and (unless silent) emails the applicant. Returns the result page.
async function rejectWithReason(row, body) {
  const key = String(body.reason || "");
  const note = String(body.note || "").trim().slice(0, 1000);
  const silent = body.silent === "1";
  const again = (msg) => rejectPageShell("Reject", `<p style="color:#8C3A32;font-weight:bold;">${msg}</p><p><a href="javascript:history.back()">&larr; Back</a></p>`);
  if (!REJECT_REASONS[key]) return again("Pick a reason.");
  if (key === "other" && !note) return again("Add a note when you pick Other. That's what they'll read.");
  if (row.status === "rejected") return rejectFormPage(row, "");

  const label = REJECT_REASONS[key].label;
  db.prepare("UPDATE access_requests SET status='rejected', decided_at=?, reject_reason=?, reject_note=?, reject_emailed_at=NULL WHERE id=?")
    .run(new Date().toISOString(), label, note || null, row.id);

  let emailLine = "No email was sent.";
  if (!silent) {
    try {
      await sendRejectionEmail(row, key, note);
      db.prepare("UPDATE access_requests SET reject_emailed_at=? WHERE id=?").run(new Date().toISOString(), row.id);
      emailLine = `They've been emailed at ${escapeHtml(row.email)} with the reason and how to re-apply.`;
    } catch (e) {
      console.error("Failed to send rejection email:", e.message);
      emailLine = `<span style="color:#8C3A32;font-weight:bold;">But the email to ${escapeHtml(row.email)} failed to send (${escapeHtml(e.message)}).</span> Write to them directly.`;
    }
  }
  return rejectPageShell("Rejected", `<h2 style="color:#8C3A32;">Rejected</h2>
    <p>${escapeHtml(row.name)} &mdash; ${escapeHtml(label)}.</p><p>${emailLine}</p>`);
}

app.post("/api/admin/decide/:token", express.urlencoded({ extended: false }), async (req, res) => {
  const payload = verify(req.params.token);
  if (!payload || !payload.id || payload.decision !== "rejected") {
    return res.status(400).send(rejectPageShell("Link expired", "<h2>Link expired or invalid</h2><p>Reject them from the admin dashboard instead.</p>"));
  }
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(payload.id);
  if (!row) return res.status(404).send(rejectPageShell("Not found", "<h2>Request not found</h2><p>It may have been removed.</p>"));
  res.send(await rejectWithReason(row, req.body || {}));
});

// Same page from the admin dashboard's Reject button (admin cookie instead of a token).
function adminPage(req, res, next) {
  const payload = verify(req.cookies.admin_session);
  if (!payload || payload.role !== "admin") {
    return res.status(401).send(rejectPageShell("Sign in", "<h2>Admin sign-in needed</h2><p>Open Site admin on crnacritics.com first, then try again.</p>"));
  }
  next();
}

app.get("/api/admin/reject/:id", adminPage, (req, res) => {
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).send(rejectPageShell("Not found", "<h2>Request not found</h2>"));
  res.send(rejectFormPage(row, `/api/admin/reject/${encodeURIComponent(row.id)}`));
});

app.post("/api/admin/reject/:id", adminPage, express.urlencoded({ extended: false }), async (req, res) => {
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).send(rejectPageShell("Not found", "<h2>Request not found</h2>"));
  const page = await rejectWithReason(row, req.body || {});
  res.send(page.replace("</body>", `<p><a href="/" style="color:#123C3A;">&larr; Back to the site</a></p></body>`));
});

// ---------- CRNA sign-in ----------
//
// First sign-in happens through the emailed welcome link (valid 24h); the member
// then creates a password and signs in with email + password from there on.
// Emailed links remain available as a "forgot password" fallback.

function sendWelcomeEmail(row) {
  if (row.role === "srna") return sendSrnaWelcome(row);
  const loginToken = sign({ email: row.email, purpose: "login" }, LINK_SECONDS);
  const loginUrl = `${BASE_URL}/api/auth/verify?token=${loginToken}`;
  return sendEmail({
    to: row.email,
    replyTo: REPLY_TO,
    subject: row.role === "srna" ? "You're approved for student access on CRNA Critics" : "You're verified on CRNA Critics",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        ${emailHeaderHtml(BASE_URL, 480)}
        <h2 style="color:#123C3A;">You're verified</h2>
        ${row.role === "srna"
          ? `<p>Hi ${escapeHtml(row.name)}, you're approved for student (SRNA) access to CRNA Critics. You can search and read every review. Posting and messaging are for practicing CRNAs, so your account is read-only until you're certified.</p>`
          : row.role === "crna_readonly"
          ? `<p>Hi ${escapeHtml(row.name)}, you're approved as a verified CRNA on CRNA Critics with <strong>read-only access</strong>.</p>
        <p style="background:#FFF4E5;border-left:4px solid #B87F1E;padding:10px 12px;">You told us you're a ${escapeHtml(declaredRoleLabel(row).toLowerCase() || "CRNA on the staffing side")}. As agreed on the sign-up form and in Section 1 of the Terms, members who hire, schedule, recruit, or own a group can search and read every review but can't post reviews or message reviewers &mdash; the ratings have to come from CRNAs with nothing at stake in them. If your situation changes, reply to this email and we'll update your account.</p>`
          : `<p>Hi ${escapeHtml(row.name)}, you're approved as a verified CRNA on CRNA Critics.</p>
        <p style="background:#EEF6F1;border-left:4px solid #1F5C57;padding:10px 12px;">&#128274; <strong>You're anonymous.</strong> Your name is never shown on the site — every review you post appears as "Anonymous CRNA," so no one will know who you are.</p>`}
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

  const row = lapseIfExpired(db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email));
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
  const row = lapseIfExpired(db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email));
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
  const row = lapseIfExpired(db.prepare("SELECT * FROM access_requests WHERE email = ?").get(payload.email));
  if (!row || row.status !== "approved") {
    return res.status(403).send(row && row.status === "expired" ? "Your student access has expired. Sign up as a CRNA at crnacritics.com with your NBCRNA credentials." : "This account is not an approved CRNA.");
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

// Self-service profile deletion, open to every member type (CRNA and SRNA student).
// The member must send {confirm:"DELETE"}. Their private messages, feedback answers and mailing
// log rows are always erased. Reviews follow their choice: {deleteReviews:true} removes them;
// otherwise they stay up (already anonymous) but are cut loose from the account — the stored
// email/name become a placeholder, so nothing on the site or in the admin points at the person.
app.delete("/api/me", requireSession, (req, res) => {
  if (String(req.body?.confirm || "").trim().toUpperCase() !== "DELETE") {
    return res.status(400).json({ error: "confirmation_required" });
  }
  const row = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(req.user.email);
  if (!row) return res.status(404).json({ error: "not_found" });
  const email = row.email;
  const alsoReviews = req.body?.deleteReviews === true;
  const out = db.transaction(() => {
    const convIds = db.prepare("SELECT id FROM conversations WHERE asker_email = ? OR reviewer_email = ?").all(email, email).map((c) => c.id);
    for (const id of convIds) {
      db.prepare("DELETE FROM message_flags WHERE conversation_id = ?").run(id);
      db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
      db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
    }
    let deletedReviews = 0;
    let keptReviews = 0;
    if (alsoReviews) {
      db.prepare("DELETE FROM review_flags WHERE reviewer_email = ?").run(email);
      deletedReviews = db.prepare("DELETE FROM reviews WHERE reviewer_email = ?").run(email).changes;
    } else {
      const placeholder = `deleted-${row.id}@deleted.invalid`;
      keptReviews = db.prepare("UPDATE reviews SET reviewer_email = ?, reviewer_name = 'Deleted member' WHERE reviewer_email = ?").run(placeholder, email).changes;
      db.prepare("UPDATE review_flags SET reviewer_email = ? WHERE reviewer_email = ?").run(placeholder, email);
    }
    db.prepare("DELETE FROM beta_feedback WHERE request_id = ?").run(row.id);
    db.prepare("DELETE FROM email_campaign_recipients WHERE lower(email) = lower(?)").run(email);
    db.prepare("DELETE FROM access_requests WHERE id = ?").run(row.id);
    return { deletedReviews, keptReviews };
  })();
  res.clearCookie("session", { path: "/" });
  if (process.env.ADMIN_EMAIL) {
    const who = row.role === "srna" ? "student (SRNA)" : "CRNA";
    const reviewsLine = row.role === "srna" ? "" : alsoReviews ? `<p>Their ${out.deletedReviews} review(s) were deleted with the profile.</p>` : `<p>Their ${out.keptReviews} review(s) were kept and disconnected from the account.</p>`;
    sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `CRNA Critics — ${row.name} deleted their profile`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">${emailHeaderHtml(BASE_URL, 480)}<p><strong>${escapeHtml(row.name)}</strong> (${who}) deleted their own profile.</p>${reviewsLine}<p style="color:#888;font-size:12px;">No action needed. They can apply again at any time.</p></div>`,
    }).catch((e) => console.error("Profile-deleted notice failed:", e.message));
  }
  res.json({ ok: true, ...out });
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
  const flags = db.prepare("SELECT COUNT(*) AS n FROM review_flags WHERE reviewer_email = ? AND status = 'open'").get(r.email);
  return {
    ...rest,
    hasPassword: !!password_hash,
    reviewCount: counted ? counted.n : 0,
    feedbackSubmittedAt: fb ? fb.submitted_at : null,
    openFlags: flags ? flags.n : 0,
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

// Move a CRNA between full membership and read-only. Used when Eric learns a member is a
// recruiter / chief / owner (or has stopped being one). Students are not touched by this.
// Going read-only can also pull the member's reviews — the right call for someone who
// misrepresented themselves on the form. The member is emailed either way so the change
// never looks like a bug.
app.post("/api/admin/requests/:id/tier", requireAdmin, async (req, res) => {
  const tier = req.body?.tier === "readonly" ? "readonly" : req.body?.tier === "full" ? "full" : null;
  if (!tier) return res.status(400).json({ error: "bad_tier" });
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.role === "srna") return res.status(400).json({ error: "student" });
  const newRole = tier === "readonly" ? "crna_readonly" : "crna";
  let pulledReviews = 0;
  if (tier === "readonly" && req.body?.pullReviews) {
    pulledReviews = db.prepare("DELETE FROM reviews WHERE reviewer_email = ?").run(row.email).changes;
  }
  db.prepare("UPDATE access_requests SET role=?, role_set_by_admin_at=?, declare_deadline_at=NULL WHERE id=?").run(newRole, new Date().toISOString(), row.id);
  if (row.status === "approved" && req.body?.notify !== false) {
    sendTierChangeEmail({ ...row, role: newRole }, { pulledReviews }).catch((e) => console.error("Tier-change email failed:", e.message));
  }
  res.json({ ok: true, role: newRole, pulledReviews });
});

function sendTierChangeEmail(row, { pulledReviews = 0, declared = false } = {}) {
  const readOnly = row.role === "crna_readonly";
  return sendEmail({
    to: row.email,
    replyTo: REPLY_TO,
    subject: readOnly ? "Your CRNA Critics account is now read-only" : "Your CRNA Critics account now has full access",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        ${emailHeaderHtml(BASE_URL, 480)}
        <h2 style="color:#123C3A;">${readOnly ? "Your account is now read-only" : "You now have full access"}</h2>
        <p>Hi ${escapeHtml(row.name)},</p>
        ${readOnly
          ? `<p>${declared ? `Based on your answer (<strong>${escapeHtml(declaredRoleLabel(row))}</strong>), your` : "Your"} CRNA Critics account ${declared ? "is now" : "has been changed to"} <strong>read-only</strong>. You can still sign in, search, and read every review, but you can no longer post reviews or message reviewers.</p>
             <p style="background:#FFF4E5;border-left:4px solid #B87F1E;padding:10px 12px;">Under Section 1 of the Terms, members who hire, schedule, recruit, or own an anesthesia group read the site but don't write on it, so the ratings come only from CRNAs with nothing at stake in them.${pulledReviews ? ` The ${pulledReviews} review${pulledReviews === 1 ? "" : "s"} posted from this account ${pulledReviews === 1 ? "has" : "have"} been removed from the site.` : ""}</p>
             <p>If you think this is a mistake, or your situation has changed, reply to this email.</p>`
          : `<p>Your CRNA Critics account now has <strong>full membership</strong>: you can post reviews and use "Ask this reviewer" like any other practicing CRNA. The Terms you accepted still apply &mdash; first-hand experiences only, and nothing posted to help or harm an employer, agency, or group you have a stake in.</p>`}
        <p><a href="${BASE_URL}" style="background:#123C3A;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Open CRNA Critics</a></p>
      </div>
    `,
  });
}

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
  const rows = db.prepare("SELECT * FROM access_requests WHERE status = 'approved' AND COALESCE(role,'crna') <> 'srna' ORDER BY name").all();
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
    ? { name: row.name, email: row.email, reviewCount: reviewCountFor(row.email), baseUrl: BASE_URL, feedbackUrl: feedbackUrlFor(row), declareUrl: declareUrlFor(row), declareDays: DECLARE_DEADLINE_DAYS }
    : { name: "Jane Doe, CRNA", email: "jane@example.com", reviewCount: 2, baseUrl: BASE_URL, feedbackUrl: `${BASE_URL}/feedback`, declareUrl: `${BASE_URL}/declare?t=preview`, declareDays: DECLARE_DEADLINE_DAYS };
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
      const ctx = { name: member.name, email: member.email, reviewCount: reviewCountFor(member.email), baseUrl: BASE_URL, feedbackUrl: feedbackUrlFor(member), declareUrl: declareUrlFor(member), declareDays: DECLARE_DEADLINE_DAYS };
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
        if (/\{\{\s*declare_link\s*\}\}/i.test(body)) {
          db.prepare("UPDATE access_requests SET declare_asked_at = COALESCE(declare_asked_at, ?) WHERE id = ?").run(new Date().toISOString(), member.id);
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
  const approved = db.prepare("SELECT * FROM access_requests WHERE status = 'approved' AND COALESCE(role,'crna') <> 'srna'").all();
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
  if (row.status !== "approved" || row.bulk_unsubscribed || isReadOnlyRole(row.role)) return false;
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

// ---------- review guard: daily scan against the Review Guidelines ----------
// Once a day (inside the morning window starting SCAN_HOUR Eastern) every review that
// is new or was edited since the last scan is checked by server/guard.js. Each hit
// becomes an open row in review_flags (the Alerts tab) and Eric gets a summary email.
// Members are NEVER emailed automatically; Eric chooses per flag: email / delete / ignore.
const SCAN_HOUR = Number(process.env.SCAN_HOUR || 9);
const SCAN_ENABLED = process.env.REVIEW_SCAN !== "off";

function kvGet(key) { const r = db.prepare("SELECT value FROM kv WHERE key = ?").get(key); return r ? r.value : null; }
function kvSet(key, value) { db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value)); }

function reviewSubjectLine(row) {
  const parts = [];
  if (row.hospital_name) parts.push(row.hospital_name);
  if (row.group_name) parts.push(row.group_name);
  if (row.agency_name) parts.push(row.agency_name);
  if (row.agent_name) parts.push(row.agent_name);
  return parts.join(" / ") || "your review";
}

function flagCardHtml(f) {
  const color = f.severity === "high" ? "#8C3A32" : f.severity === "medium" ? "#B87F1E" : "#6B756F";
  return `
    <div style="border-left:4px solid ${color};padding:10px 14px;margin:14px 0;background:#F7F8F5;">
      <div style="font-weight:bold;color:${color};font-size:13px;">${escapeHtml(f.label)} <span style="font-weight:normal;color:#6B756F;">— in your ${escapeHtml(f.where_found || f.where)}</span></div>
      <p style="margin:8px 0;font-style:italic;color:#3C4A45;">"${escapeHtml(f.excerpt)}"</p>
      <p style="margin:8px 0;"><strong>Why it matters:</strong> ${escapeHtml(f.issue)}</p>
      <p style="margin:8px 0;"><strong>A better way to say it:</strong> ${escapeHtml(f.suggestion)}</p>
    </div>`;
}

const NOTICE_TEMPLATE_NAME = "Review guideline notice";
function ensureNoticeTemplate() {
  if (db.prepare("SELECT 1 FROM email_templates WHERE name = ?").get(NOTICE_TEMPLATE_NAME)) return;
  const now = new Date().toISOString();
  db.prepare("INSERT INTO email_templates (id, name, category, subject, body, created_at, updated_at) VALUES (?,?,?,?,?,?,?)").run(
    crypto.randomUUID(), NOTICE_TEMPLATE_NAME, "Alerts",
    "A quick look at your CRNA Critics review of {{review_subject}}",
    `Hi {{first_name}},

Thank you for posting a review — it's exactly what makes the site useful. I read every review that goes up, and I wanted to flag something in your review of {{review_subject}} that could be worth a second look under the Online Review Instructions & Guidelines. This is about protecting you: the person who writes a review is the one who answers for it, and a small wording change makes a review both safer and more useful to the next CRNA.

{{flags}}

You can edit the review any time under My reviews on the site — the score and everything else stays. If you think the wording is fine as it is, just reply and tell me.

{{cta}}

— Eric, CRNA Critics`,
    now, now);
}
ensureNoticeTemplate();

function sendGuidelineNoticeEmail(member, row, flags) {
  const tpl = db.prepare("SELECT * FROM email_templates WHERE name = ? ORDER BY updated_at DESC LIMIT 1").get(NOTICE_TEMPLATE_NAME);
  if (tpl) {
    const ctx = {
      name: member.name, email: member.email, reviewCount: reviewCountFor(member.email), baseUrl: BASE_URL,
      feedbackUrl: feedbackUrlFor(member), reviewSubject: reviewSubjectLine(row),
      flagsHtml: flags.map(flagCardHtml).join(""),
    };
    return sendEmail({ to: member.email, replyTo: REPLY_TO, subject: fillTokens(tpl.subject, ctx), html: campaignHtml({ body: tpl.body, ctx, unsubscribeUrl: unsubscribeUrlFor(member.email) }) });
  }
  const subject = `A quick look at your CRNA Critics review of ${reviewSubjectLine(row)}`;
  return sendEmail({
    to: member.email,
    replyTo: REPLY_TO,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;font-size:15px;line-height:1.55;color:#14231F;">
        ${emailHeaderHtml(BASE_URL, 560)}
        <p>Hi ${escapeHtml(firstNameOf(member.name))},</p>
        <p>Thank you for posting a review — it's exactly what makes the site useful. Our automated check of new reviews flagged ${flags.length === 1 ? "one thing" : `${flags.length} things`} in your review of <strong>${escapeHtml(reviewSubjectLine(row))}</strong> that could be worth a second look under the <a href="${BASE_URL}" style="color:#13A15A;">Online Review Instructions &amp; Guidelines</a>. This is about protecting <em>you</em>: the person who writes a review is the one who answers for it, and small wording changes make a review both safer and more useful to the next CRNA.</p>
        ${flags.map(flagCardHtml).join("")}
        <p>You can edit the review any time under <strong>My reviews</strong> on the site — the score and everything else stays. If you read this and think the wording is fine as it is, no action is needed; this is an automated check and it can be over-cautious.</p>
        <p><a href="${BASE_URL}" style="background:#0B1526;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Open My reviews</a></p>
        <p style="color:#6B756F;font-size:13px;">Questions? Just reply to this email.<br/>— Eric, CRNA Critics</p>
      </div>`,
  });
}

function sendAdminScanSummary(newFlags) {
  if (!process.env.ADMIN_EMAIL || newFlags.length === 0) return Promise.resolve();
  const byReviewer = {};
  newFlags.forEach((f) => { (byReviewer[f.reviewer_name || f.reviewer_email] = byReviewer[f.reviewer_name || f.reviewer_email] || []).push(f); });
  const html = Object.entries(byReviewer).map(([who, fs]) => `
    <h3 style="margin:16px 0 4px;color:#8C3A32;">${escapeHtml(who)} <span style="font-weight:normal;color:#6B756F;font-size:13px;">— ${escapeHtml(fs[0].subject)}</span></h3>
    ${fs.map((f) => `<p style="margin:4px 0;"><strong>${escapeHtml(f.severity.toUpperCase())}</strong> · ${escapeHtml(f.label)} — <em>"${escapeHtml(f.excerpt)}"</em></p>`).join("")}`).join("");
  return sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: `CRNA Critics — ${newFlags.length} review alert${newFlags.length === 1 ? "" : "s"} to look at`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;font-size:14px;line-height:1.5;">${emailHeaderHtml(BASE_URL, 560)}<p>The daily review scan flagged the following. Nobody has been emailed. Open <strong>Site admin → Alerts</strong> to read each one and choose: email the CRNA, delete the review, or ignore.</p>${html}</div>`,
  }).catch((e) => console.error("Admin scan summary failed:", e.message));
}

async function runReviewScan({ all = false, notify = true } = {}) {
  const since = all ? null : kvGet("review_scan_last");
  const rows = since
    ? db.prepare("SELECT * FROM reviews WHERE date > ? OR (edited_at IS NOT NULL AND edited_at > ?)").all(since, since)
    : db.prepare("SELECT * FROM reviews").all();
  const startedAt = new Date().toISOString();
  const newFlags = [];
  const selOpen = db.prepare("SELECT * FROM review_flags WHERE review_id = ? AND status = 'open'");
  const insert = db.prepare("INSERT INTO review_flags (id, review_id, reviewer_email, rule, severity, label, where_found, excerpt, issue, suggestion, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,'open',?)");
  const resolve = db.prepare("UPDATE review_flags SET status='resolved', resolved_at=?, resolved_by='edit' WHERE id = ?");
  const updateExcerpt = db.prepare("UPDATE review_flags SET where_found=?, excerpt=? WHERE id = ?");

  for (const row of rows) {
    const hits = scanReview(row);
    const open = selOpen.all(row.id);
    // Flags whose rule no longer matches were fixed by an edit.
    open.forEach((f) => { if (f.rule !== "member_report" && !hits.find((h) => h.rule === f.rule)) resolve.run(startedAt, f.id); });
    for (const h of hits) {
      const existing = open.find((f) => f.rule === h.rule);
      if (existing) { updateExcerpt.run(h.where, h.excerpt, existing.id); continue; }
      const id = crypto.randomUUID();
      insert.run(id, row.id, row.reviewer_email, h.rule, h.severity, h.label, h.where, h.excerpt, h.issue, h.suggestion, startedAt);
      newFlags.push({ id, review: row, ...h, where_found: h.where, reviewer_email: row.reviewer_email, reviewer_name: row.reviewer_name, subject: reviewSubjectLine(row), emailed: false });
    }
  }

  // Members are never emailed automatically — Eric decides from the Alerts tab.
  kvSet("review_scan_last", startedAt);
  console.log(`Review scan: ${rows.length} review(s) checked, ${newFlags.length} new flag(s).`);
  if (notify) await sendAdminScanSummary(newFlags);
  return { checked: rows.length, newFlags: newFlags.length };
}

function maybeRunDailyScan() {
  if (!SCAN_ENABLED) return;
  const hour = easternHour();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()); // YYYY-MM-DD
  // Only inside a three-hour morning window, so a deploy at night never fires it.
  if (hour < SCAN_HOUR || hour >= SCAN_HOUR + 3 || kvGet("review_scan_day") === today) return;
  kvSet("review_scan_day", today);
  runReviewScan().catch((e) => console.error("Review scan failed:", e.message));
}

function runReviewNudges() {
  try { runSrnaExpiry(); } catch (e) { console.error("SRNA expiry check failed:", e.message); }
  maybeRunDailyScan();
  if (NUDGE_MAX <= 0) return;
  const [from, to] = NUDGE_HOURS.split("-").map(Number);
  const hour = easternHour();
  if (hour < from || hour >= to) return; // only send during the day, Eastern
  Object.keys(NUDGE_PROGRAMS).forEach((key) => {
    try { runNudgeProgram(key); } catch (e) { console.error(`Nudge program ${key} failed:`, e.message); }
  });
  // One reminder email for private messages still unanswered after a few days (server/messages.js).
  messaging.runMessageReminders().catch((e) => console.error("Message reminders failed:", e.message));
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

// --- review guard admin API ---
app.get("/api/admin/flags", requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT f.*, r.reviewer_name, r.date AS review_date, r.edited_at, r.hospital_name, r.group_name, r.agency_name, r.agent_name, r.anonymous,
           a.id AS member_id, a.name AS member_name
    FROM review_flags f
    LEFT JOIN reviews r ON r.id = f.review_id
    LEFT JOIN access_requests a ON a.email = f.reviewer_email
    ORDER BY CASE f.status WHEN 'open' THEN 0 ELSE 1 END, CASE f.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, f.created_at DESC
    LIMIT 500`).all();
  // Flags whose review has since been deleted are closed here so they don't linger.
  rows.filter((f) => f.status === "open" && !f.review_date).forEach((f) => {
    db.prepare("UPDATE review_flags SET status='resolved', resolved_at=?, resolved_by='delete' WHERE id=?").run(new Date().toISOString(), f.id);
    f.status = "resolved"; f.resolved_by = "delete";
  });
  res.json({ flags: rows, lastScan: kvGet("review_scan_last"), scanHour: SCAN_HOUR });
});
app.post("/api/admin/flags/:id", requireAdmin, (req, res) => {
  const status = ["open", "resolved", "dismissed"].includes(req.body?.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: "bad_status" });
  const changed = db.prepare("UPDATE review_flags SET status=?, resolved_at=?, resolved_by=? WHERE id=?")
    .run(status, status === "open" ? null : new Date().toISOString(), status === "open" ? "" : "admin", req.params.id).changes;
  if (!changed) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});
app.post("/api/admin/flags/:id/notify", requireAdmin, async (req, res) => {
  const f = db.prepare("SELECT * FROM review_flags WHERE id = ?").get(req.params.id);
  if (!f) return res.status(404).json({ error: "not_found" });
  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(f.review_id);
  const member = db.prepare("SELECT * FROM access_requests WHERE email = ?").get(f.reviewer_email);
  if (!row || !member) return res.status(404).json({ error: "not_found" });
  const flags = db.prepare("SELECT * FROM review_flags WHERE review_id = ? AND status = 'open'").all(row.id);
  try {
    await sendGuidelineNoticeEmail(member, row, flags.length ? flags : [f]);
    const t = new Date().toISOString();
    (flags.length ? flags : [f]).forEach((x) => db.prepare("UPDATE review_flags SET notified_at = ? WHERE id = ?").run(t, x.id));
    res.json({ ok: true, sentTo: member.email });
  } catch (e) {
    res.status(502).json({ error: "send_failed", detail: e.message });
  }
});
// Admin removes a review outright (Terms §6). Its open flags close as "delete".
app.delete("/api/admin/reviews/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  db.prepare("DELETE FROM reviews WHERE id = ?").run(row.id);
  db.prepare("UPDATE review_flags SET status='resolved', resolved_at=?, resolved_by='delete' WHERE review_id = ? AND status = 'open'").run(new Date().toISOString(), row.id);
  res.json({ ok: true });
});
app.post("/api/admin/scan/run", requireAdmin, async (req, res) => {
  try {
    const out = await runReviewScan({ all: !!req.body?.all, notify: req.body?.notify !== false });
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(500).json({ error: "scan_failed", detail: e.message });
  }
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
      if (!norm) return;
      // "AYA" vs "Aya" normalize to the same key. That is still a real merge — a spelling
      // preference — so it is stored like any other alias: this key displays as `canonical`.
      // (Skipping it here is why the merge used to look like it did nothing.)
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
// and every review is anonymous — the name is hidden from everyone but its author.
function rowToReview(r, viewerEmail) {
  const isMine = !!viewerEmail && r.reviewer_email === viewerEmail;
  const anonymous = true;
  return {
    id: r.id,
    date: r.date,
    isMine,
    anonymous,
    editedAt: r.edited_at || null,
    reviewer: {
      name: isMine ? r.reviewer_name : "Anonymous CRNA",
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
    travelCovered: r.travel_covered || "",
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

// ---------- private messages ("Ask this reviewer") — see server/messages.js ----------
const messaging = registerMessages(app, {
  db, requireSession: requireCrna, requireAdmin, sendEmail, escapeHtml, emailHeaderHtml, BASE_URL, REPLY_TO, RULES, reviewSubjectLine,
});

// Admin can force the unanswered-message reminder check (normally hourly, daytime Eastern).
app.post("/api/admin/message-reminders/run", requireAdmin, async (req, res) => {
  res.json(await messaging.runMessageReminders());
});

app.get("/api/reviews", requireSession, (req, res) => {
  const rows = db.prepare("SELECT * FROM reviews ORDER BY date DESC").all();
  // acceptsQuestions only says whether to show "Ask this reviewer" — it never reveals who the reviewer is.
  const optedOut = messaging.optedOutEmails();
  res.json({ reviews: rows.map((r) => ({ ...rowToReview(r, req.user.email), acceptsQuestions: !optedOut.has(r.reviewer_email) })) });
});

// Validates a review body and returns the column values shared by create and edit,
// or { error } if something required is missing.
// Star ratings: 1–5, or -1 for "Not applicable" (never counted toward a score).
function cleanRatings(v) {
  const out = {};
  if (!v || typeof v !== "object") return out;
  Object.entries(v).slice(0, 40).forEach(([k, n]) => {
    const x = Number(n);
    if (x === -1 || (Number.isInteger(x) && x >= 1 && x <= 5)) out[String(k).slice(0, 40)] = x;
  });
  return out;
}
const TRAVEL_COVERAGE = ["Covered by agency", "All-inclusive rate"];

// A review can cover the whole assignment or only part of it (just the hospital, just the
// agency, ...). At least one part has to be there, and each part it names has to be rated.
function reviewColumns(b) {
  const employmentType = b.employmentType === "staff" ? "staff" : "locum";
  if (!b.acceptedGuidelines) return { error: "guidelines_not_acknowledged" };
  const isStaff = employmentType === "staff";
  const name = (v) => String(v || "").trim();
  const hasHospital = !!name(b.hospitalName);
  const hasGroup = isStaff && !!name(b.groupName);
  const hasAgency = !isStaff && !!name(b.agencyName);
  const hasAgent = !isStaff && !!name(b.agentName);
  if (!hasHospital && !hasGroup && !hasAgency && !hasAgent) return { error: "missing_fields" };
  const scored = (r) => Object.values(cleanRatings(r)).some((x) => x > 0);
  if (hasHospital && !scored(b.hospitalRatings)) return { error: "missing_fields" };
  if (hasGroup && !scored(b.groupRatings)) return { error: "missing_fields" };
  if (hasAgency && !scored(b.agencyAgentRatings)) return { error: "missing_fields" };
  return {
    values: {
      agency_name: hasAgency ? name(b.agencyName) : "",
      agent_name: hasAgent ? name(b.agentName) : "",
      agency_agent_ratings: JSON.stringify(hasAgency ? cleanRatings(b.agencyAgentRatings) : {}),
      agency_agent_would_return: hasAgency ? (b.agencyAgentWouldReturn || "") : "",
      agency_agent_comment: hasAgency ? (b.agencyAgentComment || "") : "",
      agency_agent_notes: JSON.stringify(hasAgency ? cleanNotes(b.agencyAgentNotes) : {}),
      pay_rate: !hasAgency || b.payRate === "" || b.payRate == null ? null : Number(b.payRate),
      pay_range: hasAgency ? String(b.payRange || "") : "",
      travel_covered: hasAgency && TRAVEL_COVERAGE.includes(b.travelCovered) ? b.travelCovered : "",
      agent_ratings: JSON.stringify(hasAgent ? cleanRatings(b.agentRatings) : {}),
      agent_would_return: hasAgent ? (b.agentWouldReturn || "") : "",
      agent_comment: hasAgent ? (b.agentComment || "") : "",
      agent_notes: JSON.stringify(hasAgent ? cleanNotes(b.agentNotes) : {}),
      hospital_name: hasHospital ? name(b.hospitalName) : "",
      hospital_city: hasHospital ? String(b.hospitalCity || "").trim() : "",
      hospital_state: hasHospital ? String(b.hospitalState || "").trim().toUpperCase().slice(0, 2) : "",
      hospital_ratings: JSON.stringify(hasHospital ? cleanRatings(b.hospitalRatings) : {}),
      hospital_would_return: hasHospital ? (b.hospitalWouldReturn || "") : "",
      hospital_comment: hasHospital ? (b.hospitalComment || "") : "",
      hospital_notes: JSON.stringify(hasHospital ? cleanNotes(b.hospitalNotes) : {}),
      employment_type: employmentType,
      staff_pay_type: hasGroup ? String(b.staffPayType || "") : "",
      staff_pay_range: hasGroup ? String(b.staffPayRange || "") : "",
      family_insurance: hasGroup ? String(b.familyInsurance || "") : "",
      pto_weeks: hasGroup ? String(b.ptoWeeks || "") : "",
      prn_rate: hasGroup ? String(b.prnRate || "") : "",
      group_name: hasGroup ? name(b.groupName) : "",
      group_ratings: JSON.stringify(hasGroup ? cleanRatings(b.groupRatings) : {}),
      group_would_return: hasGroup ? (b.groupWouldReturn || "") : "",
      group_comment: hasGroup ? (b.groupComment || "") : "",
      group_notes: JSON.stringify(hasGroup ? cleanNotes(b.groupNotes) : {}),
      anonymous: 1, // always anonymous
      guidelines_version: String(b.guidelinesVersion || "").slice(0, 20),
      guidelines_accepted_at: new Date().toISOString(),
    },
  };
}

app.post("/api/reviews", requireCrna, (req, res) => {
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
app.put("/api/reviews/:id", requireCrna, (req, res) => {
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

// A full member can report a review they believe came from a recruiter, employer, or someone
// with a stake in the rating (or that otherwise breaks the guidelines). It lands in Admin →
// Alerts like a scanner hit; nothing happens to the review until Eric decides.
app.post("/api/reviews/:id/report", requireCrna, (req, res) => {
  const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id);
  if (!review) return res.status(404).json({ error: "not_found" });
  if (review.reviewer_email === req.user.email) return res.status(400).json({ error: "own_review" });
  const reason = String(req.body?.reason || "").trim().replace(/\s+/g, " ").slice(0, 600);
  if (reason.length < 10) return res.status(400).json({ error: "reason_required" });
  const dup = db.prepare("SELECT id FROM review_flags WHERE review_id = ? AND rule = 'member_report' AND reporter_email = ? AND status = 'open'").get(review.id, req.user.email);
  if (dup) return res.json({ ok: true, already: true });
  db.prepare("INSERT INTO review_flags (id, review_id, reviewer_email, rule, severity, label, where_found, excerpt, issue, suggestion, status, created_at, reporter_email) VALUES (?,?,?,?,?,?,?,?,?,?,'open',?,?)").run(
    crypto.randomUUID(), review.id, review.reviewer_email, "member_report", "medium", "Reported by a member",
    "review", reason,
    "A member believes this review was written by a recruiter, employer, group owner, or someone else with a stake in the rating — or that it otherwise breaks the guidelines. Their words are quoted above.",
    "Open the member to see what they declared on sign-up and what else they've posted. Then ignore, email them, delete the review, or make the account read-only from their member row.",
    new Date().toISOString(), req.user.email
  );
  res.json({ ok: true });
  // One short note to Eric — a report is something only he can act on.
  if (process.env.ADMIN_EMAIL) {
    sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `CRNA Critics — a member reported a review of ${escapeHtml(reviewSubjectLine(review))}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">${emailHeaderHtml(BASE_URL, 480)}
        <h2 style="color:#123C3A;">A review was reported</h2>
        <p>A member reported a review of <strong>${escapeHtml(reviewSubjectLine(review))}</strong>:</p>
        <blockquote style="border-left:4px solid #B87F1E;background:#FFF4E5;margin:0;padding:10px 12px;">${escapeHtml(reason)}</blockquote>
        <p>It's waiting under <a href="${BASE_URL}">Site admin &rarr; Alerts</a>. Nothing happens to the review until you decide.</p></div>`,
    }).catch((e) => console.error("Report notice failed:", e.message));
  }
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

// Site icons — the shield beside the domain in Google/Bing/Yahoo results and in browser tabs.
// Served explicitly so /favicon.ico never falls through to the SPA catch-all (HTML).
for (const [route, icon] of Object.entries(SITE_ICONS)) {
  const bytes = Buffer.from(icon.b64, "base64");
  app.get(route, (req, res) => {
    res.set("Content-Type", icon.type);
    res.set("Cache-Control", "public, max-age=604800");
    res.send(bytes);
  });
}
app.get("/site.webmanifest", (req, res) => {
  res.set("Content-Type", "application/manifest+json");
  res.send(JSON.stringify({
    name: "CRNA Critics",
    short_name: "CRNA Critics",
    icons: [
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/favicon-96.png", sizes: "96x96", type: "image/png" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    theme_color: "#0B1526",
    background_color: "#FFFFFF",
    display: "standalone",
  }));
});
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send("User-agent: *\nAllow: /\nSitemap: https://crnacritics.com/sitemap.xml\n");
});
app.get("/sitemap.xml", (req, res) => {
  res.type("application/xml").send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    '<url><loc>https://crnacritics.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>' +
    '</urlset>\n'
  );
});

app.get("/feedback", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "feedback.html"));
});

// Code and styles: browsers must re-check on every load (ETag makes that a cheap 304), so a
// deploy shows up on the next visit instead of whenever Safari feels like it. Images keep a week.
app.use(express.static(path.join(__dirname, "..", "public"), {
  setHeaders(res, filePath) {
    if (/\.(js|css|html)$/.test(filePath)) res.set("Cache-Control", "no-cache");
  },
}));
app.get("*", (req, res) => {
  res.set("Cache-Control", "no-cache");
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
