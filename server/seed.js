'use strict';
/* Seed / reset / purge. Development only by default.
     npm run seed          create dev admin + 3 demo students (skips what exists)
     npm run reset-demo    delete demo data, then create it again
     npm run purge-demo    delete all demo data
   Production: refuses demo data; creates an admin only from ADMIN_EMAIL + ADMIN_PASSWORD env vars. */
const core = require('./core'), cfg = require('./config'), { open } = require('./db');

const DEV_ADMIN = { email: 'admin@exampro.local', password: 'Admin@12345', name: 'Dev Admin' };
const DEMO_PASSWORD = 'Demo@12345';
const DEMO = [
  { code: 'DEMO001', name: 'Rahul Kumar', email: 'demo001@example.com', course: 'CCNA', phone: '9000000001' },
  { code: 'DEMO002', name: 'Priya Singh', email: 'demo002@example.com', course: 'COMP-FUND', phone: '9000000002' },
  { code: 'DEMO003', name: 'Amit Sharma', email: 'demo003@example.com', course: 'NET-ESS', phone: '9000000003' }
];
const COURSES = [
  { code: 'CCNA', name: 'CCNA Basics', description: 'Networking fundamentals for the CCNA exam.' },
  { code: 'COMP-FUND', name: 'Computer Fundamentals', description: 'Hardware, software and everyday computing.' },
  { code: 'NET-ESS', name: 'Networking Essentials', description: 'IP addressing, switching and routing basics.' }
];
const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400e3).toISOString().replace(/\.\d+Z$/, 'Z');

