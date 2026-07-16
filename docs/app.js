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

const THEMES = ['ozean', 'rasen', 'sunset', 'nacht', 'hell'];

// ---------- Übersetzungen (Deutsch = Standard, Englisch optional) ----------

const I18N = {
  de: {
    header_sub: '11. Juni – 19. Juli · USA, Kanada & Mexiko',
    change_colors: 'Farben ändern',
    choose_theme: 'Farbschema wählen',
    tab_matches: 'Spiele', tab_turnier: 'Turnier', tab_leaderboard: 'Rangliste', tab_admin: 'Admin',
    setup_title: 'Einrichtung nötig',
    setup_body: 'Die Datei docs/config.js fehlt noch. Bitte docs/config.example.js nach docs/config.js kopieren und die Supabase-Zugangsdaten eintragen – Anleitung im README des Repositories.',
    login_title: 'Anmelden', register_title: 'Registrieren',
    login_submit: 'Einloggen', register_submit: 'Konto erstellen',
    no_account: 'Noch kein Konto?', have_account: 'Schon registriert?',
    do_register: 'Registrieren', do_login: 'Einloggen',
    name_ph: 'Name (z. B. Gabor)', password_ph: 'Passwort (mind. 6 Zeichen)',
    filter_upcoming: 'Anstehend', filter_all: 'Alle', filter_finished: 'Beendet', filter_untipped: 'Ohne Tipp',
    loading_matches: 'Lade Spiele…',
    group_stage: 'Gruppenphase',
    group_stage_hint: 'Die zwei Gruppenbesten sowie die acht besten Gruppendritten erreichen die K.-o.-Runde.',
    ko_title: 'K.-o.-Runde · Der Weg zum Finale',
    ko_hint: 'Zum Scrollen wischen → Platzhalter wie „2A“ stehen für noch nicht feststehende Teams.',
    lb_name: 'Name', lb_points: 'Punkte', lb_tips: 'Tipps',
    lb_exact_t: 'Exakte Ergebnisse', lb_diff_t: 'Richtige Tordifferenz', lb_tend_t: 'Richtige Tendenz',
    lb_avg_t: 'Durchschnittliche Punkte pro Tipp',
    lb_legend: 'Exakt = 4 P. · Tordifferenz (±) = 3 P. · Tendenz (↑) = 2 P. · Finale: 100 / 75 / 50 P. – nur beendete Spiele zählen',
    admin_manage: 'Spiele verwalten',
    admin_note: 'Manuell gespeicherte Ergebnisse werden vom Auto-Sync nicht überschrieben.',
    admin_add_match: 'Spiel manuell anlegen',
    ph_home: 'Heimteam', ph_away: 'Auswärtsteam', ph_group: 'Gruppe (optional)',
    btn_add: 'Anlegen',
    admin_results: 'Ergebnis eintragen / korrigieren',
    ph_search_team: 'Team suchen…',
    admin_reset_pw: 'Passwort zurücksetzen',
    admin_reset_note: 'Passwörter können aus Sicherheitsgründen nicht angezeigt werden – sie sind verschlüsselt gespeichert. Wenn jemand sein Passwort vergisst, vergibst du hier ein neues und teilst es der Person mit. Punkte und Tipps bleiben erhalten.',
    ph_new_pw: 'Neues Passwort (mind. 6 Zeichen)',
    btn_set_pw: 'Neues Passwort setzen',
    save_btn: 'Speichern',
    theme_ozean: 'Ozean', theme_rasen: 'Rasen', theme_sunset: 'Sonnenuntergang', theme_nacht: 'Mitternacht', theme_hell: 'Hell',
    stage_R32: 'Sechzehntelfinale', stage_R16: 'Achtelfinale', stage_QF: 'Viertelfinale', stage_SF: 'Halbfinale', stage_P3: 'Spiel um Platz 3', stage_F: 'Finale',
    matchday: 'Spieltag', group: 'Gruppe',
    today: 'Heute', tomorrow: 'Morgen', clock_suffix: ' Uhr',
    logout: 'Abmelden', login_register: 'Anmelden / Registrieren',
    pts_short: 'P.', rank: 'Platz',
    my_tip: 'Mein Tipp:', change: 'Ändern', tip: 'Tippen',
    login_to_tip: 'Zum Tippen bitte anmelden',
    who_tipped: 'Wer hat schon getippt?',
    loading: 'Lade…',
    tips_after_kickoff: 'Die Tipps werden ab Anpfiff sichtbar.',
    nobody_tipped_yet: 'Noch hat niemand getippt.',
    already_tipped: 'Schon getippt (Tipps ab Anpfiff sichtbar):',
    nobody_tipped: 'Niemand hat getippt',
    badge_finished: 'Beendet',
    st_team: 'Team', st_p: 'Sp', st_goals: 'Tore', st_pts: 'Pkt',
    no_group_matches: 'Noch keine Gruppenspiele geladen.',
    no_ko_matches: 'Noch keine K.-o.-Spiele geladen.',
    no_players: 'Noch keine Mitspieler',
    no_players_opt: '– keine Mitspieler –',
    sync_info: 'Ergebnisse werden automatisch aktualisiert.',
    live_now: 'Jetzt live',
    updated_just_now: 'gerade aktualisiert',
    updated_min_ago: 'aktualisiert vor {n} Min',
    updated_sec_ago: 'aktualisiert vor {n} Sek',
    load_error: 'Daten konnten nicht geladen werden: {msg}<br>Wurde supabase/setup.sql im Supabase-Projekt ausgeführt?',
    no_matches_found: 'Keine Spiele gefunden. Die GitHub Action „Ergebnisse synchronisieren" einmal manuell starten?',
    all_tipped: 'Alles getippt – du bist auf dem Laufenden!',
    reminder_one: 'Du hast noch {n} anstehendes Spiel ohne Tipp – ',
    reminder_many: 'Du hast noch {n} anstehende Spiele ohne Tipp – ',
    reminder_link: 'jetzt tippen',
    hello: 'Hallo {name}!',
    tip_saved: 'Tipp gespeichert',
    tip_locked: 'Das Spiel hat schon begonnen – Tipp gesperrt',
    saved: 'Gespeichert',
    match_added: 'Spiel angelegt',
    choose_player: 'Bitte einen Mitspieler wählen',
    pw_set_for: 'Neues Passwort für {name} gesetzt',
    err_name_short: 'Name muss mindestens 2 Buchstaben/Zahlen enthalten',
    err_name_long: 'Name darf höchstens 30 Zeichen haben',
    err_name_taken: 'Name ist schon vergeben',
    err_no_session: 'Registrierung angelegt, aber kein Login möglich – ist in Supabase unter Authentication „Confirm email" ausgeschaltet?',
    err_profile: 'Profil konnte nicht angelegt werden: {msg}',
    err_login: 'Name oder Passwort falsch',
  },
  en: {
    header_sub: 'June 11 – July 19 · USA, Canada & Mexico',
    change_colors: 'Change colours',
    choose_theme: 'Choose colour scheme',
    tab_matches: 'Matches', tab_turnier: 'Tournament', tab_leaderboard: 'Leaderboard', tab_admin: 'Admin',
    setup_title: 'Setup required',
    setup_body: 'The file docs/config.js is still missing. Please copy docs/config.example.js to docs/config.js and enter your Supabase credentials – see the repository README.',
    login_title: 'Log in', register_title: 'Register',
    login_submit: 'Log in', register_submit: 'Create account',
    no_account: 'No account yet?', have_account: 'Already registered?',
    do_register: 'Register', do_login: 'Log in',
    name_ph: 'Name (e.g. Gabor)', password_ph: 'Password (min. 6 characters)',
    filter_upcoming: 'Upcoming', filter_all: 'All', filter_finished: 'Finished', filter_untipped: 'Untipped',
    loading_matches: 'Loading matches…',
    group_stage: 'Group stage',
    group_stage_hint: 'The top two of each group plus the eight best third-placed teams reach the knockout stage.',
    ko_title: 'Knockout stage · The road to the final',
    ko_hint: 'Swipe to scroll → placeholders like “2A” stand for teams not yet determined.',
    lb_name: 'Name', lb_points: 'Points', lb_tips: 'Tips',
    lb_exact_t: 'Exact results', lb_diff_t: 'Correct goal difference', lb_tend_t: 'Correct tendency',
    lb_avg_t: 'Average points per tip',
    lb_legend: 'Exact = 4 pts · Goal difference (±) = 3 pts · Tendency (↑) = 2 pts · Final: 100 / 75 / 50 pts – only finished matches count',
    admin_manage: 'Manage matches',
    admin_note: 'Manually saved results are not overwritten by the auto-sync.',
    admin_add_match: 'Add match manually',
    ph_home: 'Home team', ph_away: 'Away team', ph_group: 'Group (optional)',
    btn_add: 'Add',
    admin_results: 'Enter / correct result',
    ph_search_team: 'Search team…',
    admin_reset_pw: 'Reset password',
    admin_reset_note: 'For security reasons passwords cannot be shown – they are stored encrypted. If someone forgets their password, set a new one here and pass it on. Points and tips are kept.',
    ph_new_pw: 'New password (min. 6 characters)',
    btn_set_pw: 'Set new password',
    save_btn: 'Save',
    theme_ozean: 'Ocean', theme_rasen: 'Grass', theme_sunset: 'Sunset', theme_nacht: 'Midnight', theme_hell: 'Light',
    stage_R32: 'Round of 32', stage_R16: 'Round of 16', stage_QF: 'Quarter-final', stage_SF: 'Semi-final', stage_P3: 'Third-place play-off', stage_F: 'Final',
    matchday: 'Matchday', group: 'Group',
    today: 'Today', tomorrow: 'Tomorrow', clock_suffix: '',
    logout: 'Log out', login_register: 'Log in / Register',
    pts_short: 'pts', rank: 'Rank',
    my_tip: 'My tip:', change: 'Change', tip: 'Tip',
    login_to_tip: 'Log in to tip',
    who_tipped: 'Who has tipped already?',
    loading: 'Loading…',
    tips_after_kickoff: 'Tips become visible at kick-off.',
    nobody_tipped_yet: 'Nobody has tipped yet.',
    already_tipped: 'Already tipped (tips visible at kick-off):',
    nobody_tipped: 'Nobody tipped',
    badge_finished: 'Finished',
    st_team: 'Team', st_p: 'P', st_goals: 'Goals', st_pts: 'Pts',
    no_group_matches: 'No group matches loaded yet.',
    no_ko_matches: 'No knockout matches loaded yet.',
    no_players: 'No players yet',
    no_players_opt: '– no players –',
    sync_info: 'Results update automatically.',
    live_now: 'Live now',
    updated_just_now: 'just updated',
    updated_min_ago: 'updated {n} min ago',
    updated_sec_ago: 'updated {n} sec ago',
    load_error: 'Could not load data: {msg}<br>Has supabase/setup.sql been run in the Supabase project?',
    no_matches_found: 'No matches found. Run the GitHub Action “Sync results” once manually?',
    all_tipped: 'All tipped – you are up to date!',
    reminder_one: 'You still have {n} upcoming match without a tip – ',
    reminder_many: 'You still have {n} upcoming matches without a tip – ',
    reminder_link: 'tip now',
    hello: 'Hi {name}!',
    tip_saved: 'Tip saved',
    tip_locked: 'The match has already started – tipping locked',
    saved: 'Saved',
    match_added: 'Match added',
    choose_player: 'Please choose a player',
    pw_set_for: 'New password set for {name}',
    err_name_short: 'Name must contain at least 2 letters/numbers',
    err_name_long: 'Name may be at most 30 characters',
    err_name_taken: 'Name is already taken',
    err_no_session: 'Registration created, but login failed – is "Confirm email" turned off in Supabase under Authentication?',
    err_profile: 'Profile could not be created: {msg}',
    err_login: 'Wrong name or password',
  },
};

