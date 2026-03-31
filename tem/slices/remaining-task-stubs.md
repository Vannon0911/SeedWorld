# Remaining Task Legacy Summary

Stand: `2026-03-31`

Diese Datei ist nicht mehr fuehrend. Der maschinenfuehrende offene Planungspfad liegt unter `tem/tasks/open/*.json`. Die menschenlesbare Primarschicht liegt unter `docs/V2/`. Das Archiv liegt unter `tem/tasks/archive/*.json`.

## Status
1. Nicht mehr als offene Planquelle verwenden.
2. Nur als Altzusammenfassung behalten, bis ihre Inhalte vollstaendig in `docs/V2/` oder `tem/tasks/` aufgehen.
3. Neue oder geaenderte Planung gehoert nicht mehr hier hinein.

## Blocker vor Canvas-Migration
| Thema | Zustand | Deadline | Erledigt wenn |
|---|---|---|---|
| Wrapper-Expiry | erledigt im Code-Schnitt | `2026-04-06` | `wrapper-guardrails.json` enthaelt keine aktiven Wrapper mehr und `check-wrapper-guardrails.mjs` meldet `wrappers=0` |
| Hygiene-Gap `59 -> 68` | offen | `2026-04-01` | `REPO_HYGIENE_MAP` fuehrt die 9 zusaetzlichen dokumentierten Cleanup-Kandidaten explizit |
| Task-Stub-Drift | offen | `2026-03-31` | diese Datei ist zur Prioritaets- und Ausfuehrungslinie umgebaut |

## Canvas-First Plan
| Task | Ziel | Dateien/Module | Verifikation | Sequenz |
|---|---|---|---|---|
| CF-003 | Einen einzigen aktiven Frame-Scheduler festziehen; keine doppelte Canvas-/Render-Loop. | `app/src/ui/UIController.js`, `app/src/ui/RenderManager.js`, `app/src/main.js`, `app/public/game.html` | lokaler Render-Smoke, keine doppelten Frames, kein Flackern | Start nach Wrapper-Cut |
| CF-004 | Tile-Basisdarstellung auf Canvas ziehen; DOM nur noch Referenzpfad. | `app/src/ui/TileGridRenderer.js`, `app/src/ui/RenderManager.js`, `app/src/ui/UIController.js`, `app/public/game.html`, `app/src/ui/tileGrid.css` | `npm test`, visueller Smoke, Screenshot-/Layout-Abgleich | nach CF-003 |
| CF-005 | Hover, Selection, Icons und Effekte als Canvas-Layer nachziehen. | `Interaction-Visuals`, `Effect-Renderer`, `Icon-Atlas`, `RenderManager`, `UIController` | lokaler Interaktionssmoke, Overlay- und Z-Order-Check | nach CF-004 |
| CF-006 | World-/Voxel-Hintergrund in denselben Koordinatenraum ziehen. | `World-Background/Voxel-Renderer`, `RenderManager`, `UIController` | Resize-/Zoom-Smoke, Deckungsgleichheit bei Pan/Zoom | nach CF-005 |
| CF-007 | SVG auf Linien/Pulse reduzieren und Layer-Reihenfolge sauber halten. | `SVG-Overlay-Komponente`, `Overlay-Controller`, `RenderManager` | visueller Smoke nach Resize/Zoom, keine Lageverschiebung | nach CF-006 |
| CF-008 | Pointer-Hit-Testing von DOM-Rechtecken auf `screenToTile` umstellen. | `Pointer-/Mouse-Handler`, `Selection-Controller`, `RenderManager` | Edge-/Corner-Smoke, High-DPI- und Grenzpixel-Fall | nach CF-007 |
| CF-009 | DOM-Grid abbauen; DOM bleibt nur fuer HUD/Panel. | `Grid-Component`, `HUD/Panel-Container`, `CSS/Layout` | Browser-Smoke, keine visuellen Tiles mehr im DOM | nach CF-008 |
| CF-010 | Debug-State und `render_game_to_text` um Canvas-Sicht erweitern. | `Debug-State-Serializer`, `render_game_to_text`, `Dev-Overlay` | Debug-Ausgabe mit viewport, tile hit, selection, entity layer | nach CF-009 |
| CF-011 | Deckungsgleichheit, Resize/Zoom und Overlay per Tests absichern. | `E2E/Playwright`, `Visual-Regression-Tests` | Screenshot-Vergleich, konsolenfehlerfrei | nach CF-010 |
| CF-012 | Canvas-Hit-Testing, HUD und Smoke-Automation stabilisieren. | `Interaction-Tests`, `Smoke-Suite`, `CI-Testjob` | Edge-/Corner-Interaktionen plus HUD-Flow in Automation | nach CF-011 |

