'use strict';

// Statische GitHub-Pages-Variante: Daten & Login laufen über Supabase.
// Die Spielregeln (Tipp-Sperre ab Anpfiff, Sichtbarkeit fremder Tipps)
// erzwingt die Datenbank per Row Level Security – siehe supabase/setup.sql.

const cfg = window.TIPPSPIEL_CONFIG;
const sb = cfg && cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('DEIN-PROJEKT')
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;

// Logins laufen über Pseudo-E-Mails, die aus dem Namen gebildet werden –
// echte Mails werden nie verschickt ("Confirm email" in Supabase ausschalten).
const EMAIL_DOMAIN = 'wm-tippspiel.example';

const THEMES = [
  { id: 'ozean', name: 'Ozean' },
  { id: 'rasen', name: 'Rasen' },
  { id: 'sunset', name: 'Sonnenuntergang' },
  { id: 'nacht', name: 'Mitternacht' },
  { id: 'hell', name: 'Hell' },
];

// Länderflaggen: Teamname -> ISO-Code (Quellen schreiben Namen teils unterschiedlich)
const TEAM_ISO = {
  'Algeria': 'DZ', 'Argentina': 'AR', 'Australia': 'AU', 'Austria': 'AT',
  'Belgium': 'BE', 'Bosnia & Herzegovina': 'BA', 'Bosnia and Herzegovina': 'BA',
  'Brazil': 'BR', 'Cameroon': 'CM', 'Canada': 'CA',
  'Cape Verde': 'CV', 'Cabo Verde': 'CV', 'Chile': 'CL', 'Colombia': 'CO',
  'Costa Rica': 'CR', 'Croatia': 'HR', 'Curaçao': 'CW', 'Curacao': 'CW',
  'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Denmark': 'DK',
  'DR Congo': 'CD', 'Congo DR': 'CD', 'Ecuador': 'EC', 'Egypt': 'EG',
  'England': '_eng', 'Finland': 'FI', 'France': 'FR', 'Germany': 'DE',
  'Ghana': 'GH', 'Greece': 'GR', 'Haiti': 'HT', 'Honduras': 'HN',
  'Hungary': 'HU', 'Iceland': 'IS', 'Iran': 'IR', 'IR Iran': 'IR',
  'Iraq': 'IQ', 'Ireland': 'IE', 'Italy': 'IT',
  'Ivory Coast': 'CI', "Côte d'Ivoire": 'CI', 'Jamaica': 'JM', 'Japan': 'JP',
  'Jordan': 'JO', 'Mali': 'ML', 'Mexico': 'MX', 'Morocco': 'MA',
  'Netherlands': 'NL', 'New Zealand': 'NZ', 'Nigeria': 'NG',
  'North Macedonia': 'MK', 'Norway': 'NO', 'Panama': 'PA', 'Paraguay': 'PY',
  'Peru': 'PE', 'Poland': 'PL', 'Portugal': 'PT', 'Qatar': 'QA',
  'Romania': 'RO', 'Saudi Arabia': 'SA', 'Scotland': '_sco', 'Senegal': 'SN',
  'Serbia': 'RS', 'Slovakia': 'SK', 'Slovenia': 'SI', 'South Africa': 'ZA',
  'South Korea': 'KR', 'Korea Republic': 'KR', 'Spain': 'ES', 'Sweden': 'SE',
  'Switzerland': 'CH', 'Tunisia': 'TN', 'Turkey': 'TR', 'Türkiye': 'TR',
  'Ukraine': 'UA', 'United Arab Emirates': 'AE',
  'USA': 'US', 'United States': 'US', 'Uruguay': 'UY', 'Uzbekistan': 'UZ',
  'Venezuela': 'VE', 'Wales': '_wal',
};

