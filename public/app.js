'use strict';

const state = {
  user: null,
  matches: [],
  filter: 'upcoming',
  authMode: 'login',
};

const $ = (sel) => document.querySelector(sel);

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = isError ? 'err' : '';
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2500);
}

// ---------- Auth ----------

function renderUserArea() {
  const el = $('#user-area');
  if (state.user) {
    el.innerHTML = `<span class="name">${esc(state.user.name)}</span>
      <button class="secondary" id="logout-btn">Abmelden</button>`;
    $('#logout-btn').onclick = async () => {
      await api('/logout', { method: 'POST' });
      state.user = null;
      refreshAll();
    };
  } else {
    el.innerHTML = `<button id="show-login">Anmelden / Registrieren</button>`;
    $('#show-login').onclick = () => {
      $('#auth-box').hidden = false;
      $('#auth-name').focus();
    };
  }
  $('#admin-tab').hidden = !state.user?.is_admin;
  $('#auth-box').hidden = Boolean(state.user) || $('#auth-box').hidden;
}

function setupAuthForm() {
  const switchLink = $('#auth-switch-link');
  switchLink.onclick = (e) => {
    e.preventDefault();
    state.authMode = state.authMode === 'login' ? 'register' : 'login';
    const isLogin = state.authMode === 'login';
    $('#auth-title').textContent = isLogin ? 'Anmelden' : 'Registrieren';
    $('#auth-submit').textContent = isLogin ? 'Einloggen' : 'Konto erstellen';
    $('#auth-switch-text').textContent = isLogin ? 'Noch kein Konto?' : 'Schon registriert?';
    switchLink.textContent = isLogin ? 'Registrieren' : 'Einloggen';
    $('#auth-error').textContent = '';
  };

  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    $('#auth-error').textContent = '';
    try {
      const user = await api('/' + state.authMode, {
        method: 'POST',
        body: { name: $('#auth-name').value, password: $('#auth-password').value },
      });
      state.user = user;
      $('#auth-box').hidden = true;
      $('#auth-password').value = '';
      toast(`Hallo ${user.name}!`);
      refreshAll();
    } catch (err) {
      $('#auth-error').textContent = err.message;
    }
  };
}

// ---------- Spiele ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const fmtTime = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (iso) => new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

function filterMatches() {
  const now = Date.now();
  switch (state.filter) {
    case 'upcoming':
      return state.matches.filter((m) => m.status === 'LIVE' ||
        (m.status !== 'FINISHED' && m.status !== 'CANCELLED' && new Date(m.kickoff_utc).getTime() > now - 3 * 3600 * 1000));
    case 'finished':
      return state.matches.filter((m) => m.status === 'FINISHED');
    default:
      return state.matches;
  }
}

function renderMatches() {
  const list = $('#matches-list');
  const matches = filterMatches();
  if (!matches.length) {
    list.innerHTML = '<p class="muted">Keine Spiele gefunden. Der erste Sync läuft eventuell noch – gleich neu laden.</p>';
    return;
  }
  let html = '';
  let lastDay = '';
  for (const m of matches) {
    const day = fmtDay(m.kickoff_utc);
    if (day !== lastDay) {
      html += `<div class="day-header">${esc(day)}</div>`;
      lastDay = day;
    }
    html += renderMatchCard(m);
  }
  list.innerHTML = html;

  list.querySelectorAll('.tip-form').forEach((form) => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const matchId = Number(form.dataset.match);
      try {
        await api('/tips', {
          method: 'POST',
          body: {
            match_id: matchId,
            home: Number(form.querySelector('.tip-home').value),
            away: Number(form.querySelector('.tip-away').value),
          },
        });
        toast('Tipp gespeichert ✔');
        loadMatches();
      } catch (err) {
        toast(err.message, true);
      }
    };
  });
}

function renderMatchCard(m) {
  const statusBadge = m.status === 'LIVE'
    ? '<span class="badge live">LIVE</span>'
    : m.status === 'FINISHED'
      ? '<span class="badge finished">Beendet</span>'
      : `<span class="badge scheduled">${fmtTime(m.kickoff_utc)} Uhr</span>`;

  const score = (m.home_score !== null && m.away_score !== null)
    ? `<div class="score">${m.home_score} : ${m.away_score}</div>`
    : `<div class="score tbd">– : –</div>`;

  const meta = [m.group_name, m.stage, m.venue].filter(Boolean).join(' · ');

  let tipSection = '';
  if (!m.started && m.status === 'SCHEDULED') {
    if (state.user) {
      const h = m.my_tip ? m.my_tip.home : '';
      const a = m.my_tip ? m.my_tip.away : '';
      tipSection = `
        <form class="tip-row tip-form" data-match="${m.id}">
          <label>Mein Tipp:</label>
          <input class="tip-home" type="number" min="0" max="99" value="${h}" required>
          <span>:</span>
          <input class="tip-away" type="number" min="0" max="99" value="${a}" required>
          <button type="submit">${m.my_tip ? 'Ändern' : 'Tippen'}</button>
          ${m.my_tip ? '<span class="my-tip-saved">✔</span>' : ''}
        </form>`;
    } else {
      tipSection = `<div class="tip-row muted small">Zum Tippen bitte anmelden</div>`;
    }
  } else if (m.all_tips && m.all_tips.length) {
    const rows = m.all_tips
      .slice()
      .sort((x, y) => (y.points ?? -1) - (x.points ?? -1) || x.user.localeCompare(y.user))
      .map((t) => `<tr>
          <td>${esc(t.user)}</td>
          <td>${t.home} : ${t.away}</td>
          <td class="pts ${t.points !== null ? 'pts-' + t.points : ''}">${t.points !== null ? t.points + ' P.' : ''}</td>
        </tr>`).join('');
    tipSection = `<div class="all-tips"><table>${rows}</table></div>`;
  } else if (m.started) {
    tipSection = `<div class="tip-row muted small">Niemand hat getippt</div>`;
  }

  return `
    <div class="match-card">
      <div class="match-top"><span>${esc(meta)}</span>${statusBadge}</div>
      <div class="match-row">
        <div class="team home">${esc(m.home_team)}</div>
        ${score}
        <div class="team away">${esc(m.away_team)}</div>
      </div>
      ${tipSection}
    </div>`;
}

