# Traceability Map

Task -> Datei -> Test/Check. Diese Map deckt die Aufgaben aus `tem/beide-plaene.md` und `tem/langfristiger-bug-plan.md` ab und verweist fuer offene Punkte auf `tem/slices/remaining-task-stubs.md`.

## Canvas-First Plan
| Task | Datei | Test/Check |
|---|---|---|
| CF-001 | `tem/cf-001-architektur-notiz.md` | Architektur-Signoff fuer `viewport`, `tileSize`, `gridBounds`, `worldToScreen`, `screenToTile`. |
| CF-002 | `tem/cf-001-architektur-notiz.md` | `npm test` plus Bootstrap-/RenderManager-Regression, damit die Geometrie-SoT haelt. |
| CF-003 | `tem/slices/cf-003-canvas-render-loop.md` | `test:playwright:fulltiles`, Browser-Konsole auf doppelte Frames / Flackern. |
| CF-004 | `tem/slices/cf-004-tile-dom-to-canvas.md` | `npm test`, visueller Smoke, Screenshot-Abgleich. |
| CF-005 | `tem/slices/remaining-task-stubs.md` | Playwright-Interaktionssmoke, Overlay-/Layer-Check. |
| CF-006 | `tem/slices/remaining-task-stubs.md` | Resize-/Zoom-Smoke, Deckungsgleichheit von World und Tiles. |
| CF-007 | `tem/slices/remaining-task-stubs.md` | Visueller Smoke nach Resize/Zoom, keine SVG-Versetzung. |
| CF-008 | `tem/slices/remaining-task-stubs.md` | Edge-/Corner-Smoke, `screenToTile`-Hit-Testing. |
| CF-009 | `tem/slices/remaining-task-stubs.md` | Browser-Smoke, DOM tile rendering verschwunden, HUD intakt. |
| CF-010 | `tem/slices/remaining-task-stubs.md` | Debug-Ausgabe und `render_game_to_text` mit Canvas-Werten vergleichen. |
| CF-011 | `tem/slices/remaining-task-stubs.md` | `test:playwright:fulltiles`, Visual-Regression, keine Konsolefehler. |
| CF-012 | `tem/slices/remaining-task-stubs.md` | Interaction-Tests, Smoke-Suite, CI-Stabilitaet. |

## Legacy- und Wrapper-Plan
| Task | Datei | Test/Check |
|---|---|---|
| T01 | `tem/t01-legacy-wrapper-inventur.md` | `rg`-Referenzliste, Inventur-Dokument, `check:required`. |
| T02 | `tem/slices/t02-kanonische-api-matrix.md` | `npm test`, `test:playwright:fulltiles`, Bootstrap- und Resize-Checks. |
| T03 | `tem/slices/t03-guardrail-konzept.md` | `check:wrapper-guardrails`, TTL-/Flag-/CI-Policy-Check. |
| T04 | `tem/slices/remaining-task-stubs.md` | `check:required`, `npm test`, `test:playwright:fulltiles`. |
| T05 | `tem/slices/remaining-task-stubs.md` | Browser-Interaktionstest, `npm test`, kein Fallback im Cluster. |
| T06 | `tem/slices/remaining-task-stubs.md` | Eventfluss-Assertions, `npm test`, kein Legacy-Wrapper. |
| T07 | `tem/slices/remaining-task-stubs.md` | Browser-Smoke fuer Hauptpfad und Rest-Fallbacks. |
| T08 | `tem/slices/remaining-task-stubs.md` | E2E-/Interaktionstest, keine toten Script-Pfade. |
| T09 | `tem/slices/remaining-task-stubs.md` | `rg` ohne produktive Treffer, Build + Tests. |
| T10 | `tem/slices/remaining-task-stubs.md` | Navigation-Smoke, keine Dead Links / keine unerreichbaren Pfade. |
| T11 | `tem/slices/remaining-task-stubs.md` | Schema-Validation und Loader-Checks ohne Fehler. |
| T12 | `tem/slices/remaining-task-stubs.md` | Referenzgraph 0 produktive Adapter-Caller, Pflichttests gruen. |
| T13 | `tem/slices/remaining-task-stubs.md` | Integritaets-Checks, `npm test`, `npm run evidence:verify`. |

## Long-Term Bug Plan
| Task | Datei | Test/Check |
|---|---|---|
| P0-1 | `tem/slices/evidence-remediation-jszip.md` | `npm run evidence:bundle`, danach `npm run evidence:verify`. |
| P0-2 | `tem/slices/remaining-task-stubs.md` | Bootstrap- und Resize-Test fuer `RenderManager` / `TileGridRenderer`. |
| P0-3 | `tem/slices/remaining-task-stubs.md` | `dev/tools/runtime/update-testline-integrity.mjs`, Verifikation gruen. |
| P1-1 | `tem/slices/remaining-task-stubs.md` | Alle Geometriepfade laufen ueber `RenderManager`. |
| P1-2 | `tem/slices/remaining-task-stubs.md` | Live-Resync nach init, resize und zoom. |
| P1-3 | `tem/slices/remaining-task-stubs.md` | Resize-, Zoom- und Edge-Hit-Tests in CI stabil. |
| P2-1 | `tem/slices/remaining-task-stubs.md` | Browser-Smoke fuer Primarpfad und reduzierte Fallbacks. |
| P2-2 | `tem/slices/remaining-task-stubs.md` | `npm test`, `npm run evidence:verify`, Integrity-Checks als Pflichtgates. |