// Flaggen als Bilder statt Emojis – sehen auf allen Geräten gleich aus
function flagFor(team) {
  const iso = TEAM_ISO[team];
  if (!iso) return '';
  const code = iso === '_eng' ? 'gb-eng' : iso === '_sco' ? 'gb-sct' : iso === '_wal' ? 'gb-wls' : iso.toLowerCase();
  return `<img class="flag-img" src="https://flagcdn.com/h24/${code}.png" srcset="https://flagcdn.com/h48/${code}.png 2x" alt="" loading="lazy" onerror="this.remove()">`;
}

// Eigene SVG-Icons statt Emojis
const ICONS = {
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.2l2.7 5.4 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6L3.3 9.5l6-.9z" fill="currentColor"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M4.5 19.5l.9-3.6L16.6 4.7a2 2 0 012.8 0l-.1-.1a2 2 0 010 2.8L8.1 18.6l-3.6.9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14.8 6.5l2.7 2.7" stroke="currentColor" stroke-width="1.7"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M4.5 12.5l5 5L19.5 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M8 3.5h8V9a4 4 0 01-8 0V3.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 5.2H5a3 3 0 003.2 3M16 5.2h3A3 3 0 0115.8 8.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 13v2.5M9.5 19.5h5M10.3 15.5h3.4l.8 4h-5z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const icon = (name, cls = 'icon') => `<span class="${cls}">${ICONS[name]}</span>`;

// Platzhalter aus dem Spielplan wie "2A", "1E", "3A/B/C/D/F" oder "W73" (Sieger Spiel 73)
const isPlaceholder = (team) => /^[123][A-L]($|\/)/.test(team) || team.includes('/') ||
  /^[WL]\d+$/.test(team) || /^Winner|^Loser/i.test(team);

function teamHtml(team, isHome) {
  const flag = flagFor(team);
  const tbd = isPlaceholder(team) ? ' tbd' : '';
  const inner = isHome
    ? `${esc(team)} ${flag}`
    : `${flag} ${esc(team)}`;
  return `<div class="team ${isHome ? 'home' : 'away'}${tbd}">${inner}</div>`;
}

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
const fmtShortDay = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

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

// Anzeige-Übersetzungen für Gruppen-/Rundennamen aus den Datenquellen
function displayGroup(g) { return g ? g.replace(/^Group /, 'Gruppe ').replace(/^GROUP_/, 'Gruppe ') : null; }

function stageKey(stage) {
  const s = (stage || '').toLowerCase();
  if (/32/.test(s)) return 'R32';
  if (/16/.test(s) && !/match/.test(s)) return 'R16';
  if (/quarter|viertel/.test(s)) return 'QF';
  if (/semi|halb/.test(s)) return 'SF';
  if (/third|3rd|platz 3|dritten/.test(s)) return 'P3';
  if (/final/.test(s)) return 'F';
  return null;
}

const STAGE_NAMES = {
  R32: 'Sechzehntelfinale', R16: 'Achtelfinale', QF: 'Viertelfinale',
  SF: 'Halbfinale', P3: 'Spiel um Platz 3', F: 'Finale',
};

function displayStage(stage) {
  if (!stage) return null;
  const key = stageKey(stage);
  if (key) return STAGE_NAMES[key];
  return stage.replace(/^Matchday /, 'Spieltag ');
}

function nameToEmail(name) {
  const slug = name.trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');
  if (slug.length < 2) return null;
  return `${slug}@${EMAIL_DOMAIN}`;
}

// ---------- Theme-Auswahl ----------

function setupThemes() {
  const list = $('#theme-list');
  const current = () => document.documentElement.dataset.theme;
  list.innerHTML = THEMES.map((t) => `
    <button class="theme-option ${current() === t.id ? 'active' : ''}" data-theme-id="${t.id}">
      <span class="swatch swatch-${t.id}"></span>${t.name}
    </button>`).join('');
  list.querySelectorAll('.theme-option').forEach((btn) => {
    btn.onclick = () => {
      document.documentElement.dataset.theme = btn.dataset.themeId;
      localStorage.setItem('tippspiel-theme', btn.dataset.themeId);
      list.querySelectorAll('.theme-option').forEach((b) => b.classList.toggle('active', b === btn));
    };
  });
  $('#theme-btn').onclick = (e) => {
    e.stopPropagation();
    $('#theme-panel').hidden = !$('#theme-panel').hidden;
  };
  document.addEventListener('click', (e) => {
    if (!$('#theme-panel').hidden && !$('#theme-panel').contains(e.target)) {
      $('#theme-panel').hidden = true;
    }
  });
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

  // ilike-Sonderzeichen escapen, damit Namen wie "100%" sauber geprüft werden
  const pattern = name.trim().replace(/([%_\\])/g, '\\$1');
  const { data: taken } = await sb.from('profiles').select('id').ilike('name', pattern).limit(1);
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

function switchToTab(tabId) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
  ['matches', 'turnier', 'leaderboard', 'admin'].forEach((t) => {
    $('#tab-' + t).hidden = t !== tabId;
  });
}

function renderUserArea(myStats) {
  const el = $('#user-area');
  if (state.user) {
    const stats = myStats && myStats.tipped > 0
      ? `<span class="my-stats">${icon('star', 'icon star-icon')} ${myStats.points} P. · Platz ${myStats.rank}</span>` : '';
    el.innerHTML = `${stats}<span class="name">${esc(state.user.name)}</span>
      <button class="secondary" id="logout-btn">Abmelden</button>`;
    $('#logout-btn').onclick = async () => {
      await sb.auth.signOut();
      state.user = null;
      if (!$('#tab-admin').hidden) switchToTab('matches');
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
  // Defensiv zusätzlich clientseitig sortieren
  (matches || []).sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.ext_id.localeCompare(b.ext_id));
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
            mine: state.user && t.user_id === state.user.id,
            home: t.home_tip,
            away: t.away_tip,
            points: calcPoints(t.home_tip, t.away_tip, m.home_score, m.away_score),
          }))
        : null,
    };
  });
  renderMatches();
  renderTipReminder();
}

