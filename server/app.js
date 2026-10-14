'use strict';
const http = require('http'), crypto = require('crypto');
const core = require('./core'), cfg = require('./config');
const { HttpError } = core;

function compile(p) { const keys = []; const re = new RegExp('^' + p.replace(/:([a-z_]+)/gi, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$'); return { re, keys }; }

function createApp({ db, quiet = false }) {
  const routes = [];
  const r = {};
  ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].forEach(m => {
    r[m.toLowerCase()] = (p, opts, fn) => { if (typeof opts === 'function') { fn = opts; opts = {}; } routes.push(Object.assign({ method: m, fn, opts }, compile(p))); };
  });
  require('./routes/public')(r, db);
  const student = require('./routes/student')(r, db);
  require('./routes/admin')(r, db);

  const settingNum = (k, d) => { const x = db.get('SELECT value FROM settings WHERE key = ?', k); const n = x ? +x.value : NaN; return n > 0 ? n : d; };
  const guard = (req, role) => { const s = core.loadSession(db, req, role); if (!s) return null; const u = db.get(`SELECT * FROM ${role === 'admin' ? 'admins' : 'students'} WHERE id = ?`, s.user_id); if (!u || !u.active) { db.run('DELETE FROM sessions WHERE id_hash = ?', s.id_hash); return null; } return { s, u }; };

  async function handleApi(req, res, url) {
    const ip = req.socket.remoteAddress || '';
    const matches = routes.filter(x => x.re.test(url.pathname));
    if (!matches.length) throw new HttpError(404, 'Unknown API endpoint.');
    const route = matches.find(x => x.method === req.method);
    if (!route) throw new HttpError(405, 'Method not allowed.');
    const changing = req.method !== 'GET';
    if (changing && !core.sameOrigin(req)) throw new HttpError(403, 'Cross-site request blocked.');
    const m = url.pathname.match(route.re), params = {}; route.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
    const ctx = { req, res, db, ip, params, query: Object.fromEntries(url.searchParams), body: {}, settingNum };
    if (route.opts.auth) {
      const g = guard(req, route.opts.auth);
      if (!g) throw new HttpError(401, 'Please sign in.');
      ctx.session = g.s; ctx.user = g.u;
      if (changing) {
        const t = String(req.headers['x-csrf-token'] || ''), a = Buffer.from(t), b = Buffer.from(g.s.csrf);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(403, 'Security token missing or expired. Reload the page.');
      }
    }
    if (changing) ctx.body = await core.readBody(req);
    const out = await route.fn(ctx);
    if (out === undefined) return core.send(res, 204, '');
    if (out && out.__raw) return core.send(res, 200, out.body, out.headers);
    core.send(res, 200, out);
  }

  const server = http.createServer(async (req, res) => {
    core.securityHeaders(res);
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
      const p = url.pathname.replace(/\/+$/, '') || '/';
      const ex = p.match(/^\/exam\/(\d+)$/);
      if (ex) return student.examEntry(req, res, +ex[1], guard);
      const side = p.startsWith('/student/') ? 'student' : p.startsWith('/admin/') ? 'admin' : null;
      if (side) {
        const loggedIn = !!guard(req, side), isLogin = p === `/${side}/login`;
        const known = ['/student/login', '/student/dashboard', '/student/profile', '/student/exams', '/student/notifications', '/student/settings', '/admin/login', '/admin/dashboard', '/admin/students', '/admin/courses', '/admin/exams', '/admin/notifications', '/admin/analytics', '/admin/settings', '/admin/audit'].includes(p);
        if (known && !isLogin && !loggedIn) { res.writeHead(302, { Location: `/${side}/login`, 'Cache-Control': 'no-store' }); return res.end(); }
        if (known && isLogin && loggedIn) { res.writeHead(302, { Location: `/${side}/dashboard`, 'Cache-Control': 'no-store' }); return res.end(); }
      }
      core.serveStatic(req, res, p);
    } catch (e) {
      if (e instanceof HttpError) {
        const h = e.extra && e.extra.retryAfter ? { 'Retry-After': String(e.extra.retryAfter) } : {};
        if (!res.headersSent) {
          if (req.url.startsWith('/api/')) return core.send(res, e.status, { error: e.message }, h);
          res.writeHead(e.status, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(e.message);
        }
      }
      if (!quiet) console.error('[error]', req.method, req.url, e && e.stack || e);
      if (!res.headersSent) core.send(res, 500, { error: 'Something went wrong on the server.' });
    }
  });
  /* housekeeping: expired sessions + old visitor rows */
  const timer = setInterval(() => { try { db.run('DELETE FROM sessions WHERE expires_at < ?', Date.now()); } catch (e) {} }, 10 * 60e3); timer.unref();
  server.on('close', () => clearInterval(timer));
  return server;
}
module.exports = { createApp };
