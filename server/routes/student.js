'use strict';
const core = require('../core'), { HttpError, bad } = core;
const { visibleExams, publicStudent } = require('../lib');

module.exports = function (r, db) {
  const S = { auth: 'student' };
  const me = ctx => ({ student: publicStudent(ctx.user), csrf: ctx.session.csrf });

  /* ---- auth ---- */
  r.post('/api/student/login', ctx => {
    core.rateGuard('slogin-ip:' + ctx.ip, 20, 'Too many failed sign-ins from this network. Try again in a few minutes.');
    const id = core.str(ctx.body.identifier, 'Student ID or email', { max: 160 }).toLowerCase(), pw = typeof ctx.body.password === 'string' ? ctx.body.password.slice(0, 200) : '';
    core.rateGuard('slogin-id:' + id, 6, 'This account is temporarily locked after repeated failed sign-ins. Try again in 15 minutes.');
    const u = db.get('SELECT * FROM students WHERE lower(email) = ? OR lower(student_code) = ?', id, id);
    const ok = core.verifyPassword(pw, u ? u.pass_hash : core.DUMMY_HASH) && u;
    if (!ok) { core.rateFail('slogin-ip:' + ctx.ip, 15 * 60e3); core.rateFail('slogin-id:' + id, 15 * 60e3); throw new HttpError(401, 'Incorrect student ID/email or password.'); }
    if (!u.active) throw new HttpError(403, 'This account is deactivated. Please contact the institute.');
    core.rateReset('slogin-id:' + id);
    db.run('UPDATE students SET last_login_at = ? WHERE id = ?', core.nowIso(), u.id);
    const csrf = core.createSession(db, ctx.res, 'student', u.id);
    return { student: publicStudent(u), csrf };
  });
  r.post('/api/student/logout', S, ctx => { core.destroySession(db, ctx.req, ctx.res, 'student'); });
  r.get('/api/student/me', S, me);

  /* ---- data (always scoped to ctx.user.id from the session, never from the request) ---- */
  function enrollments(sid) {
    return db.all(`SELECT en.id, en.status, en.enrolled_at, c.name AS course, c.code AS course_code, c.description, b.name AS batch, b.start_date
      FROM enrollments en JOIN courses c ON c.id = en.course_id LEFT JOIN batches b ON b.id = en.batch_id WHERE en.student_id = ? ORDER BY en.enrolled_at DESC`, sid);
  }
  function results(sid, limit = 100) {
    return db.all('SELECT id, exam_id, title, score, total, pct, duration_sec, taken_at FROM results WHERE student_id = ? ORDER BY taken_at DESC, id DESC LIMIT ?', sid, limit);
  }
  function notifications(sid, limit = 100) {
    return db.all(`SELECT n.id, n.title, n.body, n.created_at, nr.read_at FROM notification_recipients nr JOIN notifications n ON n.id = nr.notification_id
      WHERE nr.student_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT ?`, sid, limit);
  }
  const announcements = (limit = 10) => db.all('SELECT id, title, body, created_at FROM announcements ORDER BY created_at DESC, id DESC LIMIT ?', limit);

  r.get('/api/student/dashboard', S, ctx => {
    const sid = ctx.user.id, notes = notifications(sid, 5), res = results(sid, 5);
    const all = db.get('SELECT COUNT(*) AS n, ROUND(AVG(pct)) AS avg FROM results WHERE student_id = ?', sid);
    return {
      student: publicStudent(ctx.user), enrollments: enrollments(sid),
      exams: visibleExams(db, sid).filter(e => e.state !== 'closed').slice(0, 6),
      results: res, stats: { attempts: all.n, avg_pct: all.n ? all.avg : null },
      notifications: notes, unread: db.get('SELECT COUNT(*) AS n FROM notification_recipients WHERE student_id = ? AND read_at IS NULL', sid).n,
      announcements: announcements(3)
    };
  });
  r.get('/api/student/exams', S, ctx => ({ exams: visibleExams(db, ctx.user.id) }));
  r.get('/api/student/results', S, ctx => ({ results: results(ctx.user.id) }));
  r.get('/api/student/profile', S, ctx => ({ student: publicStudent(ctx.user), enrollments: enrollments(ctx.user.id) }));
  r.patch('/api/student/profile', S, ctx => {
    const name = core.str(ctx.body.name, 'Name', { max: 100 }), phone = core.str(ctx.body.phone, 'Phone', { optional: true, max: 20 });
    if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) throw bad('Phone number is not valid.');
    db.run('UPDATE students SET name = ?, phone = ? WHERE id = ?', name, phone, ctx.user.id);
    return { student: publicStudent(db.get('SELECT * FROM students WHERE id = ?', ctx.user.id)) };
  });
  r.post('/api/student/password', S, ctx => {
    core.rateLimit('spw:' + ctx.user.id, 8, 15 * 60e3);
    if (!core.verifyPassword(String(ctx.body.current || ''), ctx.user.pass_hash)) throw new HttpError(403, 'Current password is incorrect.');
    core.checkPasswordPolicy(ctx.body.next);
    db.run('UPDATE students SET pass_hash = ? WHERE id = ?', core.hashPassword(ctx.body.next), ctx.user.id);
    db.run('DELETE FROM sessions WHERE role = ? AND user_id = ? AND id_hash <> ?', 'student', ctx.user.id, ctx.session.id_hash); /* sign out other devices */
    return { ok: true };
  });

  /* ---- notifications: a student can only read/mark rows addressed to them ---- */
  r.get('/api/student/notifications', S, ctx => ({
    notifications: notifications(ctx.user.id), announcements: announcements(20),
    unread: db.get('SELECT COUNT(*) AS n FROM notification_recipients WHERE student_id = ? AND read_at IS NULL', ctx.user.id).n
  }));
  r.post('/api/student/notifications/:id/read', S, ctx => {
    const x = db.run('UPDATE notification_recipients SET read_at = COALESCE(read_at, ?) WHERE notification_id = ? AND student_id = ?', core.nowIso(), +ctx.params.id, ctx.user.id);
    if (!x.changes) throw new HttpError(404, 'Notification not found.');
    return { ok: true };
  });
  r.post('/api/student/notifications-read-all', S, ctx => { db.run('UPDATE notification_recipients SET read_at = ? WHERE student_id = ? AND read_at IS NULL', core.nowIso(), ctx.user.id); return { ok: true }; });

  /* ---- exam results. The exam questions live in the browser (static site), so the score is
         reported by the exam page; the server enforces who may submit, the window and the attempt limit. ---- */
  r.post('/api/student/results', S, ctx => {
    core.rateLimit('res:' + ctx.user.id, 30, 3600e3);
    const b = ctx.body, total = core.int(b.total, 'Total', { min: 1, max: 500 }), score = core.int(b.score, 'Score', { min: 0, max: total });
    const dur = core.int(b.duration_sec, 'Duration', { min: 0, max: 86400, optional: true });
    let title = core.str(b.title, 'Title', { max: 200, optional: !!b.exam_id }), examId = null;
    if (b.exam_id !== undefined && b.exam_id !== null && b.exam_id !== '') {
      examId = core.int(b.exam_id, 'Exam', { min: 1 });
      const e = visibleExams(db, ctx.user.id).find(x => x.id === examId);
      if (!e) throw new HttpError(403, 'This exam is not available to you.');
      if (e.state !== 'open') throw new HttpError(409, 'This exam is not open right now.');
      if (e.attempts_left < 1) throw new HttpError(409, 'No attempts left for this exam.');
      title = e.title;
    }
    db.run('INSERT INTO results (student_id, exam_id, title, score, total, pct, duration_sec, taken_at) VALUES (?,?,?,?,?,?,?,?)', ctx.user.id, examId, title, score, total, Math.round(score / total * 100), dur, core.nowIso());
    return { ok: true };
  });

  /* ---- /exam/:id — separate exam route; checks eligibility, then opens the independent exam page ---- */
  function examEntry(req, res, id, guard) {
    const g = guard(req, 'student');
    if (!g) { res.writeHead(302, { Location: '/student/login', 'Cache-Control': 'no-store' }); return res.end(); }
    const e = visibleExams(db, g.u.id).find(x => x.id === id);
    const page = (status, msg) => { res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Exam unavailable</title><body style="font-family:system-ui;max-width:520px;margin:12vh auto;padding:0 20px"><h1>Exam unavailable</h1><p>${msg}</p><p><a href="/student/exams">Back to my exams</a></p></body>`); };
    if (!e) return page(404, 'This exam does not exist or is not available to you.');
    if (e.state === 'upcoming') return page(403, 'This exam has not started yet.');
    if (e.state === 'closed') return page(403, 'This exam window has ended.');
    if (e.attempts_left < 1) return page(403, 'You have used all attempts for this exam.');
    if (!e.test_id) return page(409, 'This exam has no question paper linked yet. Please contact the institute.');
    res.writeHead(302, { Location: `/test-attempt.html?id=${e.test_id}&exam=${e.id}`, 'Cache-Control': 'no-store' }); res.end();
  }
  return { examEntry };
};