// ---------- Spiele rendern ----------

function untippedUpcoming() {
  return state.matches.filter((m) =>
    !m.started && m.status === 'SCHEDULED' && !m.my_tip);
}

function filterMatches() {
  const now = Date.now();
  switch (state.filter) {
    case 'upcoming':
      return state.matches.filter((m) => m.status === 'LIVE' ||
        (m.status !== 'FINISHED' && m.status !== 'CANCELLED' &&
         new Date(m.kickoff_utc).getTime() > now - 3 * 3600 * 1000));
    case 'finished':
      return state.matches.filter((m) => m.status === 'FINISHED');
    case 'untipped':
      return untippedUpcoming();
    default:
      return state.matches;
  }
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  let prefix = '';
  if (sameDay(d, today)) prefix = '<span class="today-flag">Heute</span>';
  else if (sameDay(d, tomorrow)) prefix = '<span class="today-flag">Morgen</span>';
  return prefix + esc(fmtDay(iso));
}

function renderTipReminder() {
  const el = $('#tip-reminder');
  const open = state.user ? untippedUpcoming().length : 0;
  $('#filter-untipped').hidden = !state.user;
  if (!open) { el.hidden = true; return; }
  el.innerHTML = `${icon('pencil')} Du hast noch <strong>${open}</strong> anstehende ${open === 1 ? 'Spiel' : 'Spiele'} ohne Tipp – <a id="show-untipped">jetzt tippen</a>`;
  el.hidden = false;
  $('#show-untipped').onclick = () => {
    state.filter = 'untipped';
    document.querySelectorAll('.filter').forEach((b) => b.classList.toggle('active', b.dataset.filter === 'untipped'));
    renderMatches();
  };
}

