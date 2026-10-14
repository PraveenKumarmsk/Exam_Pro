'use strict';
const crypto = require('crypto');
const core = require('../core');

module.exports = function (r, db) {
  /* Visitor counting method (documented in README):
     - a random, httpOnly cookie (ep_vid, 1 year) identifies a browser; only an HMAC of it is stored (no IP, no user agent)
     - one row per visitor in `visitors` (unique visitors) and one row per visitor per day in `visits` (daily unique visitors + page views) */
  function touchVisitor(ctx, countView) {
    let vid = core.parseCookies(ctx.req).ep_vid;
    if (!vid || !/^[A-Za-z0-9_-]{16,64}$/.test(vid)) {
      vid = crypto.randomBytes(18).toString('base64url');
      core.addCookie(ctx.res, core.cookieStr('ep_vid', vid, { maxAge: 365 * 86400, sameSite: 'Lax' }));
    }
    const h = core.hmac('vid:' + vid), now = Date.now(), day = core.dayStr();
    db.run('INSERT INTO visitors (vid_hash, first_seen, last_seen) VALUES (?,?,?) ON CONFLICT(vid_hash) DO UPDATE SET last_seen = excluded.last_seen', h, now, now);
    if (countView) db.run('INSERT INTO visits (vid_hash, day, views) VALUES (?,?,1) ON CONFLICT(vid_hash, day) DO UPDATE SET views = views + 1', h, day);
  }
  r.get('/api/health', () => ({ ok: true }));
  r.post('/api/visit', ctx => { core.rateLimit('visit:' + ctx.ip, 240, 60e3); touchVisitor(ctx, true); });
  r.post('/api/heartbeat', ctx => { core.rateLimit('hb:' + ctx.ip, 120, 60e3); touchVisitor(ctx, false); core.loadSession(db, ctx.req, 'student'); core.loadSession(db, ctx.req, 'admin'); /* loadSession refreshes last_seen */ });
  r.post('/api/contact', ctx => {
    core.rateLimit('contact:' + ctx.ip, 5, 3600e3, 'You have sent several messages recently. Please try again later.');
    const b = ctx.body;
    db.run('INSERT INTO messages (name, email, topic, body) VALUES (?,?,?,?)', core.str(b.name, 'Name', { max: 100 }), core.email(b.email), core.str(b.topic, 'Topic', { optional: true, max: 80 }), core.str(b.msg, 'Message', { min: 10, max: 3000 }));
    return { ok: true };
  });
};
