'use strict';

// Statische GitHub-Pages-Variante: Daten & Login laufen über Supabase.
// Die Zugriffsregeln (Tipp-Sperre ab Anpfiff, Sichtbarkeit fremder Tipps)
// erzwingt die Datenbank per Row Level Security – siehe supabase/setup.sql.

const cfg = window.TIPPSPIEL_CONFIG;
const sb = cfg && cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('DEIN-PROJEKT')
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;

// Logins laufen über Pseudo-E-Mails, die aus dem Namen gebildet werden –
// echte Mails werden nie verschickt ("Confirm email" in Supabase ausschalten).
const EMAIL_DOMAIN = 'wm-tippspiel.example';

const state = {
  user: null,        // { id, name, is_admin }
  matches: [],       // Spiele inkl. my_tip / all_tips
  filter: 'upcoming',
  authMode: 'login',
};

const $ = (sel) => document.querySelector(sel);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const fmtTime = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (iso) => new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = isError ? 'err' : '';
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2500);
}

// Punkteregeln: 4 exakt, 3 Tordifferenz, 2 Tendenz, 0 sonst
function calcPoints(homeTip, awayTip, homeScore, awayScore) {
  if (homeScore === null || homeScore === undefined ||
      awayScore === null || awayScore === undefined) return null;
  if (homeTip === homeScore && awayTip === awayScore) return 4;
  if (homeTip - awayTip === homeScore - awayScore) return 3;
  if (Math.sign(homeTip - awayTip) === Math.sign(homeScore - awayScore)) return 2;
  return 0;
}

function nameToEmail(name) {
  const slug = name.trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');
  if (slug.length < 2) return null;
  return `${slug}@${EMAIL_DOMAIN}`;
}

// ---------- Auth ----------

async function loadProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { state.user = null; return; }
  const { data: profile } = await sb.from('profiles')
    .select('id, name, is_admin').eq('id', user.id).single();
  state.user = profile || null;
}

async function register(name, password) {
  const email = nameToEmail(name);
  if (!email) throw new Error('Name muss mindestens 2 Buchstaben/Zahlen enthalten');
  if (name.trim().length > 30) throw new Error('Name darf höchstens 30 Zeichen haben');

  const { data: taken } = await sb.from('profiles').select('id').ilike('name', name.trim()).limit(1);
  if (taken && taken.length) throw new Error('Name ist schon vergeben');

  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    if (/already registered/i.test(error.message)) throw new Error('Name ist schon vergeben');
    throw new Error(error.message);
  }
  if (!data.session) {
    throw new Error('Registrierung angelegt, aber kein Login möglich – ist in Supabase unter Authentication "Confirm email" ausgeschaltet?');
  }
  const { error: pErr } = await sb.from('profiles').insert({ id: data.user.id, name: name.trim() });
  if (pErr) throw new Error('Profil konnte nicht angelegt werden: ' + pErr.message);
}

async function login(name, password) {
  const email = nameToEmail(name);
  if (!email) throw new Error('Name oder Passwort falsch');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Name oder Passwort falsch');
  // Profil nachziehen, falls die Registrierung früher beim Profil-Schritt abgebrochen ist
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = await sb.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (!profile) await sb.from('profiles').insert({ id: user.id, name: name.trim() });
}

