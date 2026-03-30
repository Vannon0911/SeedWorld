# Remaining Task Stubs

Diese Datei enthaelt die offenen Aufgaben ohne `[CHECK]`-Marker aus `tem/beide-plaene.md` und `tem/langfristiger-bug-plan.md`. Sie ist bewusst als Stub-Sammlung gehalten: kurz, direkt, und mit klarer Verifikation.

## Canvas-First Plan
| Task | Stub | Dateien/Module | Check/Test |
|---|---|---|---|
| CF-003 | Einen einzigen aktiven Frame-Scheduler festziehen; der Canvas-Loop darf nicht doppelt laufen. | `app/src/ui/TileAnimationSDK.js`, `app/src/ui/UIController.js`, `app/src/ui/RenderManager.js`, `app/src/main.js`, `app/public/game.html` | `test:playwright:fulltiles`, Browser-Konsole auf doppelte Frames und Flackern pruefen. |
| CF-004 | Die Tile-Basisdarstellung auf Canvas ziehen; DOM bleibt nur Referenz. | `app/src/ui/TileGridRenderer.js`, `app/src/ui/TileAnimationSDK.js`, `app/src/ui/RenderManager.js`, `app/src/ui/UIController.js`, `app/src/ui/GameUIController.js`, `app/public/game.html`, `app/src/ui/tileGrid.css` | `npm test`, visueller Smoke, Screenshot-/Layout-Abgleich. |
| CF-005 | Hover, Selection, Icons und Effekte als Canvas-Layer nachziehen. | `Interaction-Visuals`, `Effect-Renderer`, `Icon-Atlas`, `RenderManager`, `UIController` | Playwright-Interaktionssmoke, Overlay- und Z-Order-Check. |
| CF-006 | World-/Voxel-Hintergrund in denselben Koordinatenraum ziehen. | `World-Background/Voxel-Renderer`, `RenderManager`, `UIController` | Resize-/Zoom-Smoke, Deckungsgleichheit bei Pan/Zoom pruefen. |
| CF-007 | SVG auf Linien/Pulse reduzieren und die Layer-Reihenfolge sauber halten. | `SVG-Overlay-Komponente`, `Overlay-Controller`, `RenderManager` | Visueller Smoke nach Resize/Zoom, keine Lageverschiebung. |
| CF-008 | Pointer-Hit-Testing von DOM-Rechtecken auf `screenToTile` umstellen. | `Pointer-/Mouse-Handler`, `Selection-Controller`, `RenderManager` | Edge-/Corner-Smoke, High-DPI- und Grenzpixel-Fall pruefen. |
| CF-009 | DOM-Grid abbauen und DOM nur fuer HUD/Panel behalten. | `Grid-Component`, `HUD/Panel-Container`, `CSS/Layout` | Browser-Smoke, keine visuellen Tiles mehr im DOM, HUD bleibt intakt. |
| CF-010 | Debug-State und `render_game_to_text` um Canvas-Sicht erweitern. | `Debug-State-Serializer`, `render_game_to_text`, `Dev-Overlay` | Debug-Ausgabe mit viewport, tile hit, selection und entity layer vergleichen. |
| CF-011 | Deckungsgleichheit, Resize/Zoom und SVG-Overlay mit Tests absichern. | `E2E/Playwright`, `Visual-Regression-Tests` | `test:playwright:fulltiles`, Screenshot-Vergleich, Konsolenfehlerfrei. |
| CF-012 | Canvas-Hit-Testing, HUD und Smoke-Automation stabilisieren. | `Interaction-Tests`, `Smoke-Suite`, `CI-Testjob` | Edge-/Corner-Interaktionen plus HUD-Flow in Automation gruens halten. |

