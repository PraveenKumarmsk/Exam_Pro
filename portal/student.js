(function () {
  const { $, esc, api, fmt, fmtDay, avatar } = Portal, view = $('#view');
  let ME = null;
  Portal.onUnauthorized = () => { location.href = '/student/login'; };
  const stateBadge = e => ({ open: '<span class="badge ok">Open now</span>', upcoming: '<span class="badge warn">Upcoming</span>', closed: '<span class="badge">Closed</span>' }[e.state] || '');
  const examRow = e => `<div class="list-item"><div class="row between"><div class="grow"><b>${esc(e.title)}</b> ${stateBadge(e)}
      <div class="small muted">${e.course_name ? esc(e.course_name) + ' · ' : ''}${e.duration_min} min · ${e.start_at ? 'Opens ' + fmt(e.start_at) : 'Open'}${e.end_at ? ' · Closes ' + fmt(e.end_at) : ''} · Attempts ${e.attempts_used}/${e.max_attempts}</div>
      ${e.instructions ? `<div class="small" style="margin-top:4px">${esc(e.instructions)}</div>` : ''}</div>
      ${e.can_start ? `<a class="btn sm" href="/exam/${e.id}">Start exam</a>` : `<button class="btn sm" disabled>${e.state === 'upcoming' ? 'Not open yet' : e.attempts_left < 1 ? 'No attempts left' : 'Closed'}</button>`}</div></div>`;
  const resRow = r => `<tr><td>${esc(r.title)}</td><td>${r.score}/${r.total}</td><td><span class="badge ${r.pct >= 60 ? 'ok' : r.pct >= 40 ? 'warn' : 'bad'}">${r.pct}%</span></td><td>${fmt(r.taken_at)}</td></tr>`;
  const noteItem = n => `<div class="list-item ${n.read_at ? '' : 'unread'}"><a href="#" data-note="${n.id}"><b>${esc(n.title)}</b></a><div class="small muted">${fmt(n.created_at)}</div></div>`;
  const setUnread = n => { const d = $('#dot'); d.textContent = n; d.classList.toggle('hide', !n); };

  const views = {
    async dashboard() {
      const d = await api('GET', '/api/student/dashboard'); setUnread(d.unread);
      view.innerHTML = `<h1>Welcome, ${esc(d.student.name.split(' ')[0])}</h1>
        ${d.student.is_demo ? '<div class="note">This is a <b>demo test account</b> with sample data.</div>' : ''}
        <div class="grid g3"><div class="card"><div class="row" style="flex-wrap:nowrap">${avatar(d.student)}<div><b>${esc(d.student.name)}</b><div class="small muted">ID: ${esc(d.student.student_code)}</div><div class="small muted">${esc(d.student.email)}</div></div></div></div>
        <div class="kpi"><b>${d.stats.attempts}</b><span>Exam attempts</span></div><div class="kpi"><b>${d.stats.avg_pct === null ? '—' : d.stats.avg_pct + '%'}</b><span>Average score</span></div></div>
        <div class="grid g2" style="margin-top:16px">
          <section class="card"><h2>My enrollment</h2>${d.enrollments.length ? d.enrollments.map(e => `<div class="list-item"><b>${esc(e.course)}</b> <span class="badge ${e.status === 'active' ? 'ok' : ''}">${esc(e.status)}</span><div class="small muted">${e.batch ? esc(e.batch) + ' · ' : ''}Enrolled ${fmtDay(e.enrolled_at)}</div></div>`).join('') : '<p class="empty">You are not enrolled in a course yet.</p>'}</section>
          <section class="card"><h2>Upcoming &amp; available exams</h2>${d.exams.length ? d.exams.map(examRow).join('') : '<p class="empty">No exams available right now.</p>'}</section>
          <section class="card"><h2>Recent results</h2>${d.results.length ? `<div class="scroll"><table><tr><th>Exam</th><th>Score</th><th>%</th><th>Date</th></tr>${d.results.map(resRow).join('')}</table></div>` : '<p class="empty">No results yet.</p>'}</section>
          <section class="card"><h2>Notifications ${d.unread ? `<span class="badge info">${d.unread} unread</span>` : ''}</h2>${d.notifications.length ? d.notifications.map(noteItem).join('') : '<p class="empty">No notifications.</p>'}
            ${d.announcements.length ? '<h2 style="margin-top:14px">Announcements</h2>' + d.announcements.map(a => `<div class="list-item"><b>${esc(a.title)}</b><div class="small">${esc(a.body)}</div><div class="small muted">${fmtDay(a.created_at)}</div></div>`).join('') : ''}</section>
        </div>`;
    },
    async exams() {
      const [e, r] = await Promise.all([api('GET', '/api/student/exams'), api('GET', '/api/student/results')]);
      const by = s => e.exams.filter(x => s.includes(x.state));
      view.innerHTML = `<h1>Exams</h1><div class="note">Each exam opens in its own focused page. Make sure you have a stable connection before you start; attempts are limited.</div>
        <section class="card"><h2>Available now</h2>${by(['open']).map(examRow).join('') || '<p class="empty">Nothing open right now.</p>'}</section>
        <section class="card"><h2>Upcoming</h2>${by(['upcoming']).map(examRow).join('') || '<p class="empty">No upcoming exams.</p>'}</section>
        <section class="card"><h2>Closed</h2>${by(['closed']).map(examRow).join('') || '<p class="empty">None.</p>'}</section>
        <section class="card"><h2>My exam history</h2>${r.results.length ? `<div class="scroll"><table><tr><th>Exam</th><th>Score</th><th>%</th><th>Date</th></tr>${r.results.map(resRow).join('')}</table></div>` : '<p class="empty">You have not taken any exams yet.</p>'}</section>`;
    },
    async notifications() {
      const d = await api('GET', '/api/student/notifications'); setUnread(d.unread);
      view.innerHTML = `<div class="row between"><h1>Notifications</h1>${d.unread ? '<button class="btn ghost sm" id="all" type="button">Mark all as read</button>' : ''}</div>
        <section class="card"><h2>Messages for you</h2>${d.notifications.length ? d.notifications.map(noteItem).join('') : '<p class="empty">No notifications yet.</p>'}</section>
        <section class="card"><h2>Announcements</h2>${d.announcements.length ? d.announcements.map(a => `<div class="list-item"><b>${esc(a.title)}</b><div class="small" style="white-space:pre-wrap">${esc(a.body)}</div><div class="small muted">${fmt(a.created_at)}</div></div>`).join('') : '<p class="empty">No announcements.</p>'}</section>`;
      const all = $('#all'); if (all) all.addEventListener('click', async () => { await api('POST', '/api/student/notifications-read-all', {}); route(); });
      view._notes = d.notifications;
    },
    async profile() {
      const d = await api('GET', '/api/student/profile'), s = d.student;
      view.innerHTML = `<h1>My profile</h1><div class="grid g2"><section class="card"><div class="row" style="flex-wrap:nowrap;margin-bottom:12px">${avatar(s)}<div><b>${esc(s.name)}</b><div class="small muted">Student ID ${esc(s.student_code)}</div>${s.is_demo ? '<span class="badge warn">Demo account</span>' : ''}</div></div>
        <form id="pf" class="form"><div class="full"><label for="n">Full name</label><input id="n" value="${esc(s.name)}" maxlength="100" required></div>
        <div><label>Email</label><input value="${esc(s.email)}" disabled></div><div><label for="ph">Phone</label><input id="ph" value="${esc(s.phone || '')}" maxlength="20"></div>
        <div class="full"><button class="btn" type="submit">Save changes</button></div><div class="err full" id="perr"></div></form></section>
        <section class="card"><h2>Enrollment details</h2>${d.enrollments.length ? d.enrollments.map(e => `<div class="list-item"><b>${esc(e.course)}</b> (${esc(e.course_code)}) <span class="badge ${e.status === 'active' ? 'ok' : ''}">${esc(e.status)}</span><div class="small">${esc(e.description || '')}</div><div class="small muted">${e.batch ? 'Batch: ' + esc(e.batch) + (e.start_date ? ' (starts ' + esc(e.start_date) + ')' : '') + ' · ' : ''}Enrolled ${fmtDay(e.enrolled_at)}</div></div>`).join('') : '<p class="empty">Not enrolled yet.</p>'}</section></div>`;
      $('#pf').addEventListener('submit', async e => { e.preventDefault(); try { await api('PATCH', '/api/student/profile', { name: $('#n').value, phone: $('#ph').value }); Portal.toast('Profile saved'); ME.name = $('#n').value; $('#who').textContent = ME.name; } catch (ex) { $('#perr').textContent = ex.message; } });
    },
    async settings() {
      view.innerHTML = `<h1>Account settings</h1><section class="card" style="max-width:480px"><h2>Change password</h2><form id="pw" class="form">
        <div class="full"><label for="c">Current password</label><input id="c" type="password" autocomplete="current-password" required></div>
        <div class="full"><label for="x">New password</label><input id="x" type="password" autocomplete="new-password" required><div class="small muted">At least 8 characters with a letter and a number. Other devices will be signed out.</div></div>
        <div class="full"><label for="y">Repeat new password</label><input id="y" type="password" autocomplete="new-password" required></div>
        <div class="full"><button class="btn" type="submit">Update password</button></div><div class="err full" id="e"></div></form></section>`;
      $('#pw').addEventListener('submit', async e => { e.preventDefault(); const er = $('#e'); er.textContent = ''; if ($('#x').value !== $('#y').value) { er.textContent = 'New passwords do not match.'; return; }
        try { await api('POST', '/api/student/password', { current: $('#c').value, next: $('#x').value }); $('#pw').reset(); Portal.toast('Password updated'); } catch (ex) { er.textContent = ex.message; } });
    }
  };

  async function route() {
    const v = location.pathname.split('/').pop() || 'dashboard', name = views[v] ? v : 'dashboard';
    document.querySelectorAll('#nav a').forEach(a => { const on = a.dataset.v === name; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    Portal.loading(view);
    try { await views[name](); document.title = name[0].toUpperCase() + name.slice(1) + ' — Student Portal'; } catch (e) { Portal.fail(view, e, route); }
  }
  document.addEventListener('click', async e => {
    const a = e.target.closest('#nav a'); if (a) { e.preventDefault(); history.pushState({}, '', a.getAttribute('href')); route(); return; }
    const n = e.target.closest('[data-note]'); if (!n) return; e.preventDefault();
    const id = +n.dataset.note; let note = (view._notes || []).find(x => x.id === id);
    if (!note) { const d = await api('GET', '/api/student/notifications'); note = d.notifications.find(x => x.id === id); }
    if (!note) return;
    await api('POST', `/api/student/notifications/${id}/read`, {}).catch(() => {});
    Portal.modal(note.title, `<p style="white-space:pre-wrap">${esc(note.body)}</p><p class="small muted" style="margin-top:10px">${fmt(note.created_at)}</p>`, [{ label: 'Close', fn: () => { route(); } }]);
  });
  window.addEventListener('popstate', route);
  $('#logout').addEventListener('click', async () => { try { await api('POST', '/api/student/logout', {}); } catch (e) {} location.href = '/student/login'; });
  (async function init() {
    try { const m = await api('GET', '/api/student/me'); Portal.csrf = m.csrf; ME = m.student; $('#who').textContent = ME.name; Portal.heartbeat(); route(); }
    catch (e) { if (e.status !== 401) Portal.fail(view, e, init); }
  })();
})();