function renderUserArea() {
  const el = $('#user-area');
  if (state.user) {
    el.innerHTML = `<span class="name">${esc(state.user.name)}</span>
      <button class="secondary" id="logout-btn">Abmelden</button>`;
    $('#logout-btn').onclick = async () => {
      await sb.auth.signOut();
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
    const name = $('#auth-name').value;
    const password = $('#auth-password').value;
    try {
      if (state.authMode === 'register') await register(name, password);
      else await login(name, password);
      await loadProfile();
      $('#auth-box').hidden = true;
      $('#auth-password').value = '';
      toast(`Hallo ${state.user?.name || name}!`);
      refreshAll();
    } catch (err) {
      $('#auth-error').textContent = err.message;
    }
  };
}

// ---------- Daten laden ----------

async function loadMatches() {
  const [{ data: matches, error: mErr }, { data: tips }] = await Promise.all([
    sb.from('matches').select('*').order('kickoff_utc').order('ext_id'),
    // RLS liefert nur eigene Tipps + Tipps zu bereits angepfiffenen Spielen
    sb.from('tips').select('user_id, match_ext_id, home_tip, away_tip, profiles(name)'),
  ]);
  if (mErr) throw new Error(mErr.message);

  const tipsByMatch = new Map();
  for (const t of tips || []) {
    if (!tipsByMatch.has(t.match_ext_id)) tipsByMatch.set(t.match_ext_id, []);
    tipsByMatch.get(t.match_ext_id).push(t);
  }

  const now = Date.now();
  state.matches = (matches || []).map((m) => {
    const started = new Date(m.kickoff_utc).getTime() <= now;
    const matchTips = tipsByMatch.get(m.ext_id) || [];
    const myTip = state.user ? matchTips.find((t) => t.user_id === state.user.id) : null;
    return {
      ...m,
      started,
      my_tip: myTip ? { home: myTip.home_tip, away: myTip.away_tip } : null,
      all_tips: started
        ? matchTips.map((t) => ({
            user: t.profiles?.name || '?',
            home: t.home_tip,
            away: t.away_tip,
            points: calcPoints(t.home_tip, t.away_tip, m.home_score, m.away_score),
          }))
        : null,
    };
  });
  renderMatches();
}

// ---------- Spiele rendern ----------

function filterMatches() {
  const now = Date.now();
  switch (state.filter) {
    case 'upcoming':
      return state.matches.filter((m) => m.status === 'LIVE' ||
        (m.status !== 'FINISHED' && m.status !== 'CANCELLED' &&
         new Date(m.kickoff_utc).getTime() > now - 3 * 3600 * 1000));
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
    list.innerHTML = '<p class="muted">Keine Spiele gefunden. Die GitHub Action "Ergebnisse synchronisieren" einmal manuell starten?</p>';
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
      try {
        const { error } = await sb.from('tips').upsert({
          user_id: state.user.id,
          match_ext_id: form.dataset.match,
          home_tip: Number(form.querySelector('.tip-home').value),
          away_tip: Number(form.querySelector('.tip-away').value),
        });
        if (error) {
          throw new Error(/security|policy/i.test(error.message)
            ? 'Das Spiel hat schon begonnen – Tipp gesperrt'
            : error.message);
        }
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
        <form class="tip-row tip-form" data-match="${esc(m.ext_id)}">
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

// ---------- Rangliste ----------

async function loadLeaderboard() {
  // Tipps zu beendeten Spielen sind für alle sichtbar (RLS) – Punkte
  // lassen sich daher komplett im Browser ausrechnen.
  const { data: profiles } = await sb.from('profiles').select('id, name');
  const stats = new Map((profiles || []).map((p) => [p.id, {
    name: p.name, points: 0, exact: 0, diff: 0, tendency: 0, tipped: 0,
  }]));

  const finished = new Map(state.matches
    .filter((m) => m.status === 'FINISHED' && m.home_score !== null)
    .map((m) => [m.ext_id, m]));
  const { data: tips } = await sb.from('tips').select('user_id, match_ext_id, home_tip, away_tip');
  for (const t of tips || []) {
    const m = finished.get(t.match_ext_id);
    const s = stats.get(t.user_id);
    if (!m || !s) continue;
    const p = calcPoints(t.home_tip, t.away_tip, m.home_score, m.away_score);
    s.tipped++;
    s.points += p;
    if (p === 4) s.exact++;
    else if (p === 3) s.diff++;
    else if (p === 2) s.tendency++;
  }

  const leaderboard = [...stats.values()].sort(
    (a, b) => b.points - a.points || b.exact - a.exact || a.name.localeCompare(b.name)
  );
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
    <form class="admin-match admin-result-form" data-match="${esc(m.ext_id)}">
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
      const hs = form.querySelector('.ar-home').value;
      const as = form.querySelector('.ar-away').value;
      try {
        const { error } = await sb.from('matches').update({
          home_score: hs === '' ? null : Number(hs),
          away_score: as === '' ? null : Number(as),
          status: form.querySelector('.ar-status').value,
          manual_override: true,
        }).eq('ext_id', form.dataset.match);
        if (error) throw new Error(error.message);
        toast('Gespeichert ✔');
        loadMatches();
      } catch (err) {
        toast(err.message, true);
      }
    };
  });
}

function setupAdmin() {
  $('#add-match-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await sb.from('matches').insert({
        ext_id: `manual:${Date.now()}`,
        home_team: $('#am-home').value.trim(),
        away_team: $('#am-away').value.trim(),
        kickoff_utc: new Date($('#am-kickoff').value).toISOString(),
        group_name: $('#am-group').value || null,
        manual_override: true,
      });
      if (error) throw new Error(error.message);
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
  try {
    await loadMatches();
    $('#sync-info').textContent = 'Ergebnisse werden automatisch alle 15 Minuten aktualisiert (GitHub Action).';
  } catch (err) {
    $('#matches-list').innerHTML = `<p class="error">Daten konnten nicht geladen werden: ${esc(err.message)}<br>
      Wurde supabase/setup.sql im Supabase-Projekt ausgeführt?</p>`;
  }
}

(async function init() {
  if (!sb) {
    $('#setup-hint').hidden = false;
    $('#tab-matches').hidden = true;
    document.querySelector('nav#tabs').hidden = true;
    return;
  }
  setupTabs();
  setupAuthForm();
  setupAdmin();
  await loadProfile();
  refreshAll();
  // Auto-Refresh für neue Ergebnisse
  setInterval(() => {
    if (!$('#tab-matches').hidden) loadMatches().catch(() => {});
  }, 60 * 1000);
})();
