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

module.exports = db;
