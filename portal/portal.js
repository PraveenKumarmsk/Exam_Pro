/* Shared helpers for the student and admin portals (no framework). All dynamic text goes through esc(). */
(function () {
  const P = window.Portal = {};
  P.esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  P.$ = (s, r) => (r || document).querySelector(s);
  P.csrf = null; P.role = null;
  P.fmt = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  P.fmtDay = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  P.initials = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  P.avatar = (s, cls) => `<div class="avatar ${cls || ''}" aria-hidden="true">${P.esc(P.initials(s.name))}${s.photo_url ? `<img src="${P.esc(s.photo_url)}" alt="" onerror="this.remove()">` : ''}</div>`;
  P.toast = (msg, bad) => { let t = P.$('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } const d = document.createElement('div'); if (bad) d.className = 'bad'; d.textContent = msg; t.appendChild(d); setTimeout(() => d.remove(), 3500); };
  P.api = async function (method, path, body) {
    const h = {}; if (body !== undefined) h['Content-Type'] = 'application/json'; if (P.csrf) h['X-CSRF-Token'] = P.csrf;
    let r; try { r = await fetch(path, { method, headers: h, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new Error('Cannot reach the server. Check your connection.'); }
    if (r.status === 204) return null;
    const ct = r.headers.get('content-type') || ''; const data = ct.includes('json') ? await r.json().catch(() => ({})) : await r.text();
    if (!r.ok) { const e = new Error((data && data.error) || 'Request failed (' + r.status + ')'); e.status = r.status; if (r.status === 401 && P.onUnauthorized) P.onUnauthorized(); throw e; }
    return data;
  };
  /* modal dialog: returns {close, el}. body is trusted HTML built with esc() */
  P.modal = function (title, html, actions) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-label="${P.esc(title)}"><h3>${P.esc(title)}</h3><div class="mbody">${html}</div><div class="actions"></div></div>`;
    const prev = document.activeElement, close = () => { ov.remove(); document.removeEventListener('keydown', key); if (prev && prev.focus) prev.focus(); };
    const key = e => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', key);
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    const act = P.$('.actions', ov);
    (actions || [{ label: 'Close', ghost: true }]).forEach(a => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (a.ghost ? ' ghost' : '') + (a.danger ? ' danger' : ''); b.textContent = a.label; b.addEventListener('click', async () => { if (!a.fn) return close(); b.disabled = true; try { const keep = await a.fn(ov); if (keep !== false) close(); } catch (e) { const er = P.$('.err', ov) || P.$('.mbody', ov).appendChild(Object.assign(document.createElement('div'), { className: 'err' })); er.textContent = e.message; } b.disabled = false; }); act.appendChild(b); });
    document.body.appendChild(ov); const f = P.$('input,select,textarea,button', ov); if (f) f.focus();
    return { close, el: ov };
  };
  P.confirm = (msg, label = 'Confirm', danger = true) => new Promise(res => { let done = false; const m = P.modal('Please confirm', `<p>${P.esc(msg)}</p>`, [{ label: 'Cancel', ghost: true, fn: () => { if (!done) res(false); done = true; } }, { label, danger, fn: () => { done = true; res(true); } }]); m.el.addEventListener('mousedown', e => { if (e.target === m.el && !done) { done = true; res(false); } }); });
  P.loading = el => { el.innerHTML = '<div class="spin" role="status" aria-label="Loading"></div>'; };
  P.fail = (el, e, retry) => { el.innerHTML = `<div class="card empty"><p>${P.esc(e.message || 'Something went wrong.')}</p>${retry ? '<button class="btn ghost sm" id="retry" style="margin-top:10px">Try again</button>' : ''}</div>`; if (retry) P.$('#retry', el).addEventListener('click', retry); };
  P.chart = (labels, vals) => { const mx = Math.max(1, ...vals); return `<div class="chart" role="img" aria-label="Bar chart">${vals.map((v, i) => `<div title="${P.esc(labels[i])}: ${v}"><span>${v || ''}</span><i style="height:${Math.max(2, v / mx * 100)}px;opacity:${v ? 1 : .25}"></i></div>`).join('')}</div><div class="xlab">${labels.map(l => `<span>${P.esc(String(l).slice(-2))}</span>`).join('')}</div>`; };
  P.bars = (rows, empty) => { if (!rows.length) return `<p class="muted small">${P.esc(empty || 'No data yet.')}</p>`; const mx = Math.max(1, ...rows.map(r => r[1])); return rows.map(r => `<div class="bar"><span title="${P.esc(r[0])}">${P.esc(r[0])}</span><i style="width:${Math.max(2, r[1] / mx * 50)}%"></i><b>${P.esc(r[1])}</b></div>`).join(''); };
  /* keep the session "active" for the admin's active-user metric; stops when the tab is hidden */
  P.heartbeat = () => setInterval(() => { if (!document.hidden) P.api('POST', '/api/heartbeat', {}).catch(() => {}); }, 60000);
  P.serverUp = () => fetch('/api/health').then(r => r.ok).catch(() => false);
})();