function tr(key, params) {
  const dict = I18N[state.lang] || I18N.de;
  let s = (dict[key] != null ? dict[key] : I18N.de[key]) ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, v);
  return s;
}

const localeFor = () => (state.lang === 'en' ? 'en-GB' : 'de-DE');

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

// Eine Partie ist (noch) keine echte Begegnung, wenn ein Team ein Platzhalter ist.
const hasPlaceholder = (m) => isPlaceholder(m.home_team) || isPlaceholder(m.away_team);

// Ein Platzhalter-Spiel wird nur ausgeblendet, wenn seine Runde bereits echte
// Paarungen enthält (= altes Duplikat). Steht die Runde noch aus (z. B. Finale,
// Spiel um Platz 3), bleibt der Platzhalter sichtbar/tippbar.
const isDuplicatePlaceholder = (m) =>
  hasPlaceholder(m) && state.realStages && state.realStages.has(stageKey(m.stage));

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
  lang: localStorage.getItem('tippspiel-lang') === 'en' ? 'en' : 'de',
  myStats: null,     // zuletzt berechnete eigene Punkte/Platzierung
  allTips: [],       // zuletzt geladene Tipps (für Rangliste wiederverwendet)
  lastUpdate: null,  // Zeitpunkt des letzten erfolgreichen Ladens
  refreshTimer: null,
  realStages: new Set(), // K.-o.-Runden, die schon echte Paarungen haben
};

