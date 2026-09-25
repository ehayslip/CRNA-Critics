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

You can post under your name or anonymously. Either way, it counts.

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

module.exports = db;
