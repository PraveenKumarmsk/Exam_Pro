'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../server/db'), { createApp } = require('../server/app'), seed = require('../server/seed');

let db, server, base;
class Client {
  constructor() { this.jar = {}; this.csrf = {}; }
  async req(method, path, body, { role, headers = {}, raw } = {}) {
    const h = Object.assign({ Cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ') }, headers);
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (role && this.csrf[role]) h['X-CSRF-Token'] = this.csrf[role];
    const r = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    (r.headers.getSetCookie() || []).forEach(c => { const [kv] = c.split(';'); const i = kv.indexOf('='); const v = kv.slice(i + 1); if (/Max-Age=0/i.test(c)) delete this.jar[kv.slice(0, i)]; else this.jar[kv.slice(0, i)] = v; });
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { status: r.status, json, text, headers: r.headers };
  }
  async login(role, creds) { const r = await this.req('POST', `/api/${role}/login`, creds); if (r.status === 200) this.csrf[role] = r.json.csrf; return r; }
}
const stu = (c, id = 'DEMO001') => c.login('student', { identifier: id, password: 'Demo@12345' });
const adm = c => c.login('admin', { email: 'admin@exampro.local', password: 'Admin@12345' });

before(async () => {
  db = open(':memory:'); seed.seedAdmin(db, () => {}); seed.seedDemo(db, () => {});
  server = createApp({ db, quiet: true }); await new Promise(r => server.listen(0, r)); base = 'http://127.0.0.1:' + server.address().port;
});
after(() => { server.close(); db.close(); });

test('static: main page loads, server files are not exposed', async () => {
  const c = new Client();
  assert.equal((await c.req('GET', '/')).status, 200);
  for (const p of ['/server/config.js', '/server/seed.js', '/data/.secret', '/package.json', '/.env', '/test/api.test.js', '/%2e%2e/etc/passwd', '/..%2fserver/db.js'])
    assert.equal((await c.req('GET', p)).status, 404, p);
});
test('student login: all three demo accounts, wrong password rejected', async () => {
  for (const id of ['DEMO001', 'DEMO002', 'DEMO003']) { const c = new Client(); const r = await stu(c, id); assert.equal(r.status, 200); assert.equal(r.json.student.student_code, id); assert.ok(!('pass_hash' in r.json.student)); }
  const c = new Client(); assert.equal((await c.login('student', { identifier: 'DEMO001', password: 'nope' })).status, 401);
  assert.equal((await c.login('student', { identifier: 'nobody', password: 'x' })).status, 401);
});
test('student data isolation: each student sees only their own data', async () => {
  const a = new Client(), b = new Client(); await stu(a, 'DEMO001'); await stu(b, 'DEMO002');
  const da = (await a.req('GET', '/api/student/dashboard')).json, db2 = (await b.req('GET', '/api/student/dashboard')).json;
  assert.equal(da.student.name, 'Rahul Kumar'); assert.equal(db2.student.name, 'Priya Singh');
  assert.deepEqual(da.enrollments.map(e => e.course), ['CCNA Basics']); assert.deepEqual(db2.enrollments.map(e => e.course), ['Computer Fundamentals']);
  assert.ok(!JSON.stringify(da).includes('demo002') && !JSON.stringify(da).includes('Priya'));
  /* notification addressed only to DEMO001 */
  const nb = (await b.req('GET', '/api/student/notifications')).json.notifications;
  assert.ok(!nb.some(n => n.title.includes('Module 1')));
  const targetId = (await a.req('GET', '/api/student/notifications')).json.notifications.find(n => n.title.includes('Module 1')).id;
  assert.equal((await b.req('POST', `/api/student/notifications/${targetId}/read`, {}, { role: 'student' })).status, 404);
  /* a student id in the URL/body is ignored: results always go to the session student */
  assert.equal((await b.req('GET', '/api/student/results?student_id=1')).json.results.every(r => r.title.includes('Computer')), true);
  /* course-restricted exam is hidden from a student who is not enrolled */
  const exams = (await b.req('GET', '/api/student/exams')).json.exams;
  assert.ok(!exams.some(e => e.title.includes('CCNA')));
});
test('students cannot reach admin APIs or admin pages', async () => {
  const c = new Client(); await stu(c);
  for (const [m, p] of [['GET', '/api/admin/metrics'], ['GET', '/api/admin/students'], ['GET', '/api/admin/audit'], ['POST', '/api/admin/students'], ['GET', '/api/admin/export/results.csv']]) {
    const r = await c.req(m, p, m === 'POST' ? {} : undefined, { role: 'student' }); assert.equal(r.status, 401, p);
  }
  assert.equal((await c.req('GET', '/admin/dashboard')).status, 302);
  c.jar.ep_a = c.jar.ep_s; assert.equal((await c.req('GET', '/api/admin/metrics')).status, 401); /* student session token is useless as admin cookie */
});
test('unauthenticated requests are rejected', async () => {
  const c = new Client();
  assert.equal((await c.req('GET', '/api/student/dashboard')).status, 401);
  assert.equal((await c.req('GET', '/api/admin/metrics')).status, 401);
  assert.equal((await c.req('GET', '/student/dashboard')).status, 302);
});
test('admin login/logout, separate session from student, wrong password', async () => {
  const c = new Client(); assert.equal((await c.login('admin', { email: 'admin@exampro.local', password: 'bad' })).status, 401);
  assert.equal((await adm(c)).status, 200); assert.equal((await c.req('GET', '/api/admin/me')).json.admin.email, 'admin@exampro.local');
  assert.equal((await c.req('GET', '/api/student/me')).status, 401); /* admin session is not a student session */
  assert.equal((await c.req('POST', '/api/admin/logout', {}, { role: 'admin' })).status, 204);
  assert.equal((await c.req('GET', '/api/admin/me')).status, 401);
});
test('CSRF: state-changing calls need the token and a same-origin request', async () => {
  const c = new Client(); await adm(c);
  assert.equal((await c.req('POST', '/api/admin/announcements', { title: 'x', body: 'y' })).status, 403);
  assert.equal((await c.req('POST', '/api/admin/announcements', { title: 'x', body: 'y' }, { role: 'admin', headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await c.req('POST', '/api/admin/announcements', { title: 'ok', body: 'ok' }, { role: 'admin' })).status, 200);
});
test('dashboard metrics come from the database', async () => {
  db.run('DELETE FROM sessions'); const c = new Client(); await adm(c);
  let m = (await c.req('GET', '/api/admin/metrics')).json;
  assert.equal(m.students.registered, 3); assert.equal(m.students.enrolled, 3); assert.equal(m.students.demo, 3);
  assert.equal(m.exams.total, 4); assert.equal(m.exams.completed, 1); assert.equal(m.exams.upcoming, 1);
  const v = new Client(); await v.req('POST', '/api/visit', {}); await v.req('POST', '/api/visit', {}); /* same visitor twice */
  const v2 = new Client(); await v2.req('POST', '/api/visit', {});
  m = (await c.req('GET', '/api/admin/metrics')).json;
  assert.equal(m.visitors.total, 2, 'duplicate visits by one browser count once'); assert.equal(m.visitors.page_views_today, 3); assert.equal(m.active.users, 2);
  const s = new Client(); await stu(s, 'DEMO003');
  assert.equal((await c.req('GET', '/api/admin/metrics')).json.active.students, 1);
  /* creating a student changes the numbers */
  const r = await c.req('POST', '/api/admin/students', { name: 'Test Student', email: 'test.student@example.com', password: 'Passw0rdOK' }, { role: 'admin' }); assert.equal(r.status, 200);
  assert.equal((await c.req('GET', '/api/admin/metrics')).json.students.registered, 4);
  assert.equal((await c.req('POST', '/api/admin/students', { name: 'Dup', email: 'test.student@example.com', password: 'Passw0rdOK' }, { role: 'admin' })).status, 409);
  assert.equal((await c.req('POST', '/api/admin/students', { name: 'Weak', email: 'weak@example.com', password: 'short' }, { role: 'admin' })).status, 400);
});
test('deactivated student cannot sign in and loses sessions', async () => {
  const a = new Client(); await adm(a); const s = new Client(); await stu(s, 'DEMO002');
  const id = (await a.req('GET', '/api/admin/students?q=DEMO002')).json.students[0].id;
  assert.equal((await a.req('PATCH', `/api/admin/students/${id}`, { name: 'Priya Singh', email: 'demo002@example.com', active: false }, { role: 'admin' })).status, 200);
  assert.equal((await s.req('GET', '/api/student/me')).status, 401);
  assert.equal((await stu(new Client(), 'DEMO002')).status, 403);
  await a.req('PATCH', `/api/admin/students/${id}`, { name: 'Priya Singh', email: 'demo002@example.com', active: true }, { role: 'admin' });
  assert.equal((await stu(new Client(), 'DEMO002')).status, 200);
});
test('notifications: admin sends to selected students, only they see it, read tracking works', async () => {
  const a = new Client(); await adm(a); const s1 = new Client(), s3 = new Client(); await stu(s1, 'DEMO001'); await stu(s3, 'DEMO003');
  const id1 = (await a.req('GET', '/api/admin/students?q=DEMO001')).json.students[0].id;
  const r = await a.req('POST', '/api/admin/notifications', { title: 'Hello selected', body: 'Only for one', audience: 'selected', student_ids: [id1] }, { role: 'admin' });
  assert.equal(r.json.recipients, 1);
  const n1 = (await s1.req('GET', '/api/student/notifications')).json, n3 = (await s3.req('GET', '/api/student/notifications')).json;
  const mine = n1.notifications.find(n => n.title === 'Hello selected'); assert.ok(mine && !mine.read_at); assert.ok(!n3.notifications.some(n => n.title === 'Hello selected'));
  const before = n1.unread; await s1.req('POST', `/api/student/notifications/${mine.id}/read`, {}, { role: 'student' });
  assert.equal((await s1.req('GET', '/api/student/notifications')).json.unread, before - 1);
  const hist = (await a.req('GET', '/api/admin/notifications')).json.notifications.find(n => n.title === 'Hello selected'); assert.equal(hist.read_count, 1);
  const all = await a.req('POST', '/api/admin/notifications', { title: 'To all', body: 'Everyone', audience: 'all' }, { role: 'admin' }); assert.ok(all.json.recipients >= 3);
  assert.equal((await a.req('POST', '/api/admin/notifications', { title: 'x', body: 'y', audience: 'selected', student_ids: [] }, { role: 'admin' })).status, 400);
});
test('exams: eligibility, attempts limit, results recorded for the session student', async () => {
  const s = new Client(); await stu(s, 'DEMO001'); const exams = (await s.req('GET', '/api/student/exams')).json.exams;
  const ccna = exams.find(e => e.title.includes('CCNA')), upcoming = exams.find(e => e.title.includes('Networking')), open = exams.find(e => e.title.includes('Open Practice'));
  assert.ok(ccna && ccna.can_start && !upcoming); /* upcoming exam belongs to another course */
  assert.equal((await s.req('GET', `/exam/${ccna.id}`)).status, 302); assert.match((await s.req('GET', `/exam/${ccna.id}`)).headers.get('location'), /test-attempt\.html\?id=2&exam=/);
  assert.equal((await s.req('POST', '/api/student/results', { exam_id: ccna.id, score: 7, total: 10 }, { role: 'student' })).status, 200);
  assert.equal((await s.req('POST', '/api/student/results', { exam_id: ccna.id, score: 9, total: 10 }, { role: 'student' })).status, 409, 'max attempts');
  assert.equal((await s.req('GET', `/exam/${ccna.id}`)).status, 403);
  assert.equal((await s.req('POST', '/api/student/results', { exam_id: open.id, score: 11, total: 10 }, { role: 'student' })).status, 400);
  const s2 = new Client(); await stu(s2, 'DEMO002'); assert.equal((await s2.req('POST', '/api/student/results', { exam_id: ccna.id, score: 5, total: 10 }, { role: 'student' })).status, 403);
  assert.equal((await new Client().req('GET', `/exam/${ccna.id}`)).status, 302);
  const dash = (await s.req('GET', '/api/student/dashboard')).json; assert.equal(dash.stats.attempts, 1); assert.equal(dash.results[0].pct, 70);
});
test('rate limiting: repeated failed logins get locked out', async () => {
  const c = new Client(); let last;
  for (let i = 0; i < 7; i++) last = await c.login('student', { identifier: 'lockme@example.com', password: 'wrong' + i });
  assert.equal(last.status, 429);
  const ok = new Client(); for (let i = 0; i < 5; i++) await ok.login('admin', { email: 'victim@example.com', password: 'x' });
  assert.equal((await ok.login('admin', { email: 'victim@example.com', password: 'x' })).status, 429);
});
test('contact form stores a message for the admin; XSS text is stored inert', async () => {
  const c = new Client(); assert.equal((await c.req('POST', '/api/contact', { name: 'Anon', email: 'a@b.co', topic: 'General', msg: '<script>alert(1)</script> hello there' })).status, 200);
  const a = new Client(); await adm(a); const m = (await a.req('GET', '/api/admin/messages')).json.messages[0]; assert.ok(m.body.includes('<script>')); /* raw in DB; UI escapes on output */
  assert.ok((await a.req('GET', '/api/admin/metrics')).json.notifications.unread_messages >= 1);
});
test('audit log records admin actions; CSV export neutralises formulas', async () => {
  const a = new Client(); await adm(a);
  await a.req('POST', '/api/admin/announcements', { title: '=HYPERLINK("x")', body: 'b' }, { role: 'admin' });
  const log = (await a.req('GET', '/api/admin/audit')).json.log; assert.ok(log.some(l => l.action === 'announcement_published') && log.some(l => l.action === 'login'));
  const csv = (await a.req('GET', '/api/admin/export/results.csv')).text; assert.match(csv, /^"Student ID"/); assert.ok(!/(^|,)"=/.test(csv));
});
test('password change signs out other sessions and enforces policy', async () => {
  const a = new Client(), b = new Client(); await stu(a, 'DEMO003'); await stu(b, 'DEMO003');
  assert.equal((await a.req('POST', '/api/student/password', { current: 'Demo@12345', next: 'weak' }, { role: 'student' })).status, 400);
  assert.equal((await a.req('POST', '/api/student/password', { current: 'wrong', next: 'NewPass123' }, { role: 'student' })).status, 403);
  assert.equal((await a.req('POST', '/api/student/password', { current: 'Demo@12345', next: 'NewPass123' }, { role: 'student' })).status, 200);
  assert.equal((await b.req('GET', '/api/student/me')).status, 401); assert.equal((await a.req('GET', '/api/student/me')).status, 200);
  await a.req('POST', '/api/student/password', { current: 'NewPass123', next: 'Demo@12345' }, { role: 'student' });
});
test('SQL injection strings are treated as data', async () => {
  const a = new Client(); await adm(a);
  assert.equal((await a.req('GET', "/api/admin/students?q=" + encodeURIComponent("' OR 1=1 --"))).json.students.length, 0);
  assert.equal((await stu(new Client(), "x' OR '1'='1")).status, 401);
});
test('demo password hashes are not plaintext', () => {
  const rows = db.all('SELECT pass_hash FROM students UNION SELECT pass_hash FROM admins'); assert.ok(rows.every(r => r.pass_hash.startsWith('scrypt$') && !r.pass_hash.includes('Demo@')));
});
