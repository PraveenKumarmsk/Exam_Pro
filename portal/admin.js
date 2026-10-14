(function () {
  const { $, esc, api, fmt, fmtDay, modal, confirm: ask, toast } = Portal, view = $('#view');
  Portal.onUnauthorized = () => { location.href = '/admin/login'; };
  let tab = {}; /* remembered sub-tab per view */
  const fld = (label, id, val, o = {}) => `<div class="${o.full ? 'full' : ''}"><label for="${id}">${esc(label)}</label>${o.area ? `<textarea id="${id}" ${o.max ? `maxlength="${o.max}"` : ''}>${esc(val || '')}</textarea>` : `<input id="${id}" type="${o.type || 'text'}" value="${esc(val === null || val === undefined ? '' : val)}" ${o.max ? `maxlength="${o.max}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.req ? 'required' : ''} ${o.dis ? 'disabled' : ''} ${o.type === 'password' ? 'autocomplete="new-password"' : ''}>`}</div>`;
  const sel = (label, id, opts, val, o = {}) => `<div class="${o.full ? 'full' : ''}"><label for="${id}">${esc(label)}</label><select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
  const val = (ov, id) => $('#' + id, ov).value.trim();
  const toLocal = iso => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const fromLocal = s => s ? new Date(s).toISOString() : null;
  const kpi = (n, l, sub) => `<div class="kpi"><b>${esc(n)}</b><span>${esc(l)}</span>${sub ? `<i>${esc(sub)}</i>` : ''}</div>`;
  const tabs = (name, list) => `<div class="tabs" role="tablist">${list.map(([k, t]) => `<button type="button" role="tab" data-tab="${k}" class="${(tab[name] || list[0][0]) === k ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>`;
  const wireTabs = (name, again) => view.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab[name] = b.dataset.tab; again(); }));

  const views = {
    async dashboard() {
      const m = await api('GET', '/api/admin/metrics'); setBadge(m.notifications.unread_messages);
      view.innerHTML = `<div class="row between"><h1>Dashboard</h1><button class="btn ghost sm" id="rf" type="button">↻ Refresh</button></div>
        ${m.students.demo ? `<div class="note">Numbers include <b>${m.students.demo} demo student account(s)</b> and their sample data. Remove them with <code>npm run purge-demo</code>.</div>` : ''}
        <h2 style="font-size:.9rem;margin:6px 0 8px" class="muted">Students</h2>
        <div class="kpis">${kpi(m.students.registered, 'Registered students', m.students.active_accounts + ' active accounts')}${kpi(m.students.enrolled, 'Enrolled students', 'with an active enrollment')}${kpi(m.active.students, 'Active students now', 'seen in last ' + m.active_timeout_min + ' min')}${kpi(m.active.users, 'Active users now', 'visitors seen in last ' + m.active_timeout_min + ' min')}</div>
        <h2 style="font-size:.9rem;margin:6px 0 8px" class="muted">Visitors</h2>
        <div class="kpis">${kpi(m.visitors.total, 'Total visitors', 'unique browsers')}${kpi(m.visitors.today, 'Visitors today')}${kpi(m.visitors.page_views_today, 'Page views today')}</div>
        <h2 style="font-size:.9rem;margin:6px 0 8px" class="muted">Examinations</h2>
        <div class="kpis">${kpi(m.exams.total, 'Total examinations', m.exams.draft + ' draft')}${kpi(m.exams.completed, 'Completed', 'window ended')}${kpi(m.exams.upcoming, 'Upcoming')}${kpi(m.exams.open, 'Open now')}${kpi(m.exams.attempts, 'Attempts submitted', m.exams.avg_pct === null ? 'no results yet' : 'avg ' + m.exams.avg_pct + '%')}</div>
        <h2 style="font-size:.9rem;margin:6px 0 8px" class="muted">Notifications</h2>
        <div class="kpis">${kpi(m.notifications.total, 'Notifications sent')}${kpi(m.notifications.announcements, 'Announcements')}${kpi(m.notifications.unread_messages, 'Unread messages', 'of ' + m.notifications.total_messages)}</div>
        <div class="grid g2"><section class="card"><h2>Visitors — last 14 days</h2>${Portal.chart(m.series.days, m.series.visitors)}</section>
        <section class="card"><h2>Exam attempts — last 14 days</h2>${Portal.chart(m.series.days, m.series.attempts)}</section>
        <section class="card"><h2>Active enrollments by course</h2>${Portal.bars(m.by_course.map(c => [c.name, c.n]), 'No courses yet.')}</section>
        <section class="card"><h2>Recent results</h2>${m.recent_results.length ? `<div class="scroll"><table><tr><th>Student</th><th>Exam</th><th>Score</th></tr>${m.recent_results.map(r => `<tr><td>${esc(r.name)}<div class="small muted">${esc(r.student_code)}</div></td><td>${esc(r.title)}</td><td>${r.score}/${r.total} (${r.pct}%)</td></tr>`).join('')}</table></div>` : '<p class="empty">No exam results yet.</p>'}</section></div>
        <p class="small muted">Visitors are counted once per browser per day using a random first-party cookie (no IP address stored). "Active" = last activity within ${m.active_timeout_min} min. Updated ${fmt(m.generated_at)}.</p>`;
      $('#rf').addEventListener('click', route);
    },

    async students() {
      const q = view._q || '', st = view._st || '';
      const [d, c] = await Promise.all([api('GET', `/api/admin/students?q=${encodeURIComponent(q)}&status=${st}`), api('GET', '/api/admin/courses')]);
      view.innerHTML = `<div class="row between"><h1>Students</h1><button class="btn" id="add" type="button">+ New student</button></div>
        <div class="row" style="margin-bottom:12px"><input id="q" type="search" placeholder="Search name, email or ID…" value="${esc(q)}" style="max-width:300px" aria-label="Search students"><select id="st" style="max-width:160px" aria-label="Status"><option value="">All</option><option value="active" ${st === 'active' ? 'selected' : ''}>Active</option><option value="inactive" ${st === 'inactive' ? 'selected' : ''}>Deactivated</option></select></div>
        <section class="card"><div class="scroll">${d.students.length ? `<table><tr><th>Student</th><th>Course(s)</th><th>Attempts</th><th>Status</th><th>Last login</th><th></th></tr>${d.students.map(s => `<tr><td><b>${esc(s.name)}</b>${s.is_demo ? ' <span class="badge warn">demo</span>' : ''}<div class="small muted">${esc(s.student_code)} · ${esc(s.email)}</div></td><td>${esc(s.courses || '—')}</td><td>${s.attempts}</td><td><span class="badge ${s.active ? 'ok' : 'bad'}">${s.active ? 'Active' : 'Deactivated'}</span></td><td class="small">${fmt(s.last_login_at)}</td>
          <td class="right" style="white-space:nowrap"><button class="btn ghost sm" data-view="${s.id}" type="button">View</button> <button class="btn ghost sm" data-edit="${s.id}" type="button">Edit</button> <button class="btn ghost sm" data-pw="${s.id}" type="button">Reset pw</button> <button class="btn ghost sm" data-tog="${s.id}" data-on="${s.active ? 1 : 0}" type="button">${s.active ? 'Deactivate' : 'Activate'}</button></td></tr>`).join('')}</table>` : '<p class="empty">No students match. Create one with “New student”.</p>'}</div></section>`;
      let t; $('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { view._q = e.target.value; route(); }, 350); });
      $('#st').addEventListener('change', e => { view._st = e.target.value; route(); });
      const byId = id => d.students.find(s => s.id === +id);
      const form = (s) => `<form class="form" onsubmit="return false">${fld('Full name', 'f-name', s && s.name, { req: 1, max: 100 })}${fld('Email', 'f-email', s && s.email, { type: 'email', req: 1 })}${fld('Student ID (optional, auto if blank)', 'f-code', s && s.student_code, { max: 30 })}${fld('Phone', 'f-phone', s && s.phone, { max: 20 })}${fld('Photo (images/… path or https link)', 'f-photo', s && s.photo_url, { full: 1 })}
        ${s ? '' : fld('Initial password', 'f-pass', '', { type: 'password', full: 1, ph: 'min 8 chars, letter + number' }) + sel('Enroll in course', 'f-course', [['', '— none —'], ...c.courses.filter(x => x.active).map(x => [x.id, x.name])], '', { full: 1 })}<div class="err full"></div></form>`;
      $('#add').addEventListener('click', () => modal('New student', form(null), [{ label: 'Cancel', ghost: true }, { label: 'Create', fn: async ov => { await api('POST', '/api/admin/students', { name: val(ov, 'f-name'), email: val(ov, 'f-email'), student_code: val(ov, 'f-code'), phone: val(ov, 'f-phone'), photo_url: val(ov, 'f-photo'), password: $('#f-pass', ov).value, course_id: val(ov, 'f-course') || undefined }); toast('Student created'); route(); } }]));
      view.onclick = async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.edit) { const s = byId(b.dataset.edit); modal('Edit student', form(s), [{ label: 'Cancel', ghost: true }, { label: 'Save', fn: async ov => { await api('PATCH', `/api/admin/students/${s.id}`, { name: val(ov, 'f-name'), email: val(ov, 'f-email'), student_code: val(ov, 'f-code'), phone: val(ov, 'f-phone'), photo_url: val(ov, 'f-photo') }); toast('Saved'); route(); } }]); }
        if (b.dataset.pw) { const s = byId(b.dataset.pw); modal('Reset password — ' + s.name, `<form class="form" onsubmit="return false">${fld('New password', 'f-pw', '', { type: 'password', full: 1 })}<div class="err full"></div></form><p class="small muted">The student is signed out everywhere.</p>`, [{ label: 'Cancel', ghost: true }, { label: 'Reset', fn: async ov => { await api('POST', `/api/admin/students/${s.id}/password`, { password: $('#f-pw', ov).value }); toast('Password reset'); } }]); }
        if (b.dataset.tog) { const s = byId(b.dataset.tog), on = b.dataset.on === '1'; if (await ask(`${on ? 'Deactivate' : 'Activate'} ${s.name}?${on ? ' They will be signed out and unable to log in.' : ''}`, on ? 'Deactivate' : 'Activate', on)) { await api('PATCH', `/api/admin/students/${s.id}`, { name: s.name, email: s.email, active: !on }).catch(x => toast(x.message, 1)); route(); } }
        if (b.dataset.view) { const x = await api('GET', `/api/admin/students/${b.dataset.view}`), s = x.student; modal(s.name, `<p class="small muted">${esc(s.student_code)} · ${esc(s.email)} · ${esc(s.phone || 'no phone')}<br>Joined ${fmtDay(s.created_at)} · Last login ${fmt(s.last_login_at)} · ${x.unread} unread notification(s)</p>
          <h4 style="margin:12px 0 4px">Enrollments</h4>${x.enrollments.map(e => `<div class="small">${esc(e.course)} — ${esc(e.status)}${e.batch ? ' · ' + esc(e.batch) : ''}</div>`).join('') || '<p class="small muted">None</p>'}
          <h4 style="margin:12px 0 4px">Recent results</h4>${x.results.map(r => `<div class="small">${esc(r.title)} — ${r.score}/${r.total} (${r.pct}%) · ${fmtDay(r.taken_at)}</div>`).join('') || '<p class="small muted">None</p>'}`); }
      };
    },

    async courses() {
      const [d, st] = await Promise.all([api('GET', '/api/admin/courses'), api('GET', '/api/admin/students')]);
      view.innerHTML = `<div class="row between"><h1>Courses, batches &amp; enrollments</h1><div class="row"><button class="btn ghost" id="addb" type="button">+ Batch</button><button class="btn ghost" id="adde" type="button">+ Enroll student</button><button class="btn" id="addc" type="button">+ Course</button></div></div>
        <section class="card"><h2>Courses</h2><div class="scroll"><table><tr><th>Code</th><th>Name</th><th>Enrolled</th><th>Status</th><th></th></tr>${d.courses.map(c => `<tr><td>${esc(c.code)}</td><td><b>${esc(c.name)}</b><div class="small muted">${esc(c.description || '')}</div></td><td>${c.enrolled}</td><td><span class="badge ${c.active ? 'ok' : ''}">${c.active ? 'Active' : 'Inactive'}</span></td><td class="right"><button class="btn ghost sm" data-ec="${c.id}" type="button">Edit</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No courses yet.</td></tr>'}</table></div></section>
        <section class="card"><h2>Batches</h2><div class="scroll"><table><tr><th>Batch</th><th>Course</th><th>Starts</th><th>Members</th></tr>${d.batches.map(b => `<tr><td>${esc(b.name)}</td><td>${esc(b.course)}</td><td>${esc(b.start_date || '—')}</td><td>${b.members}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No batches.</td></tr>'}</table></div></section>
        <section class="card"><h2>Enrollments</h2><div class="scroll"><table><tr><th>Student</th><th>Course</th><th>Batch</th><th>Status</th><th></th></tr>${d.enrollments.map(e => `<tr><td>${esc(e.student)} <span class="small muted">${esc(e.student_code)}</span></td><td>${esc(e.course)}</td><td>${esc(e.batch || '—')}</td><td><select data-es="${e.id}" aria-label="Status" style="width:auto">${['active', 'completed', 'dropped'].map(s => `<option ${s === e.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td class="right"><button class="btn ghost sm" data-rm="${e.id}" type="button">Remove</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No enrollments.</td></tr>'}</table></div></section>`;
      const cOpts = d.courses.map(c => [c.id, c.name]);
      $('#addc').addEventListener('click', () => modal('New course', `<form class="form" onsubmit="return false">${fld('Code', 'c-code', '', { max: 20 })}${fld('Name', 'c-name', '', { max: 120 })}${fld('Description', 'c-desc', '', { area: 1, full: 1, max: 500 })}<div class="err full"></div></form>`, [{ label: 'Cancel', ghost: true }, { label: 'Create', fn: async ov => { await api('POST', '/api/admin/courses', { code: val(ov, 'c-code'), name: val(ov, 'c-name'), description: val(ov, 'c-desc') }); route(); } }]));
      $('#addb').addEventListener('click', () => modal('New batch', `<form class="form" onsubmit="return false">${sel('Course', 'b-c', cOpts, '', { full: 1 })}${fld('Batch name', 'b-n', '', { max: 100 })}${fld('Start date', 'b-d', '', { type: 'date' })}<div class="err full"></div></form>`, [{ label: 'Cancel', ghost: true }, { label: 'Create', fn: async ov => { await api('POST', '/api/admin/batches', { course_id: val(ov, 'b-c'), name: val(ov, 'b-n'), start_date: val(ov, 'b-d') }); route(); } }]));
      $('#adde').addEventListener('click', () => modal('Enroll student', `<form class="form" onsubmit="return false">${sel('Student', 'e-s', st.students.filter(s => s.active).map(s => [s.id, `${s.name} (${s.student_code})`]), '', { full: 1 })}${sel('Course', 'e-c', cOpts, '', { full: 1 })}${sel('Batch (optional)', 'e-b', [['', '— none —'], ...d.batches.map(b => [b.id, `${b.name} — ${b.course}`])], '', { full: 1 })}<div class="err full"></div></form>`, [{ label: 'Cancel', ghost: true }, { label: 'Enroll', fn: async ov => { await api('POST', '/api/admin/enrollments', { student_id: val(ov, 'e-s'), course_id: val(ov, 'e-c'), batch_id: val(ov, 'e-b') || null }); route(); } }]));
      view.onclick = async e => { const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.ec) { const c = d.courses.find(x => x.id === +b.dataset.ec); modal('Edit course', `<form class="form" onsubmit="return false">${fld('Name', 'c-name', c.name, { max: 120, full: 1 })}${fld('Description', 'c-desc', c.description, { area: 1, full: 1, max: 500 })}${sel('Status', 'c-act', [[1, 'Active'], [0, 'Inactive']], c.active, { full: 1 })}<div class="err full"></div></form>`, [{ label: 'Cancel', ghost: true }, { label: 'Save', fn: async ov => { await api('PATCH', `/api/admin/courses/${c.id}`, { name: val(ov, 'c-name'), description: val(ov, 'c-desc'), active: val(ov, 'c-act') === '1' }); route(); } }]); }
        if (b.dataset.rm && await ask('Remove this enrollment?', 'Remove')) { await api('DELETE', `/api/admin/enrollments/${b.dataset.rm}`); route(); } };
      view.onchange = async e => { if (e.target.dataset.es) { try { await api('PATCH', `/api/admin/enrollments/${e.target.dataset.es}`, { status: e.target.value }); toast('Updated'); } catch (x) { toast(x.message, 1); } } };
    },

    async exams() {
      const [d, c, t] = await Promise.all([api('GET', '/api/admin/exams'), api('GET', '/api/admin/courses'), api('GET', '/api/admin/tests')]);
      const badge = s => `<span class="badge ${{ open: 'ok', upcoming: 'warn', closed: '', draft: 'info' }[s]}">${{ open: 'Open', upcoming: 'Upcoming', closed: 'Completed', draft: 'Draft' }[s]}</span>`;
      view.innerHTML = `<div class="row between"><h1>Examinations</h1><button class="btn" id="add" type="button">+ New exam</button></div>
        <div class="note">An exam links a scheduled window and attempt limit to one of the site's mock tests (the question paper). Students see published exams on their dashboard and start them at <code>/exam/&lt;id&gt;</code>.</div>
        <section class="card"><div class="scroll">${d.exams.length ? `<table><tr><th>Exam</th><th>Window</th><th>Attempts</th><th>Status</th><th></th></tr>${d.exams.map(e => `<tr><td><b>${esc(e.title)}</b><div class="small muted">${esc(e.course_name || 'All students')} · ${e.duration_min} min · test #${e.test_id || '—'} · max ${e.max_attempts} attempt(s)</div></td><td class="small">${fmt(e.start_at)}<br>→ ${fmt(e.end_at)}</td><td>${e.attempts}${e.avg_pct !== null ? `<div class="small muted">avg ${e.avg_pct}%</div>` : ''}</td><td>${badge(e.state)}</td>
          <td class="right" style="white-space:nowrap"><button class="btn ghost sm" data-res="${e.id}" type="button">Results</button> <button class="btn ghost sm" data-edit="${e.id}" type="button">Edit</button> <button class="btn ghost sm" data-del="${e.id}" type="button">Delete</button></td></tr>`).join('')}</table>` : '<p class="empty">No exams yet.</p>'}</div></section>`;
      const form = e => `<form class="form" onsubmit="return false">${fld('Title', 'x-t', e && e.title, { full: 1, max: 160 })}${sel('Linked mock test (question paper)', 'x-test', [['', '— choose —'], ...t.tests.map(x => [x.id, `#${x.id} ${x.title}`])], e && e.test_id, { full: 1 })}${sel('Course (blank = all students)', 'x-c', [['', 'All students'], ...c.courses.map(x => [x.id, x.name])], e && e.course_id)}${fld('Duration (min)', 'x-d', e ? e.duration_min : 30, { type: 'number' })}${fld('Opens', 'x-s', toLocal(e && e.start_at), { type: 'datetime-local' })}${fld('Closes', 'x-e', toLocal(e && e.end_at), { type: 'datetime-local' })}${fld('Max attempts', 'x-a', e ? e.max_attempts : 1, { type: 'number' })}${sel('Status', 'x-st', [['draft', 'Draft (hidden)'], ['published', 'Published']], e && e.status)}${fld('Instructions shown to students', 'x-i', e && e.instructions, { area: 1, full: 1, max: 1500 })}<div class="err full"></div></form>`;
      const body = ov => ({ title: val(ov, 'x-t'), test_id: val(ov, 'x-test') || null, course_id: val(ov, 'x-c') || null, duration_min: val(ov, 'x-d'), start_at: fromLocal(val(ov, 'x-s')), end_at: fromLocal(val(ov, 'x-e')), max_attempts: val(ov, 'x-a'), status: val(ov, 'x-st'), instructions: val(ov, 'x-i') });
      $('#add').addEventListener('click', () => modal('New exam', form(null), [{ label: 'Cancel', ghost: true }, { label: 'Create', fn: async ov => { await api('POST', '/api/admin/exams', body(ov)); route(); } }]));
      view.onclick = async ev => { const b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.edit) { const e = d.exams.find(x => x.id === +b.dataset.edit); modal('Edit exam', form(e), [{ label: 'Cancel', ghost: true }, { label: 'Save', fn: async ov => { await api('PATCH', `/api/admin/exams/${e.id}`, body(ov)); route(); } }]); }
        if (b.dataset.del && await ask('Delete this exam? Its recorded results stay but are no longer linked.', 'Delete')) { await api('DELETE', `/api/admin/exams/${b.dataset.del}`); route(); }
        if (b.dataset.res) { const r = await api('GET', `/api/admin/exams/${b.dataset.res}/results`); modal('Results — ' + r.exam.title, r.results.length ? `<div class="scroll"><table><tr><th>Student</th><th>Score</th><th>Date</th></tr>${r.results.map(x => `<tr><td>${esc(x.name)} <span class="small muted">${esc(x.student_code)}</span></td><td>${x.score}/${x.total} (${x.pct}%)</td><td class="small">${fmt(x.taken_at)}</td></tr>`).join('')}</table></div>` : '<p class="empty">No results yet.</p>'); } };
    },

    async notifications() {
      const t = tab.notifications || 'send';
      view.innerHTML = `<div class="row between"><h1>Notifications &amp; messages</h1></div>${tabs('notifications', [['send', 'Send notification'], ['history', 'History'], ['ann', 'Announcements'], ['msgs', 'Inbox']])}<div id="tabbody"></div>`;
      wireTabs('notifications', route); const body = $('#tabbody'); Portal.loading(body);
      if (t === 'send') {
        const s = await api('GET', '/api/admin/students?status=active');
        body.innerHTML = `<section class="card" style="max-width:720px"><form class="form" id="nf" onsubmit="return false">${fld('Title', 'n-t', '', { full: 1, max: 160 })}${fld('Message', 'n-b', '', { full: 1, area: 1, max: 3000 })}
          <div class="full"><label>Send to</label><div class="row"><label style="font-weight:400"><input type="radio" name="aud" value="all" checked style="width:auto"> All active students (${s.students.length})</label><label style="font-weight:400"><input type="radio" name="aud" value="selected" style="width:auto"> Selected students</label></div></div>
          <div class="full hide" id="pick" style="max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:9px;padding:8px">${s.students.map(x => `<label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" value="${x.id}" style="width:auto"> ${esc(x.name)} <span class="muted small">${esc(x.student_code)}</span></label>`).join('') || '<span class="muted small">No students.</span>'}</div>
          <div class="full"><button class="btn" type="submit">Send</button></div><div class="err full" id="nerr"></div></form></section>`;
        body.querySelectorAll('[name=aud]').forEach(r => r.addEventListener('change', () => $('#pick').classList.toggle('hide', body.querySelector('[name=aud]:checked').value !== 'selected')));
        $('#nf').addEventListener('submit', async e => { e.preventDefault(); const aud = body.querySelector('[name=aud]:checked').value, ids = [...body.querySelectorAll('#pick input:checked')].map(i => +i.value);
          try { const r = await api('POST', '/api/admin/notifications', { title: $('#n-t').value, body: $('#n-b').value, audience: aud, student_ids: ids }); toast(`Sent to ${r.recipients} student(s)`); tab.notifications = 'history'; route(); } catch (x) { $('#nerr').textContent = x.message; } });
      } else if (t === 'history') {
        const d = await api('GET', '/api/admin/notifications');
        body.innerHTML = `<section class="card"><div class="scroll">${d.notifications.length ? `<table><tr><th>Title</th><th>Audience</th><th>Read</th><th>Sent</th><th></th></tr>${d.notifications.map(n => `<tr><td><b>${esc(n.title)}</b><div class="small muted">${esc(n.body.slice(0, 90))}${n.body.length > 90 ? '…' : ''}</div></td><td>${n.audience === 'all' ? 'All' : 'Selected'} (${n.recipients})</td><td>${n.read_count}/${n.recipients}</td><td class="small">${fmt(n.created_at)}</td><td class="right"><button class="btn ghost sm" data-del="${n.id}" type="button">Delete</button></td></tr>`).join('')}</table>` : '<p class="empty">Nothing sent yet.</p>'}</div></section>`;
        body.onclick = async e => { const b = e.target.closest('[data-del]'); if (b && await ask('Delete this notification for all recipients?', 'Delete')) { await api('DELETE', `/api/admin/notifications/${b.dataset.del}`); route(); } };
      } else if (t === 'ann') {
        const d = await api('GET', '/api/admin/announcements');
        body.innerHTML = `<div style="margin-bottom:12px"><button class="btn" id="na" type="button">+ New announcement</button></div><section class="card">${d.announcements.map(a => `<div class="list-item"><div class="row between"><div class="grow"><b>${esc(a.title)}</b><div class="small" style="white-space:pre-wrap">${esc(a.body)}</div><div class="small muted">${fmt(a.created_at)}${a.updated_at ? ' · edited ' + fmt(a.updated_at) : ''}</div></div><div class="row"><button class="btn ghost sm" data-ed="${a.id}" type="button">Edit</button><button class="btn ghost sm" data-del="${a.id}" type="button">Delete</button></div></div></div>`).join('') || '<p class="empty">No announcements.</p>'}</section>`;
        const f = a => `<form class="form" onsubmit="return false">${fld('Title', 'a-t', a && a.title, { full: 1, max: 160 })}${fld('Message', 'a-b', a && a.body, { full: 1, area: 1, max: 3000 })}<div class="err full"></div></form>`;
        $('#na').addEventListener('click', () => modal('New announcement', f(null), [{ label: 'Cancel', ghost: true }, { label: 'Publish', fn: async ov => { await api('POST', '/api/admin/announcements', { title: val(ov, 'a-t'), body: val(ov, 'a-b') }); route(); } }]));
        body.onclick = async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.ed) { const a = d.announcements.find(x => x.id === +b.dataset.ed); modal('Edit announcement', f(a), [{ label: 'Cancel', ghost: true }, { label: 'Save', fn: async ov => { await api('PATCH', `/api/admin/announcements/${a.id}`, { title: val(ov, 'a-t'), body: val(ov, 'a-b') }); route(); } }]); } if (b.dataset.del && await ask('Delete this announcement?', 'Delete')) { await api('DELETE', `/api/admin/announcements/${b.dataset.del}`); route(); } };
      } else {
        const d = await api('GET', '/api/admin/messages'); setBadge(d.messages.filter(m => !m.read_at).length);
        body.innerHTML = `<section class="card">${d.messages.map(m => `<div class="list-item ${m.read_at ? '' : 'unread'}"><div class="row between"><div class="grow"><b>${esc(m.name)}</b> <span class="small muted">&lt;${esc(m.email)}&gt; · ${esc(m.topic || 'General')} · ${fmt(m.created_at)}</span><div style="white-space:pre-wrap;margin-top:4px">${esc(m.body)}</div></div><div class="row">${m.read_at ? '' : `<button class="btn ghost sm" data-rd="${m.id}" type="button">Mark read</button>`}<button class="btn ghost sm" data-del="${m.id}" type="button">Delete</button></div></div></div>`).join('') || '<p class="empty">No messages. Messages sent from the website contact form appear here.</p>'}</section>`;
        body.onclick = async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.rd) { await api('POST', `/api/admin/messages/${b.dataset.rd}/read`, {}); route(); } if (b.dataset.del && await ask('Delete this message?', 'Delete')) { await api('DELETE', `/api/admin/messages/${b.dataset.del}`); route(); } };
      }
    },

    async analytics() {
      const d = await api('GET', '/api/admin/analytics');
      view.innerHTML = `<div class="row between"><h1>Reports &amp; analytics</h1><a class="btn ghost" href="/api/admin/export/results.csv">⬇ Export results (CSV)</a></div>
        <div class="grid g2"><section class="card"><h2>Unique visitors per day — 30 days <small>(${d.unique_visitors_30d} unique in total)</small></h2>${Portal.chart(d.days, d.visitors)}</section>
        <section class="card"><h2>Page views per day — 30 days</h2>${Portal.chart(d.days, d.views)}</section>
        <section class="card"><h2>Score distribution</h2>${Portal.bars(d.score_buckets.map(b => [b.label, b.n]), 'No results yet.')}</section>
        <section class="card"><h2>Most attempted exams</h2>${d.top_exams.length ? `<table><tr><th>Exam</th><th>Attempts</th><th>Avg</th></tr>${d.top_exams.map(x => `<tr><td>${esc(x.title)}</td><td>${x.attempts}</td><td>${x.avg_pct}%</td></tr>`).join('')}</table>` : '<p class="empty">No results yet.</p>'}</section>
        <section class="card"><h2>Top students by average</h2>${d.top_students.length ? `<table><tr><th>Student</th><th>Attempts</th><th>Avg</th></tr>${d.top_students.map(x => `<tr><td>${esc(x.name)} <span class="small muted">${esc(x.student_code)}</span></td><td>${x.attempts}</td><td>${x.avg_pct}%</td></tr>`).join('')}</table>` : '<p class="empty">No results yet.</p>'}</section></div>`;
    },

    async audit() {
      const d = await api('GET', '/api/admin/audit');
      view.innerHTML = `<h1>Audit log</h1><section class="card"><div class="scroll">${d.log.length ? `<table><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Detail</th><th>IP</th></tr>${d.log.map(l => `<tr><td class="small">${fmt(l.created_at)}</td><td class="small">${esc(l.admin_email || '—')}</td><td><span class="badge info">${esc(l.action)}</span></td><td>${esc(l.target || '')}</td><td class="small">${esc(l.detail || '')}</td><td class="small muted">${esc(l.ip || '')}</td></tr>`).join('')}</table>` : '<p class="empty">Nothing logged yet.</p>'}</div></section>`;
    },

    async settings() {
      const d = await api('GET', '/api/admin/settings'), s = d.settings;
      view.innerHTML = `<h1>Settings</h1><div class="grid g2"><section class="card"><h2>System</h2><form class="form" id="sf" onsubmit="return false">${fld('Site name', 's-n', s.site_name, { full: 1, max: 80 })}${fld('Support email', 's-m', s.support_email, { full: 1, type: 'email' })}${fld('“Active” timeout (minutes)', 's-a', s.active_timeout_min, { full: 1, type: 'number' })}<div class="full small muted">A visitor or student counts as active if seen within this many minutes.</div><div class="full"><button class="btn" type="submit">Save settings</button></div><div class="err full" id="se"></div></form></section>
        <section class="card"><h2>Change my password</h2><form class="form" id="pf" onsubmit="return false">${fld('Current password', 'p-c', '', { type: 'password', full: 1 })}${fld('New password', 'p-n', '', { type: 'password', full: 1 })}<div class="full"><button class="btn" type="submit">Update password</button></div><div class="err full" id="pe"></div></form></section></div>`;
      $('#sf').addEventListener('submit', async e => { e.preventDefault(); try { await api('PUT', '/api/admin/settings', { site_name: $('#s-n').value, support_email: $('#s-m').value, active_timeout_min: $('#s-a').value }); toast('Settings saved'); $('#se').textContent = ''; } catch (x) { $('#se').textContent = x.message; } });
      $('#pf').addEventListener('submit', async e => { e.preventDefault(); try { await api('POST', '/api/admin/password', { current: $('#p-c').value, next: $('#p-n').value }); toast('Password updated'); $('#pf').reset(); $('#pe').textContent = ''; } catch (x) { $('#pe').textContent = x.message; } });
    }
  };

  function setBadge(n) { const b = $('#mbadge'); b.textContent = n; b.classList.toggle('hide', !n); }
  async function route() {
    const v = location.pathname.split('/').pop() || 'dashboard', name = views[v] ? v : 'dashboard';
    document.querySelectorAll('#side a[data-v]').forEach(a => { const on = a.dataset.v === name; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    $('#side').classList.remove('open'); view.onclick = null; view.onchange = null; Portal.loading(view);
    try { await views[name](); document.title = name[0].toUpperCase() + name.slice(1) + ' — ExamPro Admin'; } catch (e) { Portal.fail(view, e, route); }
  }
  document.addEventListener('click', e => { const a = e.target.closest('#side a[data-v]'); if (a) { e.preventDefault(); history.pushState({}, '', a.getAttribute('href')); route(); } });
  window.addEventListener('popstate', route);
  $('#burger').addEventListener('click', () => { const o = $('#side').classList.toggle('open'); $('#burger').setAttribute('aria-expanded', o); });
  $('#logout').addEventListener('click', async () => { try { await api('POST', '/api/admin/logout', {}); } catch (e) {} location.href = '/admin/login'; });
  (async function init() {
    try { const m = await api('GET', '/api/admin/me'); Portal.csrf = m.csrf; $('#who').textContent = m.admin.email; Portal.heartbeat(); route(); api('GET', '/api/admin/metrics').then(x => setBadge(x.notifications.unread_messages)).catch(() => {}); }
    catch (e) { if (e.status !== 401) Portal.fail(view, e, init); }
  })();
})();