const $ = (sel) => document.querySelector(sel);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const fmtTime = (iso) => new Date(iso).toLocaleTimeString(localeFor(), { hour: '2-digit', minute: '2-digit' });
const fmtDay = (iso) => new Date(iso).toLocaleDateString(localeFor(), { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShortDay = (iso) => new Date(iso).toLocaleDateString(localeFor(), { day: '2-digit', month: '2-digit' });

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = isError ? 'err' : '';
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2500);
}

// Punkteregeln: exakt / Tordifferenz / richtige Tendenz.
// Standard 4/3/2, im Finale 100/75/50.
const POINTS_DEFAULT = { exact: 4, diff: 3, tendency: 2 };
const POINTS_FINAL = { exact: 100, diff: 75, tendency: 50 };

// Welche Kategorie trifft der Tipp? -> 'exact' | 'diff' | 'tendency' | 'none' | null
function tipCategory(homeTip, awayTip, homeScore, awayScore) {
  if (homeScore === null || homeScore === undefined ||
      awayScore === null || awayScore === undefined) return null;
  if (homeTip === homeScore && awayTip === awayScore) return 'exact';
  if (homeTip - awayTip === homeScore - awayScore) return 'diff';
  if (Math.sign(homeTip - awayTip) === Math.sign(homeScore - awayScore)) return 'tendency';
  return 'none';
}

