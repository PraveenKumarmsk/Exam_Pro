'use strict';
const core = require('./core');

function examState(e, now = Date.now()) {
  const s = e.start_at ? Date.parse(e.start_at) : null, en = e.end_at ? Date.parse(e.end_at) : null;
  if (e.status !== 'published') return 'draft';
  if (s && now < s) return 'upcoming';
  if (en && now > en) return 'closed';
  return 'open';
}
/* published exams a student may see: open to everyone (no course) or in a course they are actively enrolled in */
function visibleExams(db, studentId) {
  return db.all(`SELECT e.*, c.name AS course_name,
      (SELECT COUNT(*) FROM results r WHERE r.exam_id = e.id AND r.student_id = ?) AS attempts_used
    FROM exams e LEFT JOIN courses c ON c.id = e.course_id
    WHERE e.status = 'published' AND (e.course_id IS NULL OR e.course_id IN (SELECT course_id FROM enrollments WHERE student_id = ? AND status = 'active'))
    ORDER BY COALESCE(e.start_at, e.created_at) DESC`, studentId, studentId)
    .map(e => { const state = examState(e); const left = Math.max(0, e.max_attempts - e.attempts_used); return Object.assign(e, { state, attempts_left: left, can_start: state === 'open' && left > 0 }); });
}
function audit(ctx, action, target, detail) {
  ctx.db.run('INSERT INTO audit_log (admin_id, admin_email, action, target, detail, ip) VALUES (?,?,?,?,?,?)', ctx.user ? ctx.user.id : null, ctx.user ? ctx.user.email : null, action, target || null, detail ? String(detail).slice(0, 500) : null, ctx.ip);
}
function publicStudent(s) { return { id: s.id, student_code: s.student_code, name: s.name, email: s.email, phone: s.phone, photo_url: s.photo_url, active: !!s.active, is_demo: !!s.is_demo, created_at: s.created_at, last_login_at: s.last_login_at }; }
function nextStudentCode(db) {
  let n = (db.get('SELECT COALESCE(MAX(id),0) AS m FROM students').m || 0) + 1, code;
  do { code = 'STU' + String(n++).padStart(4, '0'); } while (db.get('SELECT 1 FROM students WHERE student_code = ?', code));
  return code;
}
module.exports = { examState, visibleExams, audit, publicStudent, nextStudentCode };