function purgeDemo(db) {
  db.tx(() => {
    db.run('DELETE FROM students WHERE is_demo = 1');
    db.run("DELETE FROM exams WHERE title LIKE '[Demo]%'");
    db.run("DELETE FROM notifications WHERE title LIKE '[Demo]%'");
    db.run("DELETE FROM announcements WHERE title LIKE '[Demo]%'");
    db.run("DELETE FROM courses WHERE code IN ('CCNA','COMP-FUND','NET-ESS') AND id NOT IN (SELECT course_id FROM enrollments)");
  });
}
function seedAdmin(db, log) {
  const production = cfg.production;
  let a = DEV_ADMIN;
  if (production) {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) { log('Production: set ADMIN_EMAIL and ADMIN_PASSWORD to create the first admin. Skipped.'); return; }
    core.checkPasswordPolicy(process.env.ADMIN_PASSWORD);
    a = { email: process.env.ADMIN_EMAIL.toLowerCase(), password: process.env.ADMIN_PASSWORD, name: 'Administrator' };
  }
  if (db.get('SELECT 1 FROM admins WHERE lower(email) = ?', a.email)) { log('Admin already exists: ' + a.email); return; }
  db.run('INSERT INTO admins (email, name, pass_hash) VALUES (?,?,?)', a.email, a.name, core.hashPassword(a.password));
  log(production ? 'Admin created: ' + a.email : `Dev admin created: ${a.email} / ${a.password}  (development only)`);
}
function seedDemo(db, log) {
  if (cfg.production && !process.argv.includes('--allow-demo-in-production')) { log('Production: demo data skipped (pass --allow-demo-in-production to force).'); return; }
  db.tx(() => {
    const cid = {};
    COURSES.forEach(c => { let row = db.get('SELECT id FROM courses WHERE code = ?', c.code); if (!row) row = { id: Number(db.run('INSERT INTO courses (code, name, description) VALUES (?,?,?)', c.code, c.name, c.description).lastInsertRowid) }; cid[c.code] = row.id; });
    const bid = {};
    Object.keys(cid).forEach(code => { let b = db.get('SELECT id FROM batches WHERE course_id = ? AND name = ?', cid[code], 'Batch A'); if (!b) b = { id: Number(db.run('INSERT INTO batches (course_id, name, start_date) VALUES (?,?,?)', cid[code], 'Batch A', iso(-14).slice(0, 10)).lastInsertRowid) }; bid[code] = b.id; });
    const sid = {};
    DEMO.forEach(d => {
      let s = db.get('SELECT id FROM students WHERE student_code = ?', d.code);
      if (!s) s = { id: Number(db.run('INSERT INTO students (student_code, name, email, pass_hash, phone, is_demo) VALUES (?,?,?,?,?,1)', d.code, d.name, d.email, core.hashPassword(DEMO_PASSWORD), d.phone).lastInsertRowid) };
      sid[d.code] = s.id;
      if (!db.get('SELECT 1 FROM enrollments WHERE student_id = ? AND course_id = ?', s.id, cid[d.course])) db.run("INSERT INTO enrollments (student_id, course_id, batch_id, status) VALUES (?,?,?, 'active')", s.id, cid[d.course], bid[d.course]);
    });
    if (!db.get("SELECT 1 FROM exams WHERE title LIKE '[Demo]%'")) {
      db.run("INSERT INTO exams (title, test_id, course_id, instructions, duration_min, start_at, end_at, max_attempts, status) VALUES ('[Demo] CCNA Basics — Module 1 Test', 2, ?, 'Read each question carefully. One attempt only.', 20, ?, ?, 1, 'published')", cid.CCNA, iso(-1), iso(30));
      db.run("INSERT INTO exams (title, test_id, course_id, instructions, duration_min, start_at, end_at, max_attempts, status) VALUES ('[Demo] Open Practice Mock', 1, NULL, 'Open to every student. Two attempts allowed.', 45, ?, ?, 2, 'published')", iso(-2), iso(60));
      db.run("INSERT INTO exams (title, test_id, course_id, instructions, duration_min, start_at, end_at, max_attempts, status) VALUES ('[Demo] Networking Essentials — Mid Test', 2, ?, 'Scheduled test for the Networking Essentials batch.', 20, ?, ?, 1, 'published')", cid['NET-ESS'], iso(7), iso(8));
      const old = db.run("INSERT INTO exams (title, test_id, course_id, instructions, duration_min, start_at, end_at, max_attempts, status) VALUES ('[Demo] Computer Fundamentals — Quiz 1', 2, ?, 'Closed demo exam with sample results.', 20, ?, ?, 1, 'published')", cid['COMP-FUND'], iso(-20), iso(-10)).lastInsertRowid;
      db.run("INSERT INTO results (student_id, exam_id, title, score, total, pct, duration_sec, taken_at) VALUES (?,?,?,?,?,?,?,?)", sid.DEMO002, old, '[Demo] Computer Fundamentals — Quiz 1', 17, 20, 85, 780, iso(-15));
    }
    if (!db.get("SELECT 1 FROM notifications WHERE title LIKE '[Demo]%'")) {
      const mk = (title, body, aud, ids) => { const n = Number(db.run('INSERT INTO notifications (title, body, audience, created_by) VALUES (?,?,?,?)', title, body, aud, 'seed').lastInsertRowid); ids.forEach(i => db.run('INSERT INTO notification_recipients (notification_id, student_id) VALUES (?,?)', n, i)); };
      mk('[Demo] Welcome to ExamPro', 'This is a demo account created for testing the student portal.', 'all', Object.values(sid));
      mk('[Demo] CCNA Basics — Module 1 is open', 'Your Module 1 test is now open. You have one attempt.', 'selected', [sid.DEMO001]);
      mk('[Demo] Networking Essentials mid test next week', 'Check the Exams page for the date and instructions.', 'selected', [sid.DEMO003]);
    }
    if (!db.get("SELECT 1 FROM announcements WHERE title LIKE '[Demo]%'")) db.run('INSERT INTO announcements (title, body, created_by) VALUES (?,?,?)', '[Demo] Portal is live', 'This announcement is visible to every student. Demo data can be removed with: npm run purge-demo', 'seed');
  });
  log(`Demo students ready (password for all: ${DEMO_PASSWORD}): ` + DEMO.map(d => d.code).join(', '));
}

module.exports = { seedAdmin, seedDemo, purgeDemo, DEV_ADMIN, DEMO_PASSWORD, DEMO };

if (require.main === module) {
  const db = open(cfg.dbPath), log = m => console.log('[seed] ' + m);
  if (process.argv.includes('--purge')) { purgeDemo(db); log('Demo data removed.'); }
  else { if (process.argv.includes('--reset')) { purgeDemo(db); log('Demo data removed.'); } seedAdmin(db, log); seedDemo(db, log); }
  db.close();
}