// Punkteschema je Spiel (Finale bekommt Sonderpunkte)
function schemeFor(match) {
  return match && stageKey(match.stage) === 'F' ? POINTS_FINAL : POINTS_DEFAULT;
}

function calcPoints(homeTip, awayTip, homeScore, awayScore, scheme = POINTS_DEFAULT) {
  const cat = tipCategory(homeTip, awayTip, homeScore, awayScore);
  if (cat === null) return null;
  return cat === 'none' ? 0 : scheme[cat];
}

// Anzeige-Übersetzungen für Gruppen-/Rundennamen aus den Datenquellen
function displayGroup(g) {
  if (!g) return null;
  const letter = g.replace(/^Group /, '').replace(/^GROUP_/, '').trim();
  return `${tr('group')} ${letter}`;
}

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

const stageName = (key) => tr('stage_' + key);

function displayStage(stage) {
  if (!stage) return null;
  const key = stageKey(stage);
  if (key) return stageName(key);
  const md = stage.match(/^Matchday (\d+)/);
  return md ? `${tr('matchday')} ${md[1]}` : stage;
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

function renderThemeList() {
  const list = $('#theme-list');
  const current = document.documentElement.dataset.theme;
  list.innerHTML = THEMES.map((id) => `
    <button class="theme-option ${current === id ? 'active' : ''}" data-theme-id="${id}">
      <span class="swatch swatch-${id}"></span>${esc(tr('theme_' + id))}
    </button>`).join('');
  list.querySelectorAll('.theme-option').forEach((btn) => {
    btn.onclick = () => {
      document.documentElement.dataset.theme = btn.dataset.themeId;
      localStorage.setItem('tippspiel-theme', btn.dataset.themeId);
      list.querySelectorAll('.theme-option').forEach((b) => b.classList.toggle('active', b === btn));
    };
  });
}

function setupThemes() {
  renderThemeList();
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

// ---------- Sprache ----------

function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = tr(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const v = tr(el.dataset.i18nTitle);
    el.title = v;
    if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', v);
  });
}

function renderAuthTexts() {
  const isLogin = state.authMode === 'login';
  $('#auth-title').textContent = tr(isLogin ? 'login_title' : 'register_title');
  $('#auth-submit').textContent = tr(isLogin ? 'login_submit' : 'register_submit');
  $('#auth-switch-text').textContent = tr(isLogin ? 'no_account' : 'have_account');
  $('#auth-switch-link').textContent = tr(isLogin ? 'do_register' : 'do_login');
}

function applyLanguage(lang) {
  state.lang = lang === 'en' ? 'en' : 'de';
  localStorage.setItem('tippspiel-lang', state.lang);
  document.documentElement.lang = state.lang;
  document.querySelectorAll('#lang-toggle .lang-opt')
    .forEach((b) => b.classList.toggle('active', b.dataset.lang === state.lang));
  applyStaticI18n();
  renderThemeList();
  renderAuthTexts();
  // Dynamisch erzeugte Inhalte neu rendern
  renderUserArea(state.myStats);
  $('#sync-info').textContent = tr('sync_info');
  renderLiveBar();
  renderMatches();
  renderTipReminder();
  if (!$('#tab-turnier').hidden) renderTurnier();
  if (!$('#tab-leaderboard').hidden) loadLeaderboard();
  if (!$('#tab-admin').hidden) { renderAdminMatches(); renderAdminUsers(); }
}

