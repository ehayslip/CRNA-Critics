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

module.exports = db;
