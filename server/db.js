'use strict';
const fs = require('fs'), path = require('path');
let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); }
catch (e) { console.error('ExamPro needs Node.js 22.13 or newer (built-in node:sqlite). Current: ' + process.version); process.exit(1); }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, pass_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), last_login_at TEXT);
CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY, student_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, phone TEXT, photo_url TEXT, active INTEGER NOT NULL DEFAULT 1, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), last_login_at TEXT);
CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS batches (id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, name TEXT NOT NULL, start_date TEXT, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS enrollments (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','dropped')), enrolled_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), UNIQUE(student_id, course_id));
CREATE TABLE IF NOT EXISTS exams (id INTEGER PRIMARY KEY, title TEXT NOT NULL, test_id INTEGER, course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL, instructions TEXT, duration_min INTEGER NOT NULL DEFAULT 30, start_at TEXT, end_at TEXT, max_attempts INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, exam_id INTEGER REFERENCES exams(id) ON DELETE SET NULL, title TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, pct INTEGER NOT NULL, duration_sec INTEGER, taken_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), updated_at TEXT);
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, audience TEXT NOT NULL CHECK (audience IN ('all','selected')), created_by TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS notification_recipients (notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, read_at TEXT, PRIMARY KEY (notification_id, student_id));
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, topic TEXT, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), read_at TEXT);
CREATE TABLE IF NOT EXISTS sessions (id_hash TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('student','admin')), user_id INTEGER NOT NULL, csrf TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS visitors (vid_hash TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS visits (vid_hash TEXT NOT NULL, day TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (vid_hash, day));
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY, admin_id INTEGER, admin_email TEXT, action TEXT NOT NULL, target TEXT, detail TEXT, ip TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_role ON sessions(role, last_seen);
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_enroll_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);
`;

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 4000;');
  raw.exec(SCHEMA);
  /* thin helpers; every query is parameterised */
  return {
    raw,
    all: (sql, ...p) => raw.prepare(sql).all(...p),
    get: (sql, ...p) => raw.prepare(sql).get(...p),
    run: (sql, ...p) => raw.prepare(sql).run(...p),
    tx(fn) { raw.exec('BEGIN'); try { const r = fn(); raw.exec('COMMIT'); return r; } catch (e) { raw.exec('ROLLBACK'); throw e; } },
    close: () => raw.close()
  };
}
module.exports = { open };
