# ⚽ WM 2026 Tippspiel

Eine kleine Web-App, mit der du und deine Familie auf die Spiele der
Fußball-WM 2026 tippen könnt. Alle WM-Spiele werden automatisch geladen,
Ergebnisse werden live eingeblendet und jeder Tipp wird dauerhaft gespeichert.

## Features

- **Tippen auf alle WM-Spiele** – Tipps können bis zum Anpfiff geändert werden, danach sind sie gesperrt
- **Tipps bleiben gespeichert** – nach Anpfiff sieht jeder die Tipps aller Mitspieler (vorher kann niemand abschreiben)
- **Live-Ergebnisse per API** – automatischer Abgleich mit [football-data.org](https://www.football-data.org) (kostenloser API-Key) oder ohne Key mit [openfootball](https://github.com/openfootball/worldcup.json)
- **Rangliste** mit klassischen Tippspiel-Punkten:
  - 🎯 **4 Punkte** – exaktes Ergebnis
  - ± **3 Punkte** – richtige Tordifferenz
  - ↑ **2 Punkte** – richtige Tendenz (Sieger richtig)
- **Admin-Bereich** – Ergebnisse manuell eintragen/korrigieren und Spiele anlegen (falls die API mal ausfällt)
- Einfache Konten mit Name + Passwort, mobiltauglich, dunkles Design

## Schnellstart

Voraussetzung: [Node.js](https://nodejs.org) ab Version 22.13.

```bash
npm install
npm start
```

Dann im Browser öffnen: **http://localhost:3000**

> Die **erste Person, die sich registriert, wird automatisch Admin.**

## Live-Ergebnisse einrichten (empfohlen)

1. Kostenlosen API-Key holen: https://www.football-data.org/client/register
   (der Free-Tier enthält die FIFA-WM)
2. Datei `.env` anlegen (Vorlage: `.env.example`):

   ```
   FOOTBALL_DATA_API_KEY=dein_key_hier
   ```

3. Server neu starten. Ergebnisse werden nun **alle 2 Minuten** abgeglichen,
   laufende Spiele erscheinen mit LIVE-Badge.

Ohne API-Key nutzt die App automatisch die freien openfootball-Daten –
die werden allerdings nur etwa täglich aktualisiert. Als Admin kannst du
Ergebnisse jederzeit manuell eintragen; manuell gesetzte Ergebnisse werden
vom Auto-Sync nicht überschrieben.

## Im Heimnetz / Internet freigeben

- **Heimnetz:** Server starten und Familienmitgliedern die Adresse geben,
  z. B. `http://192.168.1.23:3000` (IP des Rechners im WLAN).
- **Internet:** am einfachsten über einen kleinen Node-Hoster
  (z. B. Railway, Render, Fly.io) oder einen Raspberry Pi mit
  Portfreigabe/VPN. Es ist nur `npm install && npm start` nötig.

Alle Daten liegen in einer SQLite-Datei unter `data/tippspiel.sqlite` –
für ein Backup reicht es, diese Datei zu kopieren.

## Punktewertung im Detail

| Tipp | Ergebnis | Punkte |
|------|----------|--------|
| 2:1  | 2:1      | 4 (exakt) |
| 2:1  | 3:2      | 3 (Tordifferenz) |
| 1:1  | 2:2      | 3 (Tordifferenz/Remis) |
| 2:0  | 1:0      | 2 (Tendenz) |
| 2:1  | 1:2      | 0 |

Gewertet werden nur beendete Spiele (Endstand nach 90 Minuten bzw.
das von der API gemeldete Endergebnis).

## Tests

```bash
npm test
```
