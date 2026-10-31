const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// On Railway, DATA_DIR points at the persistent volume (/data) so the
// database survives redeploys. Locally it falls back to the project root.
const dataDir = process.env.DATA_DIR || path.join(__dirname, "..");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "data.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS access_requests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nbcrna_number TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TEXT NOT NULL,
    decided_at TEXT
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    reviewer_name TEXT NOT NULL,
    reviewer_credentials TEXT NOT NULL DEFAULT 'CRNA',
    reviewer_email TEXT NOT NULL,
    agency_name TEXT NOT NULL,
    agent_name TEXT NOT NULL DEFAULT '',
    agency_agent_ratings TEXT NOT NULL,
    agency_agent_would_return TEXT NOT NULL DEFAULT '',
    agency_agent_comment TEXT NOT NULL DEFAULT '',
    pay_rate REAL,
    hospital_name TEXT NOT NULL,
    hospital_ratings TEXT NOT NULL,
    hospital_would_return TEXT NOT NULL DEFAULT '',
    hospital_comment TEXT NOT NULL DEFAULT ''
  );
`);

// Lightweight migrations for columns added after the initial schema.
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumnIfMissing("access_requests", "password_hash", "TEXT");
addColumnIfMissing("access_requests", "employment_type", "TEXT"); // 'locum' | 'staff'
addColumnIfMissing("access_requests", "nbcrna_check", "TEXT"); // JSON result of the automatic NBCRNA lookup
addColumnIfMissing("access_requests", "nbcrna_checked_at", "TEXT");
addColumnIfMissing("access_requests", "reject_reason", "TEXT"); // label of the reason Eric picked
addColumnIfMissing("access_requests", "reject_note", "TEXT");   // his optional note, sent to the applicant
addColumnIfMissing("access_requests", "reject_emailed_at", "TEXT"); // when the rejection email went out (null = not sent)
// Staff (W-2) reviews rate an anesthesia group instead of an agency/agent.
addColumnIfMissing("reviews", "employment_type", "TEXT NOT NULL DEFAULT 'locum'");
addColumnIfMissing("reviews", "group_name", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("reviews", "group_ratings", "TEXT NOT NULL DEFAULT '{}'");
addColumnIfMissing("reviews", "group_would_return", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("reviews", "group_comment", "TEXT NOT NULL DEFAULT ''");
// Anonymous reviews hide the reviewer's name from other members (still tied to the account).
addColumnIfMissing("reviews", "anonymous", "INTEGER NOT NULL DEFAULT 0");
// Every CRNA is anonymous now (Sep 2026) — there is no longer a choice. Older reviews
// posted under a name are switched over too.
db.exec("UPDATE reviews SET anonymous = 1 WHERE anonymous = 0");
addColumnIfMissing("reviews", "edited_at", "TEXT");
// Agents are rated on their own short scorecard, separate from the agency.
addColumnIfMissing("reviews", "agent_ratings", "TEXT NOT NULL DEFAULT '{}'");
addColumnIfMissing("reviews", "agent_would_return", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("reviews", "agent_comment", "TEXT NOT NULL DEFAULT ''");
// Terms of Use & Member Agreement acceptance, recorded at sign-up (click-wrap evidence).
addColumnIfMissing("access_requests", "terms_version", "TEXT");
addColumnIfMissing("access_requests", "terms_accepted_at", "TEXT");
addColumnIfMissing("access_requests", "terms_ip", "TEXT");
addColumnIfMissing("access_requests", "terms_user_agent", "TEXT");
addColumnIfMissing("access_requests", "sms_consent", "INTEGER NOT NULL DEFAULT 0");
// When the texting box was ticked, and the exact wording shown next to it (consent evidence for bulk texts).
addColumnIfMissing("access_requests", "sms_consent_at", "TEXT");
addColumnIfMissing("access_requests", "sms_consent_text", "TEXT");
// SRNA (student) accounts: read-only members verified by school email + manual approval.
addColumnIfMissing("access_requests", "role", "TEXT NOT NULL DEFAULT 'crna'"); // 'crna' | 'crna_readonly' | 'srna'
addColumnIfMissing("access_requests", "declared_role", "TEXT"); // what they said they are on the form: practicing | chief | recruiter | owner
addColumnIfMissing("access_requests", "attested_at", "TEXT");   // when they made that declaration (recorded with the Terms acceptance)
addColumnIfMissing("access_requests", "declare_asked_at", "TEXT");       // when the "which best describes you?" question was emailed to a pre-existing member
addColumnIfMissing("access_requests", "declare_deadline_at", "TEXT");    // when the unanswered question moved them to read-only (null = not applied)
addColumnIfMissing("access_requests", "role_set_by_admin_at", "TEXT");   // Eric changed their tier by hand; a self-declaration then records but never flips the tier
addColumnIfMissing("access_requests", "srna_school", "TEXT");
addColumnIfMissing("access_requests", "srna_program", "TEXT");
addColumnIfMissing("access_requests", "srna_grad_year", "TEXT");
addColumnIfMissing("access_requests", "srna_grad_month", "INTEGER");      // 1-12; access runs through the end of this month
addColumnIfMissing("access_requests", "srna_expires_at", "TEXT");         // ISO instant access ends (start of the next month)
addColumnIfMissing("access_requests", "srna_expired_emailed_at", "TEXT"); // when the "your access expired" email went out
addColumnIfMissing("access_requests", "instructor_name", "TEXT");        // program contact who vouches for the student
addColumnIfMissing("access_requests", "instructor_email", "TEXT");
addColumnIfMissing("access_requests", "instructor_asked_at", "TEXT");    // when the verification email went out
addColumnIfMissing("access_requests", "instructor_decision", "TEXT");    // 'verified' | 'cant_verify' | null
addColumnIfMissing("access_requests", "instructor_decided_at", "TEXT");
// Pay is recorded as a bracket (e.g. "$201–220"), not a number or a score.
addColumnIfMissing("reviews", "pay_range", "TEXT NOT NULL DEFAULT ''");
// Where the hospital actually is — two CRNAs comparing offers need the city, not just the name.
addColumnIfMissing("reviews", "hospital_city", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("reviews", "hospital_state", "TEXT NOT NULL DEFAULT ''");
// Staff (full-time / part-time) reviews: how they're paid, the annual bracket, and what
// family health coverage costs per month. Informational — never scored.
addColumnIfMissing("reviews", "staff_pay_type", "TEXT NOT NULL DEFAULT ''");   // 'W-2' | '1099'
addColumnIfMissing("reviews", "staff_pay_range", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("reviews", "family_insurance", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("reviews", "pto_weeks", "TEXT NOT NULL DEFAULT ''");
// What the group pays for PRN / extra shifts, as an hourly bracket. Informational — never scored.
addColumnIfMissing("reviews", "prn_rate", "TEXT NOT NULL DEFAULT ''");
// Per-category comments: { categoryKey: "what they wrote" } for each scorecard, so a 1-star
// on one category can carry its own explanation alongside the overall comment.
addColumnIfMissing("reviews", "hospital_notes", "TEXT NOT NULL DEFAULT '{}'");
addColumnIfMissing("reviews", "group_notes", "TEXT NOT NULL DEFAULT '{}'");
addColumnIfMissing("reviews", "agency_agent_notes", "TEXT NOT NULL DEFAULT '{}'");
addColumnIfMissing("reviews", "agent_notes", "TEXT NOT NULL DEFAULT '{}'");
addColumnIfMissing("reviews", "guidelines_version", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("reviews", "guidelines_accepted_at", "TEXT NOT NULL DEFAULT ''");
// Locum: did the agency cover travel & housing, or was it an all-inclusive rate? Informational, never scored.
addColumnIfMissing("reviews", "travel_covered", "TEXT NOT NULL DEFAULT ''");
// Bulk (broadcast) email opt-out. Account mail — approvals, sign-in links, password
// resets — ignores this flag completely; only campaigns honor it.
addColumnIfMissing("access_requests", "bulk_unsubscribed", "INTEGER NOT NULL DEFAULT 0");
// Automatic "Ask for a review" nudges to approved members who haven't posted yet.
addColumnIfMissing("access_requests", "nudge_count", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("access_requests", "last_nudged_at", "TEXT");
// First time the member actually signed in (emailed link or password). The review-video emails
// start counting from here, not from approval. thanks_sent_at: read-only members' one-time thank-you.
addColumnIfMissing("access_requests", "first_login_at", "TEXT");
addColumnIfMissing("access_requests", "thanks_sent_at", "TEXT");
// "Finish setting up your account" reminders for members who were approved but never created a password.
addColumnIfMissing("access_requests", "setup_nudge_count", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("access_requests", "last_setup_nudge_at", "TEXT");
// Automatic site-feedback nudges after a member's first review, until they submit the form.
addColumnIfMissing("access_requests", "feedback_nudge_count", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("access_requests", "last_feedback_nudged_at", "TEXT");
addColumnIfMissing("access_requests", "unsubscribed_at", "TEXT");
// Beta feedback form: when the admin last sent a member the link (resend overwrites this).
addColumnIfMissing("access_requests", "feedback_sent_at", "TEXT");

// Admin-approved name merges. `alias_norm` is the normalized spelling a member typed;
// `canonical` is the one name it should be filed under. Kept in the database, not in code,
// so merging a newly-noticed duplicate never needs a deploy.
db.exec(`
  CREATE TABLE IF NOT EXISTS name_aliases (
    id TEXT PRIMARY KEY,
    alias_norm TEXT NOT NULL UNIQUE,
    alias_raw TEXT NOT NULL DEFAULT '',
    canonical TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Pairs the admin has explicitly said are NOT the same, so the duplicate
  -- detector stops suggesting them. Stored with the two normalized names sorted.
  CREATE TABLE IF NOT EXISTS name_pair_ignores (
    pair_key TEXT PRIMARY KEY,
    a_name TEXT NOT NULL,
    b_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// ---------- email CMS ----------
//
// Templates the admin writes once and reuses: a subject, a plain-text body with
// {{tokens}}, and a category so the list stays organized. Seeded with a starter set
// the first time the table is empty; after that they're the admin's to edit or delete.
db.exec(`
  CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- One row per "send" from the admin, so there's a permanent record of what went out.
  CREATE TABLE IF NOT EXISTS email_campaigns (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    template_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'sending',   -- sending | done
    total INTEGER NOT NULL DEFAULT 0,
    sent INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    finished_at TEXT
  );

  -- Per-recipient outcome for a campaign: delivered to Resend, skipped (unsubscribed),
  -- or failed with the reason.
  CREATE TABLE IF NOT EXISTS email_campaign_recipients (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',    -- queued | sent | skipped | failed
    error TEXT NOT NULL DEFAULT '',
    sent_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_campaign_recipients ON email_campaign_recipients (campaign_id);
`);

const STARTER_TEMPLATES = [
  {
    name: "Ask for a review",
    category: "Feedback",
    subject: "{{first_name}}, who did you work with last?",
    body: `Hi {{first_name}},

You're verified on CRNA Critics, and the site only works because CRNAs like you write down what actually happened.

Think about your last assignment — the hospital, the group, the agency, the recruiter who answered the phone (or didn't). Five minutes of your time saves another CRNA a bad contract.

{{cta}}

Every review is anonymous. Other CRNAs see you only as "Anonymous CRNA" — no one will know it was you.

— Eric, CRNA Critics`,
  },
  {
    name: "Reminder — past sites you haven't reviewed",
    category: "Reminder",
    subject: "You've posted {{review_count}} — what about the rest?",
    body: `Hi {{first_name}},

Quick nudge. You've posted {{review_count}} on CRNA Critics so far.

Most of us have worked a dozen places. Every hospital, group, agency and agent you've dealt with — past or present — is worth a scorecard. Old assignments matter just as much: the agency that lowballed you three years ago is still out there doing it.

{{cta}}

Takes about five minutes per site.

— Eric, CRNA Critics`,
  },
  {
    name: "Tell a colleague",
    category: "Growth",
    subject: "Know a CRNA who got burned? Send them here.",
    body: `Hi {{first_name}},

CRNA Critics is only as strong as the number of CRNAs on it. The more of us posting, the harder it gets for an agency or a recruiter to tell the next person a story.

Forward this to the CRNAs you trust — the ones in your group, your old travel buddies, the classmates you still text. Ask them to get verified and post one review.

{{cta}}

No agents, agencies, MDAs or AAs are allowed on the site. It stays ours.

— Eric, CRNA Critics`,
  },
  {
    name: "Welcome / getting started",
    category: "Onboarding",
    subject: "Welcome to CRNA Critics, {{first_name}}",
    body: `Hi {{first_name}},

You're in. Here's how to get the most out of it:

1. Search before you sign. Look up the hospital, the anesthesia group, the agency and the agent by name.
2. Post what you know. Rate every place you've worked — a scorecard per category, plus a comment on any category that needs explaining.
3. Watch for the red stamp. Anything scoring 2.0 or lower carries a CRNA BEWARE mark.

{{cta}}

— Eric, CRNA Critics`,
  },
];

function seedTemplates() {
  const n = db.prepare("SELECT COUNT(*) AS n FROM email_templates").get().n;
  if (n > 0) return;
  const now = new Date().toISOString();
  const insert = db.prepare(
    "INSERT INTO email_templates (id, name, category, subject, body, created_at, updated_at) VALUES (?,?,?,?,?,?,?)"
  );
  STARTER_TEMPLATES.forEach((t) => {
    insert.run(require("crypto").randomUUID(), t.name, t.category, t.subject, t.body, now, now);
  });
}
seedTemplates();

// Saved templates that still offer "post under your name or anonymously" get the new wording.
db.prepare("UPDATE email_templates SET body = REPLACE(body, ?, ?) WHERE body LIKE ?").run(
  'You can post under your name or anonymously. Either way, it counts.', 'Every review is anonymous. Other CRNAs see you only as "Anonymous CRNA" — no one will know it was you.', "%under your name or anonymously%"
);

// ---------- beta feedback ----------
//
// One row per submission of the beta tester checklist. Kept separate from
// access_requests (rather than columns on it) so a member can submit more than
// once as the site changes; only the newest is shown in admin by default.
db.exec(`
  CREATE TABLE IF NOT EXISTS beta_feedback (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    name TEXT NOT NULL,
    answers TEXT NOT NULL,
    final_comment TEXT NOT NULL DEFAULT '',
    submitted_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_beta_feedback_request ON beta_feedback (request_id);

  -- Review guard: one row per (review, rule) the daily scan flagged.
  CREATE TABLE IF NOT EXISTS review_flags (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    reviewer_email TEXT NOT NULL,
    rule TEXT NOT NULL,
    severity TEXT NOT NULL,            -- high | medium | low
    label TEXT NOT NULL,
    where_found TEXT NOT NULL DEFAULT '',
    excerpt TEXT NOT NULL DEFAULT '',
    issue TEXT NOT NULL DEFAULT '',
    suggestion TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open', -- open | resolved | dismissed
    created_at TEXT NOT NULL,
    notified_at TEXT,
    resolved_at TEXT,
    resolved_by TEXT NOT NULL DEFAULT '' -- admin | edit | delete
  );
  CREATE INDEX IF NOT EXISTS idx_review_flags_review ON review_flags (review_id);
  CREATE INDEX IF NOT EXISTS idx_review_flags_status ON review_flags (status);


  -- Small key/value store for job bookkeeping (last scan time, etc).
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ---------- private messages ("Ask this reviewer") ----------
//
// A conversation always starts from one review: a member asks its author a question.
// Both sides see each other only as "Anonymous CRNA"; emails never leave the server.
// The admin sees a conversation only when it is reported or the guard flags a message.
addColumnIfMissing("access_requests", "accept_questions", "INTEGER NOT NULL DEFAULT 1"); // 0 = hide "Ask this reviewer" on my reviews
addColumnIfMissing("access_requests", "message_emails", "INTEGER NOT NULL DEFAULT 1");   // 0 = no "you have a new message" email
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',          -- snapshot of what the review covered, kept if the review is deleted
    asker_email TEXT NOT NULL,
    reviewer_email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_message_at TEXT NOT NULL,
    asker_read_at TEXT,
    reviewer_read_at TEXT,
    blocked_by TEXT NOT NULL DEFAULT '',       -- 'asker' | 'reviewer' | '' — either side can end it
    closed_by_admin INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_conv_asker ON conversations (asker_email);
  CREATE INDEX IF NOT EXISTS idx_conv_reviewer ON conversations (reviewer_email);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_pair ON conversations (review_id, asker_email);

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    removed_by_admin INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, created_at);

  -- Why the admin can see a conversation: a member reported it, or the guard flagged a
  -- message the sender chose to send anyway.
  CREATE TABLE IF NOT EXISTS message_flags (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    message_id TEXT,
    source TEXT NOT NULL,                      -- report | guard
    reporter_email TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    excerpt TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',       -- open | dismissed | resolved
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_message_flags_status ON message_flags (status);
`);
// One reminder email per unanswered message: when each side was last reminded.
addColumnIfMissing("conversations", "asker_reminded_at", "TEXT");
addColumnIfMissing("conversations", "reviewer_reminded_at", "TEXT");

addColumnIfMissing("review_flags", "reporter_email", "TEXT"); // set when a member reported the review (rule = member_report)

// ---------- members changing their own email ----------
//
// Old addresses are remembered so links already sitting in someone's inbox (the unsubscribe
// link carries the address) still land on the right account after the address changes.
db.exec(`
  CREATE TABLE IF NOT EXISTS email_changes (
    old_email TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    changed_at TEXT NOT NULL
  );
`);

// ---------- personal texts (Admin → Texts) ----------
//
// The site doesn't send texts. Eric texts members from his own phone; the admin gives him
// ready-made wording to copy (or open straight in Messages) and keeps a log of what he sent
// to whom and when, so the same text doesn't go out twice.
db.exec(`
  CREATE TABLE IF NOT EXISTS text_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS text_log (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,       -- access_requests.id of the member texted
    template_id TEXT,               -- null for a free-typed text
    template_name TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,             -- exactly what was copied / opened in Messages
    sent_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_text_log_request ON text_log (request_id);
`);

// Wording Eric approved Oct 15, 2026; he edits or adds more himself in Admin → Texts.
const STARTER_TEXTS = [
  {
    name: "Casual — please review",
    body: "Hey {{first_name}}, this is Eric Hayslip, CRNA. Thanks for signing up for crnacritics.com! The site really needs reviews to work. A lot of CRNAs have signed up, and if every one of us left a review of our current site, good or bad, it would be a huge help with future assignment decisions. It only takes 3–5 minutes to leave a review. Imagine having thousands of useful reviews to help you make an informed decision about your next assignment. Reviews are anonymous. crnacritics.com",
  },
  {
    name: "Short follow-up",
    body: "Hi {{first_name}}, Eric Hayslip again from CRNA Critics. Do you have 5 minutes to rate your current assignment, good or bad? It's anonymous and helps the next CRNA headed there. crnacritics.com",
  },
  {
    name: "Thank you for reviewing",
    body: "{{first_name}}, thank you for leaving a review on CRNA Critics! That's exactly what makes the site work. If you know other CRNAs, please send them to crnacritics.com. – Eric",
  },
  {
    name: "Share with colleagues",
    body: "Hey {{first_name}}, Eric from CRNA Critics. If you work with other CRNAs who take locum or staff jobs, would you send them crnacritics.com? The more reviews we get, the better it gets for all of us.",
  },
];
// Seed once (tracked in kv) so deleting every template doesn't bring the starters back.
if (!db.prepare("SELECT 1 FROM kv WHERE key = 'first_login_backfill_2026_10_31'").get()) {
  const now = new Date().toISOString();
  // Anyone with a password has signed in before; use their approval date as a stand-in so the
  // switch doesn't make them wait again (they were already on the old approval-based schedule).
  db.prepare("UPDATE access_requests SET first_login_at = COALESCE(decided_at, requested_at) WHERE password_hash IS NOT NULL AND first_login_at IS NULL AND status = 'approved'").run();
  // Read-only members who joined before today don't get a retroactive thank-you.
  db.prepare("UPDATE access_requests SET thanks_sent_at = ? WHERE role = 'crna_readonly' AND thanks_sent_at IS NULL").run(now);
  db.prepare("INSERT INTO kv (key, value) VALUES ('first_login_backfill_2026_10_31', ?)").run(now);
}

if (!db.prepare("SELECT 1 FROM kv WHERE key = 'text_templates_seeded'").get()) {
  const now = new Date().toISOString();
  const ins = db.prepare("INSERT INTO text_templates (id, name, body, sort, created_at, updated_at) VALUES (?,?,?,?,?,?)");
  STARTER_TEXTS.forEach((t, i) => ins.run(require("crypto").randomUUID(), t.name, t.body, i, now, now));
  db.prepare("INSERT INTO kv (key, value) VALUES ('text_templates_seeded', ?)").run(now);
}

// ---------- bad phone numbers ----------
// Eric flags a member whose number is wrong (a text failed to send, or someone else answered).
addColumnIfMissing("access_requests", "phone_bad_at", "TEXT");   // null = number looks fine
addColumnIfMissing("access_requests", "phone_bad_note", "TEXT"); // why, e.g. "Text failed to send Oct 17"

// One-time: the 20 numbers whose texts showed "Message Send Failure" in Eric's Messages on
// Oct 17, 2026, plus any number on file that can't be a US number (not 10 digits).
if (!db.prepare("SELECT 1 FROM kv WHERE key = 'phone_flags_2026_10_17'").get()) {
  const failed = ["9014512700","7163903884","2489179521","3186783797","8644415033","8159856602","5047827648",
    "4782786134","9015814823","2672351036","2318553552","7865167191","5044515562","2158880270","4438542771",
    "7174753106","2532088703","8634122599","5049134592","5126261229"];
  const now = new Date().toISOString();
  const digits = (p) => String(p || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const setBad = db.prepare("UPDATE access_requests SET phone_bad_at = ?, phone_bad_note = ? WHERE id = ? AND phone_bad_at IS NULL");
  for (const r of db.prepare("SELECT id, phone FROM access_requests").all()) {
    const d = digits(r.phone);
    if (failed.includes(d)) setBad.run(now, "Text failed to send (Message Send Failure) on Oct 17, 2026", r.id);
    else if (d && d.length !== 10) setBad.run(now, `Not a valid 10-digit number (${d.length} digits)`, r.id);
  }
  db.prepare("INSERT INTO kv (key, value) VALUES ('phone_flags_2026_10_17', ?)").run(now);
}

// Traffic (Oct 30, 2026): one row per anonymous browser per Eastern day, with where it came from
// (facebook, a utm_source, or a referring site). No IP, no name: visitor_id is a random string the
// browser makes for itself. Sign-ups carry the source the browser first arrived with.
db.exec(`
  CREATE TABLE IF NOT EXISTS traffic_visits (
    visitor_id TEXT NOT NULL,
    day TEXT NOT NULL,
    source TEXT NOT NULL,
    campaign TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    PRIMARY KEY (visitor_id, day)
  );
  CREATE INDEX IF NOT EXISTS idx_traffic_day ON traffic_visits (day);
`);
addColumnIfMissing("access_requests", "signup_source", "TEXT");   // e.g. 'facebook', 'direct', 'google.com'
addColumnIfMissing("access_requests", "signup_campaign", "TEXT"); // utm_campaign when there was one

module.exports = db;
