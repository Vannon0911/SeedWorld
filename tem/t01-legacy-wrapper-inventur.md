# T01 Inventur Legacy / Wrapper / Fallback
## Status
- T01 ist **widerlegt**. Die vorige Inventur war als Einstieg brauchbar, aber nicht belastbar genug fuer eine echte Delete/Migrate/Keep-Entscheidung.
- Hauptfehler: Sie blieb auf Modulebene stehen und hat mehrere konkrete Fallback-Branches sowie den Referenzgraphen nur angedeutet.
- Zusatzzwang seit `2026-03-31`: Wrapper-Expiry fuer die aktive Restmenge spaetestens `2026-04-06` absichern. Offene Wrapper ohne Exit-Pfad gelten ab dann nicht mehr als neutrale Altlast, sondern als Eskalationsobjekt.

## Verifizierte Stellen

| Pfad | Konkrete Fundstelle | Rolle | Referenz-/Caller-Graph | Status |
|---|---|---|---|---|
| `docs/INDEX.md:42` | Link auf `legacy/UNVERFID/CANDIDATES.md` | Navigationsreferenz auf das Archiv | wird von `docs/INDEX.md` und `dev/tools/runtime/syncDocs.mjs` gespiegelt | KEEP |
| `dev/tools/runtime/syncDocs.mjs:103` | Link auf `legacy/UNVERFID/CANDIDATES.md` | Sync-Referenz fuer Docs-Index | dieselbe Archivreferenz wie im Docs-Index | KEEP |
| `legacy/UNVERFID/**` | gesamter Archivbaum | isoliertes Altmaterial | nur noch ueber Navigations- und Sync-Referenzen sichtbar | KEEP |
| `app/src/ui/BaseUIController.js` | Plugin-, Hook- und Listener-Wrapping | tote Basis fuer geloeschten Legacy-Stack | mit Entfernung von `DevUIController.js`, `GameUIController.js` und `MainMenuController.js` ohne produktiven Inbound | REMOVE |
| `app/src/ui/MainMenuController.js` | dynamischer Controller-Loader plus Kernel-Fallback auf direkte `kernelInterface(...)`-Calls | toter Wrapper-/Fallback-Branch | kein produktiver Inbound, nur Legacy-Graph zu geloeschten UI-Controllern | REMOVE |
| `app/src/ui/UIController.js:253-343` | `#ensureTileGrid()`, `#bindViewport()`, `#ensureWorldState()` | lokale Fallbacks fuer Grid, Viewport und Weltgenerierung | `app/src/main.js` instanziiert `UIController`; `UIController` greift bei Bedarf auf `app/src/game/worldGen.js` zurueck | MIGRATE/REDUCE |
| `dev/tools/runtime/preflight-mutation-guard.mjs:103-116, 212-217, 447-490, 684-731` | Legacy-State- und Lock-Handling | Runtime-Kompatibilitaet fuer bereits existierende Altzustaende | keine Loeschung vor End-to-End-Nachweis, dass keine Legacy-Locks mehr entstehen | KEEP |
| `app/public/game.html` | Browser-Bootstrap ohne Worker-/WorldGen-Fallback | Fallback-Skriptpfad wurde entfernt | nur noch aktiver Bootstrap fuer `main.js` plus Radial-Build-Controller | REDUCED |
| `app/src/ui/DevUIController.js` | Entwickleroberflaeche ausserhalb des Pflichtpfads | nur ueber geloeschtes Main Menu erreichbar | kein produktiver Inbound im Kernel-/Repro-Kern | REMOVE |
| `app/src/ui/GameUIController.js` | alter Spiel-UI-Pfad ausserhalb des Pflichtpfads | nur ueber geloeschtes Main Menu erreichbar | paralleler UI-Pfad neben `UIController.js` ohne Pflichtwert | REMOVE |

## Referenzgraph

### Archiv / Navigation
- `docs/INDEX.md -> legacy/UNVERFID/CANDIDATES.md`
- `dev/tools/runtime/syncDocs.mjs -> legacy/UNVERFID/CANDIDATES.md`

### UI-Basis
- `app/src/ui/DevUIController.js -> app/src/ui/BaseUIController.js`
- `app/src/ui/GameUIController.js -> app/src/ui/BaseUIController.js`
- `app/src/ui/MainMenuController.js -> app/src/ui/BaseUIController.js`
- `app/src/ui/MainMenuController.js -> app/src/ui/DevUIController.js` via `import('./DevUIController.js')`
- `app/src/ui/MainMenuController.js -> app/src/ui/GameUIController.js` via `import('./GameUIController.js')`

### Runtime / World
- `app/src/main.js -> app/src/ui/UIController.js`
- `app/src/ui/UIController.js -> app/src/game/worldGen.js`

### SOT-Einordnung
- `app/src/sot/REPO_HYGIENE_MAP.json` bestaetigt die Inbound-Zaehlung:
  - `BaseUIController.js`: 3
  - `DevUIController.js`: 1
  - `GameUIController.js`: 1
  - `MainMenuController.js`: 0
  - `UIController.js`: 1
  - `dev/tools/runtime/preflight-mutation-guard.mjs`: 0

## Bewertung
- `legacy/UNVERFID/**`: **KEEP**
- `BaseUIController.js`: **REMOVE**
- `MainMenuController.js`: **REMOVE**
- `UIController.js`: **MIGRATE/REDUCE**
- `preflight-mutation-guard.mjs`: **KEEP**
- `app/public/game.html`: **REDUCED**

## Offene Verifikationen vor Delete
- Der Report braucht weiterhin einen expliziten Abgleich, welche der `UIController`-Fallbacks wirklich noch gebraucht werden.
- `legacy/UNVERFID` darf erst raus, wenn keine produktive Navigation mehr darauf zeigt.