## Legacy- und Wrapper-Plan
| Task | Stub | Dateien/Module | Check/Test |
|---|---|---|---|
| T04 | Den BaseUIController-Cluster auf die kanonische API migrieren. | `app/src/ui/BaseUIController.js`, Consumer-Module | `check:required`, `npm test`, `test:playwright:fulltiles`. |
| T05 | Den MainMenuController-Cluster migrieren. | `app/src/ui/MainMenuController.js`, Consumer-Module | Browser-Interaktionstest, `npm test`, kein Fallback-Branch im migrierten Cluster. |
| T06 | Den UIController-Cluster auf die Ziel-Events/APIs umziehen. | `app/src/ui/UIController.js`, Consumer-Module | Eventfluss pruefen, `npm test`, kein Legacy-Wrapper mehr im Cluster. |
| T07 | World-Render-Fallbacks auf das noetige Minimum reduzieren. | World-Render-Module, Renderer, Bootstrap | Browser-Smoke, dokumentierte Restfaelle, keine verdeckte Fallback-Aktivierung. |
| T08 | `app/public/game.html` von ueberfluessigen Fallbacks bereinigen. | `app/public/game.html` | E2E-/Interaktionstest, keine toten Script-Pfade mehr. |
| T09 | Event-/Interface-Wrapper entfernen, sobald die Caller komplett migriert sind. | Wrapper-Module, betroffene Imports | `rg` ohne produktive Treffer, Build + Tests gruen. |
| T10 | Legacy-Code und tote Acceptance-Pfade loeschen. | Legacy-Ordner/Dateien, Navigation-Konfig | Keine unerreichbaren Pfade, Navigation nur mit aktiven Features. |
| T11 | Obsolete JSON-/Schema-/Manifest-Artefakte bereinigen. | JSON, Schema, Manifest-Dateien | Loader- und Schema-Validierung ohne Fehler. |
| T12 | Adapter erst nach nachgewiesener Caller-Migration final entfernen. | Adapter-Module | Referenzgraph auf 0 produktive Adapter-Caller, Pflichttests gruen. |
| T13 | SoT-Dateien und Baselines synchronisieren. | `FUNCTION_SOT`, `REPO_HYGIENE_MAP`, Docs-Index, Release-/Test-Baselines | Integritaets-Checks, `npm test`, `npm run evidence:verify`. |

## Long-Term Bug Plan
| Task | Stub | Dateien/Module | Check/Test |
|---|---|---|---|
| P0-1 | Die fehlende `jszip`-Abhaengigkeit im Evidence-Bundle-Skript beheben oder den Import entfernen. | `dev/scripts/build-evidence-bundle.mjs`, `package.json`, `package-lock.json` | `npm run evidence:bundle` laeuft in sauberer Installation ohne Modul-Load-Fehler. |
| P0-2 | Einen Bootstrap-Regressionstest fuer RenderManager-Resize und TileGridRenderer-Synchronisation anlegen. | `app/src/main.js`, `app/src/ui/RenderManager.js`, `app/src/ui/TileGridRenderer.js` | Resize-/Grid-Resync-Test ist gruen und belegt den Live-Pfad. |
| P0-3 | Den Update-Pfad fuer `app/src/sot/testline-integrity.json` auf den kanonischen Updater festziehen. | `app/src/sot/testline-integrity.json`, `dev/tools/runtime/update-testline-integrity.mjs` | Datei wird nur noch ueber den Updater geaendert, Verifikation bleibt gruen. |
| P1-1 | `RenderManager` als alleinige Geometriequelle fuer Koordinaten- und Hit-Test-Pfade absichern. | `RenderManager`, Koordinaten- und Hit-Test-Verbraucher | Alle Berechnungen laufen nachweislich ueber die zentrale Geometriequelle. |
| P1-2 | Einen Live-Resync fuer dynamische `gridBounds` und Viewport-Werte implementieren. | `RenderManager`, `TileGridRenderer`, Bootstrap-/Resize-Pfade | Geometrie bleibt nach init, resize und zoom synchron. |
| P1-3 | Resize-, Zoom- und Edge-Hit-Tests fuer Eingabe und Darstellung erweitern. | QA, Playwright, Interaktions-Smokes | Automatisierte Tests decken Standardfall und Grenzfaelle ab und laufen stabil in CI. |
| P2-1 | Legacy- und Fallback-Zweige in `app/public/game.html` und Runtime-Guards minimieren. | `app/public/game.html`, Runtime-Guards | Nur noetige Ersatzpfade bleiben, Rest ist dokumentiert oder entfernt. |
| P2-2 | Evidence- und Determinismus-Gates fuer Release- und Merge-Prozesse verbindlich machen. | Release-/Governance-Checks, Evidence-Workflows | `npm test`, `npm run evidence:verify` und Integrity-Checks sind Pflichtgates. |