function setupLang() {
  document.querySelectorAll('#lang-toggle .lang-opt').forEach((btn) => {
    btn.onclick = () => applyLanguage(btn.dataset.lang);
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
  if (!email) throw new Error(tr('err_name_short'));
  if (name.trim().length > 30) throw new Error(tr('err_name_long'));

  // ilike-Sonderzeichen escapen, damit Namen wie "100%" sauber geprüft werden
  const pattern = name.trim().replace(/([%_\\])/g, '\\$1');
  const { data: taken } = await sb.from('profiles').select('id').ilike('name', pattern).limit(1);
  if (taken && taken.length) throw new Error(tr('err_name_taken'));

  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    if (/already registered/i.test(error.message)) throw new Error(tr('err_name_taken'));
    throw new Error(error.message);
  }
  if (!data.session) {
    throw new Error(tr('err_no_session'));
  }
  const { error: pErr } = await sb.from('profiles').insert({ id: data.user.id, name: name.trim() });
  if (pErr) throw new Error(tr('err_profile', { msg: pErr.message }));
}

async function login(name, password) {
  const email = nameToEmail(name);
  if (!email) throw new Error(tr('err_login'));
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(tr('err_login'));
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
      ? `<span class="my-stats">${icon('star', 'icon star-icon')} ${myStats.points} ${tr('pts_short')} · ${tr('rank')} ${myStats.rank}</span>` : '';
    el.innerHTML = `${stats}<span class="name">${esc(state.user.name)}</span>
      <button class="secondary" id="logout-btn">${tr('logout')}</button>`;
    $('#logout-btn').onclick = async () => {
      await sb.auth.signOut();
      state.user = null;
      if (!$('#tab-admin').hidden) switchToTab('matches');
      refreshAll();
    };
  } else {
    el.innerHTML = `<button id="show-login">${tr('login_register')}</button>`;
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
    renderAuthTexts();
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
      toast(tr('hello', { name: state.user?.name || name }));
      refreshAll();
    } catch (err) {
      $('#auth-error').textContent = err.message;
    }
  };
}

// ---------- Daten laden ----------

const CACHE_KEY = 'tippspiel-cache-v1';

// Baut state.matches aus rohen Spiel-/Tipp-Zeilen und rendert die Liste.
// Wird sowohl aus dem Cache (sofort) als auch nach dem Netzwerk-Fetch genutzt.
function buildMatches(matchRows, tipRows) {
  const tipsByMatch = new Map();
  for (const t of tipRows || []) {
    if (!tipsByMatch.has(t.match_ext_id)) tipsByMatch.set(t.match_ext_id, []);
    tipsByMatch.get(t.match_ext_id).push(t);
  }
  state.allTips = tipRows || [];

  const now = Date.now();
  const rows = (matchRows || []).slice()
    .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.ext_id.localeCompare(b.ext_id));
  state.matches = rows.map((m) => {
    const started = new Date(m.kickoff_utc).getTime() <= now;
    const matchTips = tipsByMatch.get(m.ext_id) || [];
    const myTip = state.user ? matchTips.find((t) => t.user_id === state.user.id) : null;
    // Während des Spiels provisorische Punkte gegen den aktuellen Stand (inkl. 0:0)
    const [esH, esA] = effectiveScore(m);
    const scheme = schemeFor(m);
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
            category: tipCategory(t.home_tip, t.away_tip, esH, esA),
            points: calcPoints(t.home_tip, t.away_tip, esH, esA, scheme),
          }))
        : null,
    };
  });
  // Welche K.-o.-Runden haben schon echte Paarungen? (für Duplikat-Erkennung)
  state.realStages = new Set();
  for (const m of state.matches) {
    if (!hasPlaceholder(m)) {
      const k = stageKey(m.stage);
      if (k) state.realStages.add(k);
    }
  }
  renderLiveBar();
  renderMatches();
  renderTipReminder();
}

// Letzte bekannte Daten sofort aus dem Cache anzeigen (gefühlt sofortiger Start)
function loadFromCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c && Array.isArray(c.matches) && c.matches.length) {
      state.lastUpdate = c.at || null;
      buildMatches(c.matches, c.tips || []);
      return true;
    }
  } catch { /* Cache ignorieren */ }
  return false;
}

async function loadMatches() {
  const [{ data: matches, error: mErr }, { data: tips }] = await Promise.all([
    sb.from('matches').select('ext_id, home_team, away_team, kickoff_utc, stage, group_name, venue, status, home_score, away_score')
      .order('kickoff_utc').order('ext_id'),
    // RLS liefert nur eigene Tipps + Tipps zu bereits angepfiffenen Spielen
    sb.from('tips').select('user_id, match_ext_id, home_tip, away_tip, profiles(name)'),
  ]);
  if (mErr) throw new Error(mErr.message);

  state.lastUpdate = Date.now();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ matches, tips: tips || [], at: state.lastUpdate }));
  } catch { /* localStorage evtl. voll – egal */ }

  buildMatches(matches, tips || []);
}

