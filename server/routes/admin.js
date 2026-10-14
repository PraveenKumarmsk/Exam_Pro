'use strict';
const core = require('../core'), { HttpError, bad } = core;
const { examState, audit, publicStudent, nextStudentCode } = require('../lib');

module.exports = function (r, db) {
  const A = { auth: 'admin' };
  const setting = (k, d) => { const x = db.get('SELECT value FROM settings WHERE key = ?', k); return x ? x.value : d; };
  const activeMin = () => { const n = +setting('active_timeout_min', 0); return n > 0 ? n : require('../config').activeTimeoutMin; };
  const must = (row, what = 'Record') => { if (!row) throw new HttpError(404, what + ' not found.'); return row; };
  const idp = ctx => core.int(ctx.params.id, 'ID', { min: 1 });
  const wrap = (a) => ({ admin: { id: a.id, email: a.email, name: a.name } });

  /* ---------- auth ---------- */
  r.post('/api/admin/login', ctx => {
    core.rateGuard('alogin-ip:' + ctx.ip, 15, 'Too many failed sign-ins from this network. Try again in a few minutes.');
    const em = core.str(ctx.body.email, 'Email', { max: 160 }).toLowerCase(), pw = typeof ctx.body.password === 'string' ? ctx.body.password.slice(0, 200) : '';
    core.rateGuard('alogin-id:' + em, 5, 'This admin account is temporarily locked after repeated failed sign-ins. Try again in 15 minutes.');
    const a = db.get('SELECT * FROM admins WHERE lower(email) = ?', em);
    const ok = core.verifyPassword(pw, a ? a.pass_hash : core.DUMMY_HASH) && a;
    if (!ok || !a.active) { core.rateFail('alogin-ip:' + ctx.ip, 15 * 60e3); core.rateFail('alogin-id:' + em, 15 * 60e3); if (a) { ctx.user = a; audit(ctx, 'login_failed', em); } throw new HttpError(401, 'Incorrect email or password.'); }
    core.rateReset('alogin-id:' + em);
    db.run('UPDATE admins SET last_login_at = ? WHERE id = ?', core.nowIso(), a.id);
    ctx.user = a; audit(ctx, 'login', em);
    return Object.assign(wrap(a), { csrf: core.createSession(db, ctx.res, 'admin', a.id) });
  });
  r.post('/api/admin/logout', A, ctx => { audit(ctx, 'logout'); core.destroySession(db, ctx.req, ctx.res, 'admin'); });
  r.get('/api/admin/me', A, ctx => Object.assign(wrap(ctx.user), { csrf: ctx.session.csrf }));
  r.post('/api/admin/password', A, ctx => {
    core.rateLimit('apw:' + ctx.user.id, 8, 15 * 60e3);
    if (!core.verifyPassword(String(ctx.body.current || ''), ctx.user.pass_hash)) throw new HttpError(403, 'Current password is incorrect.');
    core.checkPasswordPolicy(ctx.body.next);
    db.run('UPDATE admins SET pass_hash = ? WHERE id = ?', core.hashPassword(ctx.body.next), ctx.user.id);
    db.run('DELETE FROM sessions WHERE role = ? AND user_id = ? AND id_hash <> ?', 'admin', ctx.user.id, ctx.session.id_hash);
    audit(ctx, 'admin_password_changed'); return { ok: true };
  });

  /* ---------- dashboard metrics (all computed from the database) ---------- */
  r.get('/api/admin/metrics', A, () => {
    const now = Date.now(), cut = now - activeMin() * 60e3, today = core.dayStr();
    const exams = db.all('SELECT * FROM exams'), count = { draft: 0, upcoming: 0, open: 0, closed: 0 };
    exams.forEach(e => count[examState(e, now)]++);
    const days = []; for (let i = 13; i >= 0; i--) days.push(core.dayStr(new Date(now - i * 86400e3)));
    const vd = Object.fromEntries(db.all('SELECT day, COUNT(*) AS v, SUM(views) AS p FROM visits WHERE day >= ? GROUP BY day', days[0]).map(x => [x.day, x]));
    const rd = Object.fromEntries(db.all("SELECT substr(taken_at,1,10) AS day, COUNT(*) AS n FROM results WHERE substr(taken_at,1,10) >= ? GROUP BY day", days[0]).map(x => [x.day, x.n]));
    const q = (sql, ...p) => db.get(sql, ...p).n;
    return {
      active_timeout_min: activeMin(), generated_at: core.nowIso(),
      students: {
        registered: q('SELECT COUNT(*) AS n FROM students'), active_accounts: q('SELECT COUNT(*) AS n FROM students WHERE active = 1'),
        enrolled: q("SELECT COUNT(DISTINCT student_id) AS n FROM enrollments WHERE status = 'active'"), demo: q('SELECT COUNT(*) AS n FROM students WHERE is_demo = 1')
      },
      visitors: { total: q('SELECT COUNT(*) AS n FROM visitors'), today: q('SELECT COUNT(*) AS n FROM visits WHERE day = ?', today), page_views_today: db.get('SELECT COALESCE(SUM(views),0) AS n FROM visits WHERE day = ?', today).n },
      active: { users: q('SELECT COUNT(*) AS n FROM visitors WHERE last_seen > ?', cut), students: q("SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE role = 'student' AND last_seen > ? AND expires_at > ?", cut, now), admins: q("SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE role = 'admin' AND last_seen > ? AND expires_at > ?", cut, now) },
      exams: { total: exams.length, completed: count.closed, upcoming: count.upcoming, open: count.open, draft: count.draft, attempts: q('SELECT COUNT(*) AS n FROM results'), avg_pct: db.get('SELECT ROUND(AVG(pct)) AS n FROM results').n },
      notifications: { total: q('SELECT COUNT(*) AS n FROM notifications'), announcements: q('SELECT COUNT(*) AS n FROM announcements'), unread_messages: q('SELECT COUNT(*) AS n FROM messages WHERE read_at IS NULL'), total_messages: q('SELECT COUNT(*) AS n FROM messages') },
      series: { days, visitors: days.map(d => vd[d] ? vd[d].v : 0), views: days.map(d => vd[d] ? vd[d].p : 0), attempts: days.map(d => rd[d] || 0) },
      by_course: db.all("SELECT c.name, COUNT(en.id) AS n FROM courses c LEFT JOIN enrollments en ON en.course_id = c.id AND en.status = 'active' GROUP BY c.id ORDER BY n DESC, c.name"),
      recent_results: db.all('SELECT r.title, r.score, r.total, r.pct, r.taken_at, s.name, s.student_code FROM results r JOIN students s ON s.id = r.student_id ORDER BY r.taken_at DESC, r.id DESC LIMIT 6')
    };
  });

  /* ---------- students ---------- */
  r.get('/api/admin/students', A, ctx => {
    const q = (ctx.query.q || '').trim().toLowerCase(), st = ctx.query.status;
    const where = [], p = [];
    if (q) { where.push('(lower(s.name) LIKE ? OR lower(s.email) LIKE ? OR lower(s.student_code) LIKE ?)'); p.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (st === 'active') where.push('s.active = 1'); if (st === 'inactive') where.push('s.active = 0');
    if (ctx.query.course_id) { where.push("s.id IN (SELECT student_id FROM enrollments WHERE course_id = ? AND status = 'active')"); p.push(+ctx.query.course_id || 0); }
    const rows = db.all(`SELECT s.*, (SELECT group_concat(c.name, ', ') FROM enrollments en JOIN courses c ON c.id = en.course_id WHERE en.student_id = s.id AND en.status = 'active') AS courses,
      (SELECT COUNT(*) FROM results r WHERE r.student_id = s.id) AS attempts FROM students s ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.created_at DESC, s.id DESC LIMIT 500`, ...p);
    return { students: rows.map(s => Object.assign(publicStudent(s), { courses: s.courses, attempts: s.attempts })) };
  });
  r.get('/api/admin/students/:id', A, ctx => {
    const s = must(db.get('SELECT * FROM students WHERE id = ?', idp(ctx)), 'Student');
    return {
      student: publicStudent(s),
      enrollments: db.all('SELECT en.id, en.status, en.enrolled_at, en.course_id, en.batch_id, c.name AS course, b.name AS batch FROM enrollments en JOIN courses c ON c.id = en.course_id LEFT JOIN batches b ON b.id = en.batch_id WHERE en.student_id = ?', s.id),
      results: db.all('SELECT title, score, total, pct, taken_at FROM results WHERE student_id = ? ORDER BY taken_at DESC LIMIT 20', s.id),
      unread: db.get('SELECT COUNT(*) AS n FROM notification_recipients WHERE student_id = ? AND read_at IS NULL', s.id).n
    };
  });
  function studentFields(b, existing) {
    const o = { name: core.str(b.name, 'Name', { max: 100 }), email: core.email(b.email), phone: core.str(b.phone, 'Phone', { optional: true, max: 20 }), photo_url: core.photoUrl(b.photo_url) };
    if (o.phone && !/^[0-9+\-\s()]{6,20}$/.test(o.phone)) throw bad('Phone number is not valid.');
    const code = core.str(b.student_code, 'Student ID', { optional: true, max: 30 });
    if (code) { if (!/^[A-Za-z0-9_-]{3,30}$/.test(code)) throw bad('Student ID may contain letters, numbers, - and _ only.'); o.student_code = code.toUpperCase(); }
    return o;
  }
  r.post('/api/admin/students', A, ctx => {
    const o = studentFields(ctx.body); core.checkPasswordPolicy(ctx.body.password);
    o.student_code = o.student_code || nextStudentCode(db);
    if (db.get('SELECT 1 FROM students WHERE lower(email) = ?', o.email)) throw new HttpError(409, 'A student with this email already exists.');
    if (db.get('SELECT 1 FROM students WHERE student_code = ?', o.student_code)) throw new HttpError(409, 'This Student ID is already used.');
    const id = db.tx(() => {
      const x = db.run('INSERT INTO students (student_code, name, email, pass_hash, phone, photo_url) VALUES (?,?,?,?,?,?)', o.student_code, o.name, o.email, core.hashPassword(ctx.body.password), o.phone, o.photo_url);
      if (ctx.body.course_id) db.run("INSERT INTO enrollments (student_id, course_id, batch_id, status) VALUES (?,?,?, 'active')", x.lastInsertRowid, core.int(ctx.body.course_id, 'Course', { min: 1 }), ctx.body.batch_id ? core.int(ctx.body.batch_id, 'Batch', { min: 1 }) : null);
      return Number(x.lastInsertRowid);
    });
    audit(ctx, 'student_created', o.student_code, o.name); return { id };
  });
  r.patch('/api/admin/students/:id', A, ctx => {
    const s = must(db.get('SELECT * FROM students WHERE id = ?', idp(ctx)), 'Student'), b = ctx.body;
    const o = studentFields(Object.assign({}, publicStudent(s), b));
    const dup = db.get('SELECT 1 FROM students WHERE lower(email) = ? AND id <> ?', o.email, s.id); if (dup) throw new HttpError(409, 'Another student already uses this email.');
    const code = o.student_code || s.student_code; if (db.get('SELECT 1 FROM students WHERE student_code = ? AND id <> ?', code, s.id)) throw new HttpError(409, 'This Student ID is already used.');
    const active = b.active === undefined ? s.active : (b.active ? 1 : 0);
    db.run('UPDATE students SET name = ?, email = ?, phone = ?, photo_url = ?, student_code = ?, active = ? WHERE id = ?', o.name, o.email, o.phone, o.photo_url, code, active, s.id);
    if (!active) db.run("DELETE FROM sessions WHERE role = 'student' AND user_id = ?", s.id);
    audit(ctx, active === s.active ? 'student_updated' : (active ? 'student_activated' : 'student_deactivated'), s.student_code); return { ok: true };
  });
  r.post('/api/admin/students/:id/password', A, ctx => {
    const s = must(db.get('SELECT * FROM students WHERE id = ?', idp(ctx)), 'Student'); core.checkPasswordPolicy(ctx.body.password);
    db.run('UPDATE students SET pass_hash = ? WHERE id = ?', core.hashPassword(ctx.body.password), s.id); db.run("DELETE FROM sessions WHERE role = 'student' AND user_id = ?", s.id);
    audit(ctx, 'student_password_reset', s.student_code); return { ok: true };
  });

  /* ---------- courses, batches, enrollments ---------- */
  r.get('/api/admin/courses', A, () => ({
    courses: db.all("SELECT c.*, (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') AS enrolled FROM courses c ORDER BY c.name"),
    batches: db.all('SELECT b.*, c.name AS course, (SELECT COUNT(*) FROM enrollments e WHERE e.batch_id = b.id) AS members FROM batches b JOIN courses c ON c.id = b.course_id ORDER BY b.start_date DESC, b.id DESC'),
    enrollments: db.all('SELECT en.id, en.status, en.enrolled_at, s.name AS student, s.student_code, c.name AS course, b.name AS batch, en.student_id, en.course_id, en.batch_id FROM enrollments en JOIN students s ON s.id = en.student_id JOIN courses c ON c.id = en.course_id LEFT JOIN batches b ON b.id = en.batch_id ORDER BY en.enrolled_at DESC LIMIT 500')
  }));
  r.post('/api/admin/courses', A, ctx => {
    const code = core.str(ctx.body.code, 'Code', { max: 20 }).toUpperCase(); if (db.get('SELECT 1 FROM courses WHERE code = ?', code)) throw new HttpError(409, 'Course code already exists.');
    const x = db.run('INSERT INTO courses (code, name, description) VALUES (?,?,?)', code, core.str(ctx.body.name, 'Name', { max: 120 }), core.str(ctx.body.description, 'Description', { optional: true, max: 500 }));
    audit(ctx, 'course_created', code); return { id: Number(x.lastInsertRowid) };
  });
  r.patch('/api/admin/courses/:id', A, ctx => {
    const c = must(db.get('SELECT * FROM courses WHERE id = ?', idp(ctx)), 'Course');
    db.run('UPDATE courses SET name = ?, description = ?, active = ? WHERE id = ?', core.str(ctx.body.name, 'Name', { max: 120 }), core.str(ctx.body.description, 'Description', { optional: true, max: 500 }), ctx.body.active === undefined ? c.active : (ctx.body.active ? 1 : 0), c.id);
    audit(ctx, 'course_updated', c.code); return { ok: true };
  });
  r.post('/api/admin/batches', A, ctx => {
    const cid = core.int(ctx.body.course_id, 'Course', { min: 1 }); must(db.get('SELECT 1 AS x FROM courses WHERE id = ?', cid), 'Course');
    const x = db.run('INSERT INTO batches (course_id, name, start_date) VALUES (?,?,?)', cid, core.str(ctx.body.name, 'Batch name', { max: 100 }), core.str(ctx.body.start_date, 'Start date', { optional: true, max: 10 }));
    audit(ctx, 'batch_created', ctx.body.name); return { id: Number(x.lastInsertRowid) };
  });
  r.post('/api/admin/enrollments', A, ctx => {
    const sid = core.int(ctx.body.student_id, 'Student', { min: 1 }), cid = core.int(ctx.body.course_id, 'Course', { min: 1 }), bid = ctx.body.batch_id ? core.int(ctx.body.batch_id, 'Batch', { min: 1 }) : null;
    const s = must(db.get('SELECT * FROM students WHERE id = ?', sid), 'Student'); must(db.get('SELECT 1 AS x FROM courses WHERE id = ?', cid), 'Course');
    if (bid && !db.get('SELECT 1 FROM batches WHERE id = ? AND course_id = ?', bid, cid)) throw bad('That batch does not belong to the chosen course.');
    if (db.get('SELECT 1 FROM enrollments WHERE student_id = ? AND course_id = ?', sid, cid)) throw new HttpError(409, 'Student is already enrolled in this course.');
    db.run("INSERT INTO enrollments (student_id, course_id, batch_id, status) VALUES (?,?,?, 'active')", sid, cid, bid);
    audit(ctx, 'enrolled', s.student_code, 'course ' + cid); return { ok: true };
  });
  r.patch('/api/admin/enrollments/:id', A, ctx => {
    const e = must(db.get('SELECT * FROM enrollments WHERE id = ?', idp(ctx)), 'Enrollment'), st = ctx.body.status || e.status;
    if (!['active', 'completed', 'dropped'].includes(st)) throw bad('Invalid status.');
    const bid = ctx.body.batch_id === undefined ? e.batch_id : (ctx.body.batch_id ? core.int(ctx.body.batch_id, 'Batch', { min: 1 }) : null);
    if (bid && !db.get('SELECT 1 FROM batches WHERE id = ? AND course_id = ?', bid, e.course_id)) throw bad('That batch does not belong to this course.');
    db.run('UPDATE enrollments SET status = ?, batch_id = ? WHERE id = ?', st, bid, e.id); audit(ctx, 'enrollment_updated', String(e.id), st); return { ok: true };
  });
  r.delete('/api/admin/enrollments/:id', A, ctx => { const e = must(db.get('SELECT * FROM enrollments WHERE id = ?', idp(ctx)), 'Enrollment'); db.run('DELETE FROM enrollments WHERE id = ?', e.id); audit(ctx, 'enrollment_removed', String(e.id)); return { ok: true }; });


  /* mock tests an exam can be linked to (read from the site's own test list; the questions stay in the static site) */
  r.get('/api/admin/tests', A, () => {
    const fs = require('fs'), path = require('path'), root = require('../config').ROOT, out = [];
    try {
      const js = fs.readFileSync(path.join(root, 'shared.js'), 'utf8'), i = js.indexOf('const TESTS = ['), j = js.indexOf('\n];', i), block = js.slice(i, j);
      for (const m of block.matchAll(/\{\s*id:\s*(\d+),\s*title:\s*'((?:[^'\\]|\\.)*)'/g)) out.push({ id: +m[1], title: m[2].replace(/\\'/g, "'") });
    } catch (e) {}
    try { (JSON.parse(fs.readFileSync(path.join(root, 'content.json'), 'utf8')).tests || []).forEach(t => { if (t && Number.isInteger(+t.id) && t.title && !out.some(x => x.id === +t.id)) out.push({ id: +t.id, title: String(t.title) }); }); } catch (e) {}
    return { tests: out };
  });

  /* ---------- exams ---------- */
  function examFields(b) {
    const o = { title: core.str(b.title, 'Title', { max: 160 }), test_id: core.int(b.test_id, 'Linked mock test', { min: 1, optional: true }), course_id: core.int(b.course_id, 'Course', { min: 1, optional: true }),
      instructions: core.str(b.instructions, 'Instructions', { optional: true, max: 1500 }), duration_min: core.int(b.duration_min, 'Duration', { min: 1, max: 600 }), start_at: core.isoDate(b.start_at, 'Start'), end_at: core.isoDate(b.end_at, 'End'),
      max_attempts: core.int(b.max_attempts, 'Attempts', { min: 1, max: 20 }), status: b.status === 'published' ? 'published' : 'draft' };
    if (o.start_at && o.end_at && Date.parse(o.end_at) <= Date.parse(o.start_at)) throw bad('End must be after start.');
    if (o.course_id && !db.get('SELECT 1 FROM courses WHERE id = ?', o.course_id)) throw bad('Course not found.');
    if (o.status === 'published' && !o.test_id) throw bad('Link a mock test before publishing.');
    return o;
  }
  r.get('/api/admin/exams', A, () => ({ exams: db.all('SELECT e.*, c.name AS course_name, (SELECT COUNT(*) FROM results r WHERE r.exam_id = e.id) AS attempts, (SELECT ROUND(AVG(pct)) FROM results r WHERE r.exam_id = e.id) AS avg_pct FROM exams e LEFT JOIN courses c ON c.id = e.course_id ORDER BY e.created_at DESC, e.id DESC').map(e => Object.assign(e, { state: examState(e) })) }));
  r.post('/api/admin/exams', A, ctx => { const o = examFields(ctx.body); const x = db.run('INSERT INTO exams (title,test_id,course_id,instructions,duration_min,start_at,end_at,max_attempts,status) VALUES (?,?,?,?,?,?,?,?,?)', o.title, o.test_id, o.course_id, o.instructions, o.duration_min, o.start_at, o.end_at, o.max_attempts, o.status); audit(ctx, 'exam_created', o.title); return { id: Number(x.lastInsertRowid) }; });
  r.patch('/api/admin/exams/:id', A, ctx => { const e = must(db.get('SELECT * FROM exams WHERE id = ?', idp(ctx)), 'Exam'); const o = examFields(ctx.body); db.run('UPDATE exams SET title=?,test_id=?,course_id=?,instructions=?,duration_min=?,start_at=?,end_at=?,max_attempts=?,status=? WHERE id=?', o.title, o.test_id, o.course_id, o.instructions, o.duration_min, o.start_at, o.end_at, o.max_attempts, o.status, e.id); audit(ctx, 'exam_updated', e.title, o.status); return { ok: true }; });
  r.delete('/api/admin/exams/:id', A, ctx => { const e = must(db.get('SELECT * FROM exams WHERE id = ?', idp(ctx)), 'Exam'); db.run('DELETE FROM exams WHERE id = ?', e.id); audit(ctx, 'exam_deleted', e.title); return { ok: true }; });
  r.get('/api/admin/exams/:id/results', A, ctx => { const e = must(db.get('SELECT * FROM exams WHERE id = ?', idp(ctx)), 'Exam'); return { exam: e, results: db.all('SELECT r.score, r.total, r.pct, r.duration_sec, r.taken_at, s.name, s.student_code FROM results r JOIN students s ON s.id = r.student_id WHERE r.exam_id = ? ORDER BY r.taken_at DESC', e.id) }; });

  /* ---------- announcements ---------- */
  r.get('/api/admin/announcements', A, () => ({ announcements: db.all('SELECT * FROM announcements ORDER BY created_at DESC, id DESC') }));
  r.post('/api/admin/announcements', A, ctx => { const t = core.str(ctx.body.title, 'Title', { max: 160 }), b = core.str(ctx.body.body, 'Message', { max: 3000 }); const x = db.run('INSERT INTO announcements (title, body, created_by) VALUES (?,?,?)', t, b, ctx.user.email); audit(ctx, 'announcement_published', t); return { id: Number(x.lastInsertRowid) }; });
  r.patch('/api/admin/announcements/:id', A, ctx => { const a = must(db.get('SELECT * FROM announcements WHERE id = ?', idp(ctx)), 'Announcement'); db.run('UPDATE announcements SET title = ?, body = ?, updated_at = ? WHERE id = ?', core.str(ctx.body.title, 'Title', { max: 160 }), core.str(ctx.body.body, 'Message', { max: 3000 }), core.nowIso(), a.id); audit(ctx, 'announcement_edited', a.title); return { ok: true }; });
  r.delete('/api/admin/announcements/:id', A, ctx => { const a = must(db.get('SELECT * FROM announcements WHERE id = ?', idp(ctx)), 'Announcement'); db.run('DELETE FROM announcements WHERE id = ?', a.id); audit(ctx, 'announcement_deleted', a.title); return { ok: true }; });

  /* ---------- notifications (to all active students or a selection) ---------- */
  r.get('/api/admin/notifications', A, () => ({ notifications: db.all('SELECT n.*, (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id) AS recipients, (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id AND nr.read_at IS NOT NULL) AS read_count FROM notifications n ORDER BY n.created_at DESC, n.id DESC LIMIT 200') }));
  r.post('/api/admin/notifications', A, ctx => {
    const b = ctx.body, title = core.str(b.title, 'Title', { max: 160 }), body = core.str(b.body, 'Message', { max: 3000 });
    const audience = b.audience === 'selected' ? 'selected' : 'all'; let ids;
    if (audience === 'all') ids = db.all('SELECT id FROM students WHERE active = 1').map(x => x.id);
    else {
      if (!Array.isArray(b.student_ids) || !b.student_ids.length) throw bad('Choose at least one student.');
      if (b.student_ids.length > 500) throw bad('Too many recipients.');
      ids = [...new Set(b.student_ids.map(x => core.int(x, 'Student', { min: 1 })))].filter(id => db.get('SELECT 1 FROM students WHERE id = ?', id));
      if (!ids.length) throw bad('None of the chosen students exist.');
    }
    if (!ids.length) throw bad('There are no active students to notify yet.');
    const nid = db.tx(() => { const x = db.run('INSERT INTO notifications (title, body, audience, created_by) VALUES (?,?,?,?)', title, body, audience, ctx.user.email); ids.forEach(sid => db.run('INSERT INTO notification_recipients (notification_id, student_id) VALUES (?,?)', x.lastInsertRowid, sid)); return Number(x.lastInsertRowid); });
    audit(ctx, 'notification_sent', title, audience + ' → ' + ids.length + ' student(s)'); return { id: nid, recipients: ids.length };
  });
  r.delete('/api/admin/notifications/:id', A, ctx => { const n = must(db.get('SELECT * FROM notifications WHERE id = ?', idp(ctx)), 'Notification'); db.run('DELETE FROM notifications WHERE id = ?', n.id); audit(ctx, 'notification_deleted', n.title); return { ok: true }; });

  /* ---------- contact-form messages ---------- */
  r.get('/api/admin/messages', A, () => ({ messages: db.all('SELECT * FROM messages ORDER BY created_at DESC, id DESC LIMIT 300') }));
  r.post('/api/admin/messages/:id/read', A, ctx => { must(db.get('SELECT 1 AS x FROM messages WHERE id = ?', idp(ctx)), 'Message'); db.run('UPDATE messages SET read_at = COALESCE(read_at, ?) WHERE id = ?', core.nowIso(), idp(ctx)); return { ok: true }; });
  r.delete('/api/admin/messages/:id', A, ctx => { must(db.get('SELECT 1 AS x FROM messages WHERE id = ?', idp(ctx)), 'Message'); db.run('DELETE FROM messages WHERE id = ?', idp(ctx)); audit(ctx, 'message_deleted', String(idp(ctx))); return { ok: true }; });

  /* ---------- analytics, export ---------- */
  r.get('/api/admin/analytics', A, () => {
    const now = Date.now(), days = []; for (let i = 29; i >= 0; i--) days.push(core.dayStr(new Date(now - i * 86400e3)));
    const vd = Object.fromEntries(db.all('SELECT day, COUNT(*) AS v, SUM(views) AS p FROM visits WHERE day >= ? GROUP BY day', days[0]).map(x => [x.day, x]));
    const buckets = [0, 0, 0, 0, 0]; db.all('SELECT pct FROM results').forEach(x => buckets[Math.min(4, Math.floor(x.pct / 20))]++);
    return {
      days, visitors: days.map(d => vd[d] ? vd[d].v : 0), views: days.map(d => vd[d] ? vd[d].p : 0),
      score_buckets: ['0-19%', '20-39%', '40-59%', '60-79%', '80-100%'].map((l, i) => ({ label: l, n: buckets[i] })),
      top_exams: db.all('SELECT title, COUNT(*) AS attempts, ROUND(AVG(pct)) AS avg_pct FROM results GROUP BY title ORDER BY attempts DESC LIMIT 8'),
      top_students: db.all('SELECT s.name, s.student_code, COUNT(*) AS attempts, ROUND(AVG(r.pct)) AS avg_pct FROM results r JOIN students s ON s.id = r.student_id GROUP BY s.id ORDER BY avg_pct DESC, attempts DESC LIMIT 8'),
      unique_visitors_30d: db.get('SELECT COUNT(DISTINCT vid_hash) AS n FROM visits WHERE day >= ?', days[0]).n
    };
  });
  const csvCell = v => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  r.get('/api/admin/export/results.csv', A, ctx => {
    const rows = db.all('SELECT s.student_code, s.name, r.title, r.score, r.total, r.pct, r.duration_sec, r.taken_at FROM results r JOIN students s ON s.id = r.student_id ORDER BY r.taken_at DESC');
    audit(ctx, 'results_exported', null, rows.length + ' rows');
    const head = ['Student ID', 'Name', 'Exam', 'Score', 'Total', 'Percent', 'Seconds', 'Taken at'];
    return { __raw: true, body: [head, ...rows.map(x => [x.student_code, x.name, x.title, x.score, x.total, x.pct, x.duration_sec, x.taken_at])].map(l => l.map(csvCell).join(',')).join('\r\n'), headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="results.csv"' } };
  });

  /* ---------- settings + audit ---------- */
  const SETTING_KEYS = { site_name: { max: 80 }, support_email: { max: 160 }, active_timeout_min: { num: [1, 120] } };
  r.get('/api/admin/settings', A, () => ({ settings: { site_name: setting('site_name', 'ExamPro'), support_email: setting('support_email', ''), active_timeout_min: activeMin() } }));
  r.put('/api/admin/settings', A, ctx => {
    const b = ctx.body, changed = [];
    if (b.site_name !== undefined) { db.run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'site_name', core.str(b.site_name, 'Site name', { max: 80 })); changed.push('site_name'); }
    if (b.support_email !== undefined) { const v = b.support_email ? core.email(b.support_email, 'Support email') : ''; db.run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'support_email', v); changed.push('support_email'); }
    if (b.active_timeout_min !== undefined) { db.run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'active_timeout_min', String(core.int(b.active_timeout_min, 'Active timeout', { min: 1, max: 120 }))); changed.push('active_timeout_min'); }
    audit(ctx, 'settings_updated', null, changed.join(', ')); return { ok: true };
  });
  r.get('/api/admin/audit', A, () => ({ log: db.all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300') }));
};
