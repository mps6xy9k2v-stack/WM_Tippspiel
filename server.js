'use strict';

// Mini-.env-Loader, damit keine extra Dependency nötig ist
const fs = require('node:fs');
const path = require('node:path');
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const express = require('express');
const cookieSession = require('cookie-session');
const { getSessionSecret } = require('./src/db');
const routes = require('./src/routes');
const { startScheduler } = require('./src/sync');

const app = express();
app.use(express.json());
app.use(cookieSession({
  name: 'tippspiel',
  secret: getSessionSecret(),
  maxAge: 90 * 24 * 60 * 60 * 1000, // 90 Tage – reicht für die ganze WM
  sameSite: 'lax',
  httpOnly: true,
}));

app.use('/api', routes);
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WM-Tippspiel läuft auf http://localhost:${PORT}`);
  startScheduler();
});
