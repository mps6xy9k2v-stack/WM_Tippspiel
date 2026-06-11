# ⚽ WM 2026 Tippspiel

Eine kleine Web-App, mit der du und deine Familie auf die Spiele der
Fußball-WM 2026 tippen könnt. Alle WM-Spiele werden automatisch geladen,
Ergebnisse werden automatisch eingeblendet und jeder Tipp wird dauerhaft
gespeichert.

## Features

- **Tippen auf alle WM-Spiele** – Tipps können bis zum Anpfiff geändert werden, danach sind sie gesperrt
- **Tipps bleiben gespeichert** – nach Anpfiff sieht jeder die Tipps aller Mitspieler (vorher kann niemand abschreiben)
- **Automatische Ergebnisse per API** – von [football-data.org](https://www.football-data.org) (kostenloser API-Key) oder ohne Key von [openfootball](https://github.com/openfootball/worldcup.json)
- **Rangliste** mit klassischen Tippspiel-Punkten:
  - 🎯 **4 Punkte** – exaktes Ergebnis
  - ± **3 Punkte** – richtige Tordifferenz
  - ↑ **2 Punkte** – richtige Tendenz (Sieger richtig)
- **Admin-Bereich** – Ergebnisse manuell eintragen/korrigieren und Spiele anlegen (falls die API mal ausfällt)
- Einfache Konten mit Name + Passwort, mobiltauglich, dunkles Design

Es gibt **zwei Betriebsarten** (mit getrennten Daten – eine auswählen):

| | 🌍 Variante A: GitHub Pages | 🏠 Variante B: Eigener Server |
|---|---|---|
| Spielen über | `https://<name>.github.io/WM_Tippspiel/` | Heimnetz / eigenen Node-Server |
| Daten liegen in | Supabase (kostenlos) | SQLite-Datei auf dem Rechner |
| Ergebnis-Update | GitHub Action, alle 15 Min | Server-Prozess, alle 2 Min |
| Voraussetzung | GitHub- + Supabase-Konto | Rechner, auf dem Node.js läuft |

---

## 🌍 Variante A: Über GitHub Pages spielen

GitHub Pages kann nur statische Dateien ausliefern. Damit Tipps und Konten
trotzdem für alle gemeinsam gespeichert werden, nutzt diese Variante die
kostenlose Datenbank [Supabase](https://supabase.com). Eine GitHub Action
holt regelmäßig die aktuellen Ergebnisse und schreibt sie in die Datenbank.

### 1. Supabase einrichten (~10 Minuten, kostenlos)

1. Auf https://supabase.com ein kostenloses Konto und ein neues Projekt anlegen.
2. Im Dashboard **SQL Editor** öffnen, den kompletten Inhalt von
   [`supabase/setup.sql`](supabase/setup.sql) einfügen und ausführen.
   Das legt die Tabellen und alle Zugriffsregeln an (Tipp-Sperre ab Anpfiff usw.).
3. Unter **Authentication → Sign In / Up → Email** die Option
   **„Confirm email“ ausschalten** (die App nutzt Pseudo-E-Mail-Adressen,
   es werden nie echte Mails verschickt).
4. Unter **Settings → API** zwei Werte herauskopieren:
   - **Project URL** (z. B. `https://abcdefgh.supabase.co`)
   - **anon public** Key

### 2. Frontend konfigurieren

`docs/config.example.js` nach `docs/config.js` kopieren und die beiden Werte
eintragen. Die Datei ganz normal committen – der „anon public“-Key darf
öffentlich sein, die Zugriffsregeln aus Schritt 1 schützen die Daten.

### 3. GitHub Pages aktivieren

Im Repository: **Settings → Pages → Build and deployment**:
- Source: **Deploy from a branch**
- Branch: **main**, Ordner: **/docs**

Nach 1–2 Minuten ist die Seite unter
`https://<dein-github-name>.github.io/WM_Tippspiel/` erreichbar.

### 4. Ergebnis-Sync einrichten

Im Repository unter **Settings → Secrets and variables → Actions** drei
Secrets anlegen:

| Secret | Wert |
|---|---|
| `SUPABASE_URL` | Project URL aus Schritt 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** Key (Settings → API, geheim halten!) |
| `FOOTBALL_DATA_API_KEY` | optional: kostenloser Key von [football-data.org](https://www.football-data.org/client/register) |

Die Action **„Ergebnisse synchronisieren“** läuft dann automatisch alle
15 Minuten (auf dem Standard-Branch). Einmalig manuell anstoßen:
**Actions → Ergebnisse synchronisieren → Run workflow** – damit werden alle
104 WM-Spiele in die Datenbank geladen.

> Ohne `FOOTBALL_DATA_API_KEY` kommen die Ergebnisse von openfootball und
> aktualisieren sich nur etwa täglich. Mit Key sind sie quasi live
> (so aktuell, wie die Action läuft – GitHub führt Cron-Jobs manchmal mit
> ein paar Minuten Verzögerung aus).

### 5. Losspielen

Seite öffnen, registrieren, tippen. **Die erste Person, die sich
registriert, wird automatisch Admin** und kann im Admin-Tab Ergebnisse
manuell korrigieren.

---

## 🏠 Variante B: Eigener Server (Heimnetz)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 22.13.

```bash
npm install
npm start
```

Dann im Browser öffnen: **http://localhost:3000** – Familienmitglieder im
selben WLAN nutzen die IP des Rechners, z. B. `http://192.168.1.23:3000`.

Auch hier wird die erste registrierte Person Admin. Alle Daten liegen in
`data/tippspiel.sqlite` – für ein Backup reicht es, die Datei zu kopieren.

Für **Live-Ergebnisse** (Abgleich alle 2 Minuten): `.env` anlegen
(Vorlage `.env.example`) und den kostenlosen API-Key von
football-data.org eintragen, dann Server neu starten. Ohne Key nutzt der
Server automatisch die openfootball-Daten (ca. täglich aktualisiert).

---

## Punktewertung im Detail

| Tipp | Ergebnis | Punkte |
|------|----------|--------|
| 2:1  | 2:1      | 4 (exakt) |
| 2:1  | 3:2      | 3 (Tordifferenz) |
| 1:1  | 2:2      | 3 (Tordifferenz/Remis) |
| 2:0  | 1:0      | 2 (Tendenz) |
| 2:1  | 1:2      | 0 |

Gewertet werden nur beendete Spiele (das von der API gemeldete Endergebnis).

## Projektstruktur

```
docs/                  Statisches Frontend für GitHub Pages (Variante A)
supabase/setup.sql     Datenbank-Schema + Zugriffsregeln für Supabase
scripts/sync-supabase.js  Ergebnis-Sync der GitHub Action
.github/workflows/     GitHub Action (Cron alle 15 Minuten)
server.js, src/        Node-Server mit SQLite (Variante B)
public/                Frontend der Server-Variante
test/                  Unit-Tests (npm test)
```