// ---------- Live-Bereich & adaptives Nachladen ----------

// Ein Spiel "läuft gerade", wenn die Quelle es als LIVE meldet ODER der
// Anstoß vorbei ist und es (noch) nicht beendet/abgesagt wurde. Das
// Zeitfenster (~2,5 h) verhindert, dass Spiele bei ausbleibendem
// Status-Update dauerhaft als live hängen bleiben.
function isInProgress(m) {
  if (m.status === 'LIVE') return true;
  if (m.status === 'FINISHED' || m.status === 'CANCELLED') return false;
  const start = new Date(m.kickoff_utc).getTime();
  const now = Date.now();
  return start <= now && now <= start + 150 * 60 * 1000;
}

// Anzuzeigendes Ergebnis: echtes Resultat, sonst nach Anstoß 0:0,
// davor [null, null] (-> "– : –").
function effectiveScore(m) {
  if (m.home_score !== null && m.away_score !== null) return [m.home_score, m.away_score];
  if (isInProgress(m) || m.status === 'FINISHED') return [m.home_score ?? 0, m.away_score ?? 0];
  return [null, null];
}

const liveMatches = () => state.matches.filter((m) => isInProgress(m) && !isDuplicatePlaceholder(m));

function freshnessText() {
  if (!state.lastUpdate) return '';
  const sec = Math.round((Date.now() - state.lastUpdate) / 1000);
  if (sec < 20) return tr('updated_just_now');
  if (sec < 60) return tr('updated_sec_ago', { n: sec });
  return tr('updated_min_ago', { n: Math.round(sec / 60) });
}

function renderLiveBar() {
  const el = $('#live-bar');
  if (!el) return;
  const live = liveMatches();
  if (!live.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `
    <div class="live-bar-head">
      <span class="live-dot"></span><strong>${tr('live_now')}</strong>
      <span class="live-fresh">${freshnessText()}</span>
    </div>
    ${live.map((m) => {
      const [hs, as] = effectiveScore(m);
      return `
      <div class="live-match">
        <span class="lm-team home">${esc(m.home_team)} ${flagFor(m.home_team)}</span>
        <span class="lm-score">${hs ?? 0} : ${as ?? 0}</span>
        <span class="lm-team away">${flagFor(m.away_team)} ${esc(m.away_team)}</span>
      </div>`; }).join('')}`;
}

// Laufende Spiele alle 30 s nachladen, sonst alle 75 s – spart Anfragen,
// hält Live-Ergebnisse aber so frisch wie die Datenquelle es erlaubt.
function startPolling() {
  clearTimeout(state.refreshTimer);
  const delay = liveMatches().length ? 30000 : 75000;
  state.refreshTimer = setTimeout(async () => {
    await loadMatches().catch(() => {});
    startPolling();
  }, delay);
}

// ---------- Spiele rendern ----------

function untippedUpcoming() {
  return state.matches.filter((m) =>
    !m.started && m.status === 'SCHEDULED' && !m.my_tip && !isDuplicatePlaceholder(m));
}

function filterMatches() {
  const now = Date.now();
  // Nur doppelte Platzhalter (deren Runde schon echte Paarungen hat) ausblenden;
  // noch ausstehende Runden wie Finale / Spiel um Platz 3 bleiben sichtbar.
  const base = state.matches.filter((m) => !isDuplicatePlaceholder(m));
  switch (state.filter) {
    case 'upcoming':
      return base.filter((m) => m.status === 'LIVE' ||
        (m.status !== 'FINISHED' && m.status !== 'CANCELLED' &&
         new Date(m.kickoff_utc).getTime() > now - 3 * 3600 * 1000));
    case 'finished':
      return base.filter((m) => m.status === 'FINISHED');
    case 'untipped':
      return untippedUpcoming();
    default:
      return base;
  }
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  let prefix = '';
  if (sameDay(d, today)) prefix = `<span class="today-flag">${tr('today')}</span>`;
  else if (sameDay(d, tomorrow)) prefix = `<span class="today-flag">${tr('tomorrow')}</span>`;
  return prefix + esc(fmtDay(iso));
}

function renderTipReminder() {
  const el = $('#tip-reminder');
  const open = state.user ? untippedUpcoming().length : 0;
  $('#filter-untipped').hidden = !state.user;
  if (!open) { el.hidden = true; return; }
  const msg = tr(open === 1 ? 'reminder_one' : 'reminder_many', { n: `<strong>${open}</strong>` });
  el.innerHTML = `${icon('pencil')} ${msg}<a id="show-untipped">${tr('reminder_link')}</a>`;
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
      ? `<p class="muted">${icon('check', 'icon ok-icon')} ${tr('all_tipped')}</p>`
      : `<p class="muted">${tr('no_matches_found')}</p>`;
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
            ? tr('tip_locked')
            : error.message);
        }
        toast(tr('tip_saved'));
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
    box.innerHTML = `<span class="muted small">${tr('loading')}</span>`;
    const { data, error } = await sb.rpc('tippers', { p_match_ext_id: extId });
    tippersCache.set(extId, error ? null : (data || []).map((r) => r.name));
  }
  const names = tippersCache.get(extId);
  if (names === null) {
    box.innerHTML = `<span class="muted small">${tr('tips_after_kickoff')}</span>`;
  } else if (!names.length) {
    box.innerHTML = `<span class="muted small">${tr('nobody_tipped_yet')}</span>`;
  } else {
    box.innerHTML = `<span class="muted small">${tr('already_tipped')}</span><br>` +
      names.map((n) => `<span class="tipper-chip">${esc(n)}</span>`).join('');
  }
}

