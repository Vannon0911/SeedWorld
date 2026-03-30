# T01 Inventur Legacy / Wrapper / Fallback

## Status
- T01 ist **widerlegt**. Die vorige Inventur war als Einstieg brauchbar, aber nicht belastbar genug fuer eine echte Delete/Migrate/Keep-Entscheidung.
- Hauptfehler: Sie blieb auf Modulebene stehen und hat mehrere konkrete Fallback-Branches sowie den Referenzgraphen nur angedeutet.

## Verifizierte Stellen

| Pfad | Konkrete Fundstelle | Rolle | Referenz-/Caller-Graph | Status |
|---|---|---|---|---|
| `docs/INDEX.md:42` | Link auf `legacy/UNVERFID/CANDIDATES.md` | Navigationsreferenz auf das Archiv | wird von `docs/INDEX.md` und `dev/tools/runtime/syncDocs.mjs` gespiegelt | KEEP |
| `dev/tools/runtime/syncDocs.mjs:103` | Link auf `legacy/UNVERFID/CANDIDATES.md` | Sync-Referenz fuer Docs-Index | dieselbe Archivreferenz wie im Docs-Index | KEEP |
| `legacy/UNVERFID/**` | gesamter Archivbaum | isoliertes Altmaterial | nur noch ueber Navigations- und Sync-Referenzen sichtbar | KEEP |
| `app/src/ui/BaseUIController.js:25-30, 53-70, 92-110, 123-130, 218-230` | Plugin-, Hook- und Listener-Wrapping | technische Basis, keine Loeschkandidatur | laut `app/src/sot/REPO_HYGIENE_MAP.json` haben `DevUIController.js`, `GameUIController.js` und `MainMenuController.js` Inbound-Bezug auf diese Basis | KEEP |
| `app/src/ui/MainMenuController.js:241-252, 282-303` | dynamischer Controller-Loader plus Kernel-Fallback auf direkte `kernelInterface(...)`-Calls | Wrapper-/Fallback-Branch bleibt aktiv | Graph-Hub zu `GameUIController.js` und `DevUIController.js`; die Fallback-Branches sitzen direkt im Controller | MIGRATE |
| `app/src/ui/UIController.js:253-343` | `#ensureTileGrid()`, `#bindViewport()`, `#ensureWorldState()` | lokale Fallbacks fuer Grid, Viewport und Weltgenerierung | `app/src/main.js` instanziiert `UIController`; `UIController` greift bei Bedarf auf `app/src/game/worldGen.js` zurueck | MIGRATE/REDUCE |
| `dev/tools/runtime/preflight-mutation-guard.mjs:103-116, 212-217, 447-490, 684-731` | Legacy-State- und Lock-Handling | Runtime-Kompatibilitaet fuer bereits existierende Altzustaende | keine Loeschung vor End-to-End-Nachweis, dass keine Legacy-Locks mehr entstehen | KEEP |
| `app/public/game.html:382-409` | Worker-Fallback und No-Worker-Fallback auf `IsometricWorldGen` | Browser-Fallback im World-Render-Pfad | erzeugt die zweite Render-Route neben dem Worker-Branch | MIGRATE/REDUCE |
| `app/src/ui/DevUIController.js` | aktiver UI-Consumer | kein Legacy-Artefakt, aber Teil des Inbound-Graphen fuer `BaseUIController` | wird vom Main-Menu-Graphen dynamisch adressiert | KEEP |
| `app/src/ui/GameUIController.js` | aktiver UI-Consumer | kein Legacy-Artefakt, aber Teil des Inbound-Graphen fuer `BaseUIController` | wird vom Main-Menu-Graphen dynamisch adressiert | KEEP |

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
- `app/public/game.html -> app/src/SeedWorld_WorldGen.mjs`
- `app/public/game.html -> app/src/workers/worldRenderWorker.js`

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
- `BaseUIController.js`: **KEEP**
- `MainMenuController.js`: **MIGRATE**
- `UIController.js`: **MIGRATE/REDUCE**
- `preflight-mutation-guard.mjs`: **KEEP**
- `app/public/game.html`: **MIGRATE/REDUCE**

## Offene Verifikationen vor Delete
- Der Report braucht weiterhin einen expliziten Abgleich, welche der `UIController`-Fallbacks wirklich noch gebraucht werden.
- Der World-Render-Pfad muss erst dann auf einen einzigen Primaerweg reduziert werden, wenn Worker- und Fallback-Route gleiche Ergebnisse liefern.
- `legacy/UNVERFID` darf erst raus, wenn keine produktive Navigation mehr darauf zeigt.
