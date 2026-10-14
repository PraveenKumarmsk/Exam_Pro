'use strict';
/* Core: HTTP helpers, password hashing, sessions, CSRF/origin checks, rate limiting, static files. No dependencies. */
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const cfg = require('./config');

class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }
const bad = (msg, extra) => new HttpError(400, msg, extra);

/* ---------- passwords (scrypt) ---------- */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${salt.toString('hex')}$${h.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [alg, N, salt, hash] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const h = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), SCRYPT.keylen, { N: +N, r: SCRYPT.r, p: SCRYPT.p });
    const b = Buffer.from(hash, 'hex');
    return b.length === h.length && crypto.timingSafeEqual(b, h);
  } catch (e) { return false; }
}
const DUMMY_HASH = hashPassword('dummy-password-for-timing');
function checkPasswordPolicy(pw) {
  if (typeof pw !== 'string' || pw.length < 8) throw bad('Password must be at least 8 characters.');
  if (pw.length > 200) throw bad('Password is too long.');
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw bad('Password needs at least one letter and one number.');
}

/* ---------- misc helpers ---------- */
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const hmac = s => crypto.createHmac('sha256', cfg.secret).update(String(s)).digest('hex');
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const dayStr = (d = new Date()) => d.toISOString().slice(0, 10);