async function loadMatches() {
  const data = await api('/matches');
  state.matches = data.matches;
  renderMatches();
}

async function loadSyncInfo() {
  try {
    const s = await api('/sync/status');
    const when = s.lastSync ? new Date(s.lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'noch nie';
    $('#sync-info').textContent = s.live
      ? `Live-Ergebnisse via football-data.org · letzter Abgleich: ${when} Uhr`
      : `Ergebnisse via openfootball (ca. täglich aktualisiert) · letzter Abgleich: ${when}${s.lastSync ? ' Uhr' : ''} · Für Live-Ergebnisse API-Key eintragen (siehe README)`;
  } catch { /* nicht kritisch */ }
}

// ---------- Rangliste ----------

async function loadLeaderboard() {
  const { leaderboard } = await api('/leaderboard');
  const tbody = $('#leaderboard-table tbody');
  tbody.innerHTML = leaderboard.map((u, i) => `
    <tr class="${i === 0 && u.points > 0 ? 'first' : ''}">
      <td>${i + 1}</td>
      <td>${esc(u.name)}</td>
      <td>${u.points}</td>
      <td>${u.exact}</td>
      <td>${u.diff}</td>
      <td>${u.tendency}</td>
      <td>${u.tipped}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="muted">Noch keine Mitspieler</td></tr>';
}

// ---------- Admin ----------

function renderAdminMatches() {
  const el = $('#admin-matches');
  el.innerHTML = state.matches.map((m) => `
    <form class="admin-match admin-result-form" data-match="${m.id}">
      <span style="flex:1">${esc(m.home_team)} – ${esc(m.away_team)} <span class="muted small">(${fmtDay(m.kickoff_utc)})</span></span>
      <input type="number" min="0" class="ar-home" value="${m.home_score ?? ''}" placeholder="–">
      <span>:</span>
      <input type="number" min="0" class="ar-away" value="${m.away_score ?? ''}" placeholder="–">
      <select class="ar-status">
        ${['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED'].map((s) =>
          `<option value="${s}" ${m.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <button type="submit" class="secondary">Speichern</button>
    </form>`).join('');

  el.querySelectorAll('.admin-result-form').forEach((form) => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/admin/matches/${form.dataset.match}`, {
          method: 'PUT',
          body: {
            home_score: form.querySelector('.ar-home').value,
            away_score: form.querySelector('.ar-away').value,
            status: form.querySelector('.ar-status').value,
          },
        });
        toast('Gespeichert ✔');
        loadMatches();
      } catch (err) {
        toast(err.message, true);
      }
    };
  });
}

function setupAdmin() {
  $('#force-sync').onclick = async () => {
    try {
      const r = await api('/admin/sync', { method: 'POST' });
      toast(`${r.count} Spiele von ${r.source} aktualisiert`);
      await loadMatches();
      renderAdminMatches();
    } catch (err) {
      toast(err.message, true);
    }
  };
  $('#add-match-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/matches', {
        method: 'POST',
        body: {
          home_team: $('#am-home').value,
          away_team: $('#am-away').value,
          kickoff_utc: new Date($('#am-kickoff').value).toISOString(),
          group_name: $('#am-group').value || null,
        },
      });
      toast('Spiel angelegt ✔');
      e.target.reset();
      await loadMatches();
      renderAdminMatches();
    } catch (err) {
      toast(err.message, true);
    }
  };
}

// ---------- Tabs & Init ----------

function setupTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      ['matches', 'leaderboard', 'admin'].forEach((t) => {
        $('#tab-' + t).hidden = t !== btn.dataset.tab;
      });
      if (btn.dataset.tab === 'leaderboard') loadLeaderboard();
      if (btn.dataset.tab === 'admin') renderAdminMatches();
    };
  });
  document.querySelectorAll('.filter').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      renderMatches();
    };
  });
}

async function refreshAll() {
  renderUserArea();
  await Promise.all([loadMatches(), loadSyncInfo()]);
}

(async function init() {
  setupTabs();
  setupAuthForm();
  setupAdmin();
  try {
    const { user } = await api('/me');
    state.user = user;
  } catch { /* nicht eingeloggt */ }
  refreshAll();
  // Auto-Refresh für Live-Ergebnisse
  setInterval(() => {
    if (!$('#tab-matches').hidden) loadMatches();
    loadSyncInfo();
  }, 60 * 1000);
})();