function renderMatchCard(m) {
  const live = isInProgress(m);
  const statusBadge = live
    ? '<span class="badge live">LIVE</span>'
    : m.status === 'FINISHED'
      ? `<span class="badge finished">${tr('badge_finished')}</span>`
      : `<span class="badge scheduled">${fmtTime(m.kickoff_utc)}${tr('clock_suffix')}</span>`;

  const [hs, as] = effectiveScore(m);
  const score = (hs !== null && as !== null)
    ? `<div class="score">${hs} : ${as}</div>`
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
          <label>${tr('my_tip')}</label>
          <input class="tip-home" type="number" min="0" max="99" value="${h}" required>
          <span>:</span>
          <input class="tip-away" type="number" min="0" max="99" value="${a}" required>
          <button type="submit">${m.my_tip ? tr('change') : tr('tip')}</button>
          ${m.my_tip ? `<span class="my-tip-saved">${icon('check')}</span>` : ''}
        </form>`;
    } else {
      tipSection = `<div class="tip-row muted small">${tr('login_to_tip')}</div>`;
    }
    // Antippen zeigt, WER schon getippt hat (Tipps selbst erst ab Anpfiff)
    tipSection += `
      <div class="tippers-toggle">${tr('who_tipped')} ${icon('chevron', 'icon chev')}</div>
      <div class="tippers" hidden></div>`;
  } else if (m.all_tips && m.all_tips.length) {
    const rows = m.all_tips
      .slice()
      .sort((x, y) => (y.points ?? -1) - (x.points ?? -1) || x.user.localeCompare(y.user))
      .map((t) => `<tr class="${t.mine ? 'me' : ''}">
          <td>${esc(t.user)}</td>
          <td>${t.home} : ${t.away}</td>
          <td class="pts ${t.category ? 'pts-' + t.category : ''}">${t.points !== null ? t.points + ' ' + tr('pts_short') : ''}</td>
        </tr>`).join('');
    tipSection = `<div class="all-tips"><table>${rows}</table></div>`;
  } else if (m.started) {
    tipSection = `<div class="tip-row muted small">${tr('nobody_tipped')}</div>`;
  }

  return `
    <div class="match-card ${live ? 'is-live' : ''} ${upcoming ? 'clickable' : ''}" data-match="${esc(m.ext_id)}">
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
        <thead><tr><th class="t">${tr('st_team')}</th><th>${tr('st_p')}</th><th>${tr('st_goals')}</th><th>±</th><th>${tr('st_pts')}</th></tr></thead>
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
    </div>`).join('') || `<p class="muted">${tr('no_group_matches')}</p>`;
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
  // Pro Runde: sobald echte Paarungen feststehen, Platzhalter ausblenden
  // (entfernt die doppelten "2A – 2B"-Altlasten; künftige Runden ohne echte
  // Teams behalten ihre Platzhalter als Struktur).
  for (const [key, arr] of byStage) {
    const real = arr.filter((m) => !hasPlaceholder(m));
    if (real.length) byStage.set(key, real);
  }
  for (const arr of byStage.values()) arr.sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));

  const matchCard = (m, extraClass = '') => {
    const finished = m.status === 'FINISHED';
    const live = isInProgress(m);
    const badge = live ? '<span class="badge live">LIVE</span>'
      : finished ? '' : `<span>${fmtShortDay(m.kickoff_utc)} · ${fmtTime(m.kickoff_utc)}</span>`;
    const [hs, as] = effectiveScore(m);
    return `
      <div class="bracket-match ${extraClass}">
        <div class="bm-meta"><span>${esc(m.venue || '')}</span>${badge}</div>
        ${bracketTeamHtml(m.home_team, hs, as, finished)}
        ${bracketTeamHtml(m.away_team, as, hs, finished)}
      </div>`;
  };

  const cols = ['R32', 'R16', 'QF', 'SF'].map((key) => {
    const matches = byStage.get(key) || [];
    if (!matches.length) return '';
    return `<div class="bracket-col"><h3>${stageName(key)}</h3>${matches.map((m) => matchCard(m)).join('')}</div>`;
  }).join('');

  const finals = byStage.get('F') || [];
  const third = byStage.get('P3') || [];
  const finalCol = (finals.length || third.length) ? `
    <div class="bracket-col final-col">
      <h3>${icon('trophy')} ${stageName('F')}</h3>
      ${finals.map((m) => matchCard(m, 'final-match')).join('')}
      ${third.length ? `<div class="bracket-p3-label">${stageName('P3')}</div>${third.map((m) => matchCard(m)).join('')}` : ''}
    </div>` : '';

  $('#bracket').innerHTML = (cols + finalCol) || `<p class="muted">${tr('no_ko_matches')}</p>`;
}

function renderTurnier() {
  renderStandings();
  renderBracket();
}

// ---------- Rangliste ----------

async function computeLeaderboard() {
  const { data: profiles } = await sb.from('profiles').select('id, name');
  // Tipps aus dem letzten Spiele-Laden wiederverwenden (spart eine Abfrage);
  // sie enthalten bereits alle für die Wertung nötigen (beendeten) Spiele.
  const tips = (state.allTips && state.allTips.length)
    ? state.allTips
    : (await sb.from('tips').select('user_id, match_ext_id, home_tip, away_tip')).data;
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
    const cat = tipCategory(t.home_tip, t.away_tip, m.home_score, m.away_score);
    if (cat === null) continue;
    s.tipped++;
    s.points += cat === 'none' ? 0 : schemeFor(m)[cat];
    if (cat === 'exact') s.exact++;
    else if (cat === 'diff') s.diff++;
    else if (cat === 'tendency') s.tendency++;
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
      <td class="lb-avg">${u.tipped > 0
        ? (u.points / u.tipped).toLocaleString(localeFor(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : '–'}</td>
    </tr>`).join('') || `<tr><td colspan="8" class="muted">${tr('no_players')}</td></tr>`;
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
      <button type="submit" class="secondary">${tr('save_btn')}</button>
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
        toast(tr('saved'));
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
    .join('') || `<option value="">${tr('no_players_opt')}</option>`;
}