function parseCookies(req) {
  const out = {}; String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function cookieStr(name, value, { maxAge, httpOnly = true, sameSite = 'Strict' } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=${sameSite}${httpOnly ? '; HttpOnly' : ''}${cfg.cookieSecure ? '; Secure' : ''}${maxAge !== undefined ? '; Max-Age=' + maxAge : ''}`;
}
function addCookie(res, c) { const prev = res.getHeader('Set-Cookie'); res.setHeader('Set-Cookie', prev ? [].concat(prev, c) : [c]); }

function send(res, status, data, headers = {}) {
  if (res.headersSent) return;
  const body = typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  res.writeHead(status, Object.assign({ 'Content-Type': typeof data === 'string' || Buffer.isBuffer(data) ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers));
  res.end(body);
}

function readBody(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Request body too large.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      const ct = String(req.headers['content-type'] || '');
      if (!ct.includes('application/json')) return reject(new HttpError(415, 'Send JSON (Content-Type: application/json).'));
      try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(v && typeof v === 'object' ? v : {}); } catch (e) { reject(bad('Invalid JSON.')); }
    });
    req.on('error', reject);
  });
}

/* ---------- validation ---------- */
function str(v, name, { min = 1, max = 200, optional = false } = {}) {
  if (v === undefined || v === null || v === '') { if (optional) return null; throw bad(`${name} is required.`); }
  if (typeof v !== 'string') throw bad(`${name} must be text.`);
  const s = v.trim(); if (s.length < min) throw bad(`${name} is required.`); if (s.length > max) throw bad(`${name} is too long (max ${max}).`);
  return s;
}
function email(v, name = 'Email') { const s = str(v, name, { max: 160 }).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad(`${name} is not valid.`); return s; }
function int(v, name, { min = 0, max = 1e9, optional = false } = {}) {
  if (v === undefined || v === null || v === '') { if (optional) return null; throw bad(`${name} is required.`); }
  const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) throw bad(`${name} must be a whole number between ${min} and ${max}.`); return n;
}
function isoDate(v, name, optional = true) {
  if (v === undefined || v === null || v === '') { if (optional) return null; throw bad(`${name} is required.`); }
  const t = Date.parse(v); if (isNaN(t)) throw bad(`${name} is not a valid date.`); return new Date(t).toISOString().replace(/\.\d+Z$/, 'Z');
}
function photoUrl(v) {
  if (!v) return null; const s = String(v).trim().slice(0, 300);
  if (/^(images\/[\w./-]+|https:\/\/[^\s"'<>]+)$/.test(s) && !s.includes('..')) return s;
  throw bad('Photo must be an images/… path or an https:// link.');
}

/* ---------- rate limiting (in memory; per process) ---------- */
const buckets = new Map();
function rateLimit(key, max, windowMs, msg) {
  const now = Date.now(); let b = buckets.get(key);
  if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.n++;
  if (b.n > max) throw new HttpError(429, msg || 'Too many requests. Please wait a few minutes and try again.', { retryAfter: Math.ceil((b.reset - now) / 1000) });
}
/* failure-only counters for logins: check first, record only when the attempt fails */
function rateGuard(key, max, msg) { const b = buckets.get(key); if (b && b.reset >= Date.now() && b.n >= max) throw new HttpError(429, msg || 'Too many attempts. Try again in a few minutes.', { retryAfter: Math.ceil((b.reset - Date.now()) / 1000) }); }
function rateFail(key, windowMs) { const now = Date.now(); let b = buckets.get(key); if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); } b.n++; }
function rateReset(key) { buckets.delete(key); }
setInterval(() => { const n = Date.now(); for (const [k, b] of buckets) if (b.reset < n) buckets.delete(k); }, 60000).unref();

/* ---------- sessions ---------- */
const COOKIE = { student: 'ep_s', admin: 'ep_a' };
function createSession(db, res, role, userId) {
  const token = crypto.randomBytes(32).toString('base64url'), csrf = crypto.randomBytes(24).toString('base64url'), now = Date.now();
  db.run('INSERT INTO sessions (id_hash, role, user_id, csrf, created_at, last_seen, expires_at) VALUES (?,?,?,?,?,?,?)', sha(token), role, userId, csrf, now, now, now + cfg.sessionMaxHours * 3600e3);
  addCookie(res, cookieStr(COOKIE[role], token, { maxAge: cfg.sessionMaxHours * 3600 }));
  return csrf;
}
function loadSession(db, req, role) {
  const tok = parseCookies(req)[COOKIE[role]]; if (!tok) return null;
  const s = db.get('SELECT * FROM sessions WHERE id_hash = ? AND role = ?', sha(tok), role); if (!s) return null;
  const now = Date.now();
  if (s.expires_at < now || s.last_seen < now - cfg.sessionIdleMin * 60e3) { db.run('DELETE FROM sessions WHERE id_hash = ?', s.id_hash); return null; }
  if (now - s.last_seen > 15000) db.run('UPDATE sessions SET last_seen = ? WHERE id_hash = ?', now, s.id_hash);
  return s;
}
function destroySession(db, req, res, role) {
  const tok = parseCookies(req)[COOKIE[role]];
  if (tok) db.run('DELETE FROM sessions WHERE id_hash = ?', sha(tok));
  addCookie(res, cookieStr(COOKIE[role], '', { maxAge: 0 }));
}

/* ---------- request origin check (CSRF layer 1) ---------- */
function sameOrigin(req) {
  const o = req.headers.origin;
  if (o) { try { return new URL(o).host === req.headers.host; } catch (e) { return false; } }
  const sf = req.headers['sec-fetch-site']; return !sf || sf === 'same-origin' || sf === 'none';
}

/* ---------- security headers ---------- */
function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (cfg.cookieSecure) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  addCookie(res, cookieStr('ep_srv', '1', { httpOnly: false, sameSite: 'Lax' })); /* tells the static pages an API is available */
}

/* ---------- static files ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const BLOCKED = /^(server|data|test|node_modules|\.|portal\/.*\.md)/i;
const CLEAN = {
  '/student/login': 'portal/student-login.html', '/admin/login': 'portal/admin-login.html',
  '/student/dashboard': 'portal/student.html', '/student/profile': 'portal/student.html', '/student/exams': 'portal/student.html', '/student/notifications': 'portal/student.html', '/student/settings': 'portal/student.html',
  '/admin/dashboard': 'portal/admin-app.html', '/admin/students': 'portal/admin-app.html', '/admin/courses': 'portal/admin-app.html', '/admin/exams': 'portal/admin-app.html', '/admin/notifications': 'portal/admin-app.html', '/admin/analytics': 'portal/admin-app.html', '/admin/settings': 'portal/admin-app.html', '/admin/audit': 'portal/admin-app.html'
};
function serveStatic(req, res, pathname) {
  let rel = CLEAN[pathname.replace(/\/+$/, '')] || decodeURIComponent(pathname).replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  const file = path.resolve(cfg.ROOT, rel);
  if (!file.startsWith(cfg.ROOT + path.sep) || BLOCKED.test(rel) || /(^|\/)package(-lock)?\.json$|(^|\/)\.env/.test(rel)) return notFound(res);
  const ext = path.extname(file).toLowerCase();
  if (!MIME[ext]) return notFound(res);
  fs.readFile(file, (e, buf) => {
    if (e) return notFound(res);
    const h = { 'Content-Type': MIME[ext], 'Cache-Control': ext === '.html' || rel === 'sw.js' || rel === 'content.json' ? 'no-cache' : 'public, max-age=300' };
    if (rel.startsWith('portal/')) h['Cache-Control'] = 'no-store';
    res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : buf);
  });
}
function notFound(res) {
  fs.readFile(path.join(cfg.ROOT, '404.html'), (e, b) => { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(e ? 'Not found' : b); });
}

module.exports = { HttpError, bad, hashPassword, verifyPassword, DUMMY_HASH, checkPasswordPolicy, sha, hmac, nowIso, dayStr, parseCookies, cookieStr, addCookie, send, readBody, str, email, int, isoDate, photoUrl, rateLimit, rateGuard, rateFail, rateReset, createSession, loadSession, destroySession, sameOrigin, securityHeaders, serveStatic, notFound };
