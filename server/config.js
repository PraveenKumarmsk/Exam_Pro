'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');

/* tiny .env loader (no dependency) */
try {
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !l.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env */ }

const env = process.env;
const production = env.NODE_ENV === 'production';

function secret() {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 24) return env.SESSION_SECRET;
  if (production) { console.error('FATAL: set SESSION_SECRET (24+ chars) in production.'); process.exit(1); }
  const f = path.join(ROOT, 'data', '.secret');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch (e) {}
  const s = crypto.randomBytes(32).toString('hex');
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s, { mode: 0o600 }); } catch (e) {}
  return s;
}

module.exports = {
  ROOT, production,
  port: +env.PORT || 3000,
  dbPath: path.resolve(ROOT, env.DB_PATH || 'data/exampro.db'),
  secret: secret(),
  activeTimeoutMin: +env.ACTIVE_TIMEOUT_MIN || 5,
  sessionIdleMin: +env.SESSION_IDLE_MIN || 60,
  sessionMaxHours: +env.SESSION_MAX_HOURS || 12,
  cookieSecure: env.COOKIE_SECURE === '1' || production
};