function setupAdmin() {
  $('#admin-search').oninput = () => renderAdminMatches();
  $('#reset-pw-form').onsubmit = async (e) => {
    e.preventDefault();
    const sel = $('#rp-user');
    const userId = sel.value;
    const name = sel.selectedOptions[0]?.textContent || '';
    const pass = $('#rp-pass').value;
    if (!userId) { toast(tr('choose_player'), true); return; }
    try {
      const { error } = await sb.rpc('admin_reset_password', {
        p_user_id: userId,
        p_new_password: pass,
      });
      if (error) throw new Error(error.message);
      toast(tr('pw_set_for', { name }));
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
      toast(tr('match_added'));
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
  renderUserArea(state.myStats);
  try {
    await loadMatches();
    $('#sync-info').textContent = tr('sync_info');
    if (state.user) {
      const leaderboard = await computeLeaderboard();
      state.myStats = leaderboard.find((u) => u.id === state.user.id) || null;
      renderUserArea(state.myStats);
      if (state.user.is_admin) renderAdminUsers();
    } else {
      state.myStats = null;
    }
    if (!$('#tab-turnier').hidden) renderTurnier();
  } catch (err) {
    $('#matches-list').innerHTML = `<p class="error">${tr('load_error', { msg: esc(err.message) })}</p>`;
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
  setupLang();
  setupTabs();
  setupAuthForm();
  setupAdmin();
  applyLanguage(state.lang); // statische Texte + Sprachschalter initialisieren
  loadFromCache();           // letzte bekannte Spiele sofort zeigen
  await loadProfile();
  await refreshAll();
  startPolling();            // adaptiv: schneller bei Live-Spielen
  // Frische-Anzeige im Live-Bereich mitlaufen lassen (ohne Netzwerk)
  setInterval(() => { if (!$('#live-bar').hidden) renderLiveBar(); }, 15000);
})();