## Legacy- und Wrapper-Plan
| Task | Ziel | Dateien/Module | Verifikation | Termin |
|---|---|---|---|---|
| T04 | erledigt: BaseUI-/MainMenu-/DevUI-/GameUI-Stack loeschen. | geloeschte Legacy-Controller | `check:required`, `check-wrapper-guardrails` | abgeschlossen `2026-03-31` |
| T05 | UIController-Cluster auf verbleibende Ziel-Events/APIs reduzieren. | `app/src/ui/UIController.js`, Consumer-Module | Eventfluss pruefen, kein Legacy-Wrapper mehr | als naechster UI-Slice |
| T06 | World-Render-Fallbacks auf Null reduzieren. | `app/public/game.html`, Bootstrap | keine toten Script-Pfade mehr | abgeschlossen `2026-03-31` |
| T07 | Event-/Interface-Wrapper entfernen, sobald Caller migriert sind. | Wrapper-Module, Imports | produktive Suche ohne Treffer | nach T05 |
| T08 | Legacy-Code und tote Acceptance-Pfade loeschen. | Legacy-Ordner/Dateien, Navigation-Konfig | keine unerreichbaren Pfade im Pflichtpfad | fortlaufend |
| T09 | Obsolete JSON-/Schema-/Manifest-Artefakte bereinigen. | JSON, Schema, Manifest-Dateien | Loader- und Schema-Validierung | nach T08 |
| T10 | Adapter nach nachgewiesener Caller-Migration final entfernen. | Adapter-Module | Referenzgraph auf 0 produktive Adapter-Caller | nach T07 |
| T11 | SoT-Dateien und Baselines synchronisieren. | `FUNCTION_SOT`, `REPO_HYGIENE_MAP`, Docs-Index, Release-/Test-Baselines | Integritaets-Checks, `npm run evidence:verify` | laufend, Pflicht vor jedem Push |

## Long-Term Bug Plan
| Task | Ziel | Dateien/Module | Check/Test | Prioritaet |
|---|---|---|---|---|
| P0-1 | `jszip`-Abhaengigkeit im Evidence-Bundle-Skript beheben oder Import entfernen. | `dev/scripts/build-evidence-bundle.mjs`, `package.json`, `package-lock.json` | `npm run evidence:bundle` ohne Modul-Load-Fehler | hoch |
| P0-2 | Bootstrap-Regressionstest fuer RenderManager-Resize und TileGridRenderer-Synchronisation anlegen. | `app/src/main.js`, `app/src/ui/RenderManager.js`, `app/src/ui/TileGridRenderer.js` | Resize-/Grid-Resync-Test gruen | hoch |
| P0-3 | Updater-Pfad fuer `testline-integrity.json` kanonisch halten. | `app/src/sot/testline-integrity.json`, `dev/tools/runtime/update-testline-integrity.mjs` | Datei nur ueber Updater, Verifikation gruen | erledigen bevor weitere Baseline-Arbeit startet |
| P1-1 | `RenderManager` als alleinige Geometriequelle absichern. | `RenderManager`, Koordinaten- und Hit-Test-Verbraucher | zentrale Geometriequelle nachweisbar | mittel |
| P1-2 | Live-Resync fuer `gridBounds` und Viewport-Werte implementieren. | `RenderManager`, `TileGridRenderer`, Bootstrap-/Resize-Pfade | Geometrie bleibt nach init, resize und zoom synchron | mittel |
| P1-3 | Resize-, Zoom- und Edge-Hit-Tests erweitern. | QA, Interaktions-Smokes | Grenzfaelle automatisiert abgedeckt | mittel |
| P2-1 | Legacy- und Fallback-Zweige in `game.html` und Runtime-Guards minimieren. | `app/public/game.html`, Runtime-Guards | nur noetige Ersatzpfade bleiben | mittel |
| P2-2 | Evidence- und Determinismus-Gates fuer Merge/Release verbindlich halten. | Merge-/Release-Checks, Evidence-Workflows | `npm test`, `npm run evidence:verify`, `npm run testline:verify` sind Pflicht | laufend |

## 6-Tage-Plan bis Wrapper-Expiry
| Datum | Pflichtarbeit | Ergebnis |
|---|---|---|
| `2026-03-31` | Tasklinie konkretisieren, Hygiene-Gap offenlegen, Wrapper-Expiry sichtbar machen | keine Stub-Planung mehr |
| `2026-04-01` | 9 dokumentierte Zusatzkandidaten in `REPO_HYGIENE_MAP` einziehen | `59 -> 68` Gap geschlossen |
| `2026-04-02` | Restliche UI-/Bootstrap-Slices ohne neue Wrapper durchziehen | keine offene Ablauf-Unklarheit |
| `2026-04-03` | CF-003 und CF-004 abarbeiten | Canvas-Basis steht |
| `2026-04-04` | CF-005 bis CF-008 abarbeiten | Layer und Hit-Testing stehen |
| `2026-04-05` bis `2026-04-06` | CF-009 bis CF-012 und Rest-Checks | Ablaufdatum ohne ungeklaerte Wrapper-Abhaengigkeit |