function renderMatches() {
  const list = $('#matches-list');
  const matches = filterMatches();
  if (!matches.length) {
    list.innerHTML = state.filter === 'untipped'
      ? `<p class="muted">${icon('check', 'icon ok-icon')} Alles getippt – du bist auf dem Laufenden!</p>`
      : '<p class="muted">Keine Spiele gefunden. Die GitHub Action "Ergebnisse synchronisieren" einmal manuell starten?</p>';
    return;
  }
  let html = '';
  let lastDay = '';
  for (const m of matches) {
    const day = fmtDay(m.kickoff_utc);
    if (day !== lastDay) {
      html += `<div class="day-header">${dayLabel(m.kickoff_utc)}</div>`;
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
        toast('Tipp gespeichert');
        loadMatches();
      } catch (err) {
        toast(err.message, true);
      }
    };
  });

  // Antippen eines anstehenden Spiels: zeigt, wer schon getippt hat
  list.querySelectorAll('.match-card.clickable').forEach((card) => {
    card.onclick = (e) => {
      if (e.target.closest('form, input, button, select, a')) return;
      toggleTippers(card);
    };
  });
}

const tippersCache = new Map();

async function toggleTippers(card) {
  const box = card.querySelector('.tippers');
  const toggle = card.querySelector('.tippers-toggle');
  if (!box) return;
  if (!box.hidden) {
    box.hidden = true;
    toggle?.classList.remove('open');
    return;
  }
  box.hidden = false;
  toggle?.classList.add('open');
  const extId = card.dataset.match;
  if (!tippersCache.has(extId)) {
    box.innerHTML = '<span class="muted small">Lade…</span>';
    const { data, error } = await sb.rpc('tippers', { p_match_ext_id: extId });
    tippersCache.set(extId, error ? null : (data || []).map((r) => r.name));
  }
  const names = tippersCache.get(extId);
  if (names === null) {
    box.innerHTML = '<span class="muted small">Die Tipps werden ab Anpfiff sichtbar.</span>';
  } else if (!names.length) {
    box.innerHTML = '<span class="muted small">Noch hat niemand getippt.</span>';
  } else {
    box.innerHTML = `<span class="muted small">Schon getippt (Tipps ab Anpfiff sichtbar):</span><br>` +
      names.map((n) => `<span class="tipper-chip">${esc(n)}</span>`).join('');
  }
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

  const meta = [displayGroup(m.group_name), displayStage(m.stage), m.venue].filter(Boolean).join(' · ');

  let tipSection = '';
  const upcoming = !m.started && m.status === 'SCHEDULED';
  if (upcoming) {
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
          ${m.my_tip ? `<span class="my-tip-saved">${icon('check')}</span>` : ''}
        </form>`;
    } else {
      tipSection = `<div class="tip-row muted small">Zum Tippen bitte anmelden</div>`;
    }
    // Antippen zeigt, WER schon getippt hat (Tipps selbst erst ab Anpfiff)
    tipSection += `
      <div class="tippers-toggle">Wer hat schon getippt? ${icon('chevron', 'icon chev')}</div>
      <div class="tippers" hidden></div>`;
  } else if (m.all_tips && m.all_tips.length) {
    const rows = m.all_tips
      .slice()
      .sort((x, y) => (y.points ?? -1) - (x.points ?? -1) || x.user.localeCompare(y.user))
      .map((t) => `<tr class="${t.mine ? 'me' : ''}">
          <td>${esc(t.user)}</td>
          <td>${t.home} : ${t.away}</td>
          <td class="pts ${t.points !== null ? 'pts-' + t.points : ''}">${t.points !== null ? t.points + ' P.' : ''}</td>
        </tr>`).join('');
    tipSection = `<div class="all-tips"><table>${rows}</table></div>`;
  } else if (m.started) {
    tipSection = `<div class="tip-row muted small">Niemand hat getippt</div>`;
  }

  return `
    <div class="match-card ${m.status === 'LIVE' ? 'is-live' : ''} ${upcoming ? 'clickable' : ''}" data-match="${esc(m.ext_id)}">
      <div class="match-top"><span>${esc(meta)}</span>${statusBadge}</div>
      <div class="match-row">
        ${teamHtml(m.home_team, true)}
        ${score}
        ${teamHtml(m.away_team, false)}
      </div>
      ${tipSection}
    </div>`;
}

// ---------- Turnier: Gruppentabellen + K.-o.-Baum ----------

function computeStandings() {
  const groups = new Map();
  for (const m of state.matches) {
    const g = displayGroup(m.group_name);
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, new Map());
    const table = groups.get(g);
    for (const team of [m.home_team, m.away_team]) {
      if (!table.has(team)) {
        table.set(team, { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 });
      }
    }
    if (m.status !== 'FINISHED' || m.home_score === null || m.away_score === null) continue;
    const home = table.get(m.home_team);
    const away = table.get(m.away_team);
    home.played++; away.played++;
    home.gf += m.home_score; home.ga += m.away_score;
    away.gf += m.away_score; away.ga += m.home_score;
    if (m.home_score > m.away_score) { home.won++; home.points += 3; away.lost++; }
    else if (m.home_score < m.away_score) { away.won++; away.points += 3; home.lost++; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, table]) => ({
      name,
      rows: [...table.values()].sort((a, b) =>
        b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.team.localeCompare(b.team)),
    }));
}

function renderStandings() {
  const groups = computeStandings();
  $('#standings').innerHTML = groups.map((g) => `
    <div class="group-card">
      <h3>${esc(g.name)}</h3>
      <table>
        <thead><tr><th class="t">Team</th><th>Sp</th><th>Tore</th><th>±</th><th>Pkt</th></tr></thead>
        <tbody>
          ${g.rows.map((r, i) => `
            <tr class="${i < 2 && r.played > 0 ? 'qualified' : ''}">
              <td class="t">${flagFor(r.team) ? flagFor(r.team) + ' ' : ''}${esc(r.team)}</td>
              <td>${r.played}</td>
              <td>${r.gf}:${r.ga}</td>
              <td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>
              <td class="pts">${r.points}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('') || '<p class="muted">Noch keine Gruppenspiele geladen.</p>';
}

function bracketTeamHtml(team, score, otherScore, finished) {
  const tbd = isPlaceholder(team);
  const winner = finished && score !== null && otherScore !== null && score > otherScore;
  const flag = flagFor(team);
  return `<div class="bm-team ${winner ? 'winner' : ''} ${tbd ? 'tbd' : ''}">
    <span>${flag ? flag + ' ' : ''}${esc(team)}</span>
    <span class="bm-score">${score ?? ''}</span>
  </div>`;
}

function renderBracket() {
  const byStage = new Map();
  for (const m of state.matches) {
    const key = stageKey(m.stage);
    if (!key) continue;
    if (!byStage.has(key)) byStage.set(key, []);
    byStage.get(key).push(m);
  }
  for (const arr of byStage.values()) arr.sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));

  const matchCard = (m, extraClass = '') => {
    const finished = m.status === 'FINISHED';
    const badge = m.status === 'LIVE' ? '<span class="badge live">LIVE</span>'
      : finished ? '' : `<span>${fmtShortDay(m.kickoff_utc)} · ${fmtTime(m.kickoff_utc)}</span>`;
    return `
      <div class="bracket-match ${extraClass}">
        <div class="bm-meta"><span>${esc(m.venue || '')}</span>${badge}</div>
        ${bracketTeamHtml(m.home_team, m.home_score, m.away_score, finished)}
        ${bracketTeamHtml(m.away_team, m.away_score, m.home_score, finished)}
      </div>`;
  };

  const cols = ['R32', 'R16', 'QF', 'SF'].map((key) => {
    const matches = byStage.get(key) || [];
    if (!matches.length) return '';
    return `<div class="bracket-col"><h3>${STAGE_NAMES[key]}</h3>${matches.map((m) => matchCard(m)).join('')}</div>`;
  }).join('');

  const finals = byStage.get('F') || [];
  const third = byStage.get('P3') || [];
  const finalCol = (finals.length || third.length) ? `
    <div class="bracket-col final-col">
      <h3>${icon('trophy')} ${STAGE_NAMES.F}</h3>
      ${finals.map((m) => matchCard(m, 'final-match')).join('')}
      ${third.length ? `<div class="bracket-p3-label">${STAGE_NAMES.P3}</div>${third.map((m) => matchCard(m)).join('')}` : ''}
    </div>` : '';

  $('#bracket').innerHTML = (cols + finalCol) || '<p class="muted">Noch keine K.-o.-Spiele geladen.</p>';
}

function renderTurnier() {
  renderStandings();
  renderBracket();
}

// ---------- Rangliste ----------

async function computeLeaderboard() {
  const [{ data: profiles }, { data: tips }] = await Promise.all([
    sb.from('profiles').select('id, name'),
    // RLS: sichtbar sind alle Tipps zu angepfiffenen Spielen – das genügt,
    // weil nur beendete Spiele Punkte bringen
    sb.from('tips').select('user_id, match_ext_id, home_tip, away_tip'),
  ]);
  const stats = new Map((profiles || []).map((p) => [p.id, {
    id: p.id, name: p.name, points: 0, exact: 0, diff: 0, tendency: 0, tipped: 0,
  }]));

  const finished = new Map(state.matches
    .filter((m) => m.status === 'FINISHED' && m.home_score !== null)
    .map((m) => [m.ext_id, m]));
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

  const sorted = [...stats.values()].sort(
    (a, b) => b.points - a.points || b.exact - a.exact || a.name.localeCompare(b.name));
  sorted.forEach((s, i) => { s.rank = i + 1; });
  return sorted;
}

async function loadLeaderboard() {
  const leaderboard = await computeLeaderboard();
  const tbody = $('#leaderboard-table tbody');
  tbody.innerHTML = leaderboard.map((u, i) => `
    <tr class="${state.user && u.id === state.user.id ? 'me' : ''}">
      <td>${u.points > 0 && i < 3 ? `<span class="medal medal-${i + 1}">${u.rank}</span>` : u.rank}</td>
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
  const q = ($('#admin-search').value || '').toLowerCase();
  const matches = q
    ? state.matches.filter((m) =>
        m.home_team.toLowerCase().includes(q) || m.away_team.toLowerCase().includes(q))
    : state.matches;
  el.innerHTML = matches.map((m) => `
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
        toast('Gespeichert');
        loadMatches();
      } catch (err) {
        toast(err.message, true);
      }
    };
  });
}

async function renderAdminUsers() {
  const sel = $('#rp-user');
  if (!sel) return;
  const { data: profiles } = await sb.from('profiles').select('id, name').order('name');
  sel.innerHTML = (profiles || [])
    .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
    .join('') || '<option value="">– keine Mitspieler –</option>';
}

function setupAdmin() {
  $('#admin-search').oninput = () => renderAdminMatches();
  $('#reset-pw-form').onsubmit = async (e) => {
    e.preventDefault();
    const sel = $('#rp-user');
    const userId = sel.value;
    const name = sel.selectedOptions[0]?.textContent || '';
    const pass = $('#rp-pass').value;
    if (!userId) { toast('Bitte einen Mitspieler wählen', true); return; }
    try {
      const { error } = await sb.rpc('admin_reset_password', {
        p_user_id: userId,
        p_new_password: pass,
      });
      if (error) throw new Error(error.message);
      toast(`Neues Passwort für ${name} gesetzt`);
      $('#rp-pass').value = '';
    } catch (err) {
      toast(err.message, true);
    }
  };
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
      toast('Spiel angelegt');
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
      switchToTab(btn.dataset.tab);
      if (btn.dataset.tab === 'turnier') renderTurnier();
      if (btn.dataset.tab === 'leaderboard') loadLeaderboard();
      if (btn.dataset.tab === 'admin') { renderAdminMatches(); renderAdminUsers(); }
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
    $('#sync-info').textContent = 'Ergebnisse werden automatisch alle 15 Minuten aktualisiert.';
    if (state.user) {
      const leaderboard = await computeLeaderboard();
      const mine = leaderboard.find((u) => u.id === state.user.id);
      renderUserArea(mine);
    }
    if (!$('#tab-turnier').hidden) renderTurnier();
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
  setupThemes();
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
