# CF-002 Rebuttal

## Verdict
CF-002 ist repo-weit nicht erfuellt. Der aktive UI-Bootstrap in meiner Ownership ist jetzt enger an `RenderManager` gekoppelt, aber die Kernbehauptung "RenderManager als SoT, koordinatenbezogene Logik zentral" scheitert weiter an unverdrahteten Koordinaten-APIs und verbleibenden Parallelpfaden ausserhalb meiner Ownership.

## Findings
- `RenderManager.worldToScreen()` und `RenderManager.screenToTile()` haben im produktiven `app/src` weiterhin keine Verbraucher. Ein Repo-Scan mit `rg -n "worldToScreen\\(|screenToTile\\(" app/src -g "!app/src/ui/RenderManager.js"` liefert keine Treffer ausser der Definition. Damit existiert die zentrale Koordinaten-API eher als Kulisse als als echte SoT.
- In `app/src/plugins/radialBuildController.js:172`, `app/src/plugins/radialBuildController.js:178`, `app/src/plugins/radialBuildController.js:179`, `app/src/plugins/radialBuildController.js:331` und `app/src/plugins/radialBuildController.js:332` bleibt DOM-basierte Geometrie ueber `getTileCenter()` und `getBoundingClientRect()` aktiv. Dieser Pfad umgeht `RenderManager` komplett.
- `app/src/ui/GameUIController.js:115` erstellt `TileGridRenderer` weiterhin direkt mit `84` als Tile-Groesse. Damit lebt ein weiterer Grid-/Koordinatenpfad neben `RenderManager`.
- In meiner Ownership war `UIController` vor dem Fix selbst Teil des Problems: harter Boot-Pfad `16/12/84`, kein Grid-Resync bei State-Aenderungen und direkter Viewport-Fallback auf `ViewportManager`. Dieser Teil ist jetzt behoben, macht den Repo-Check aber nicht rueckwirkend wahr.

## Root Cause
- CF-002 wurde als Zielbild dokumentiert, bevor die produktiven Verbraucher wirklich migriert waren.
- `RenderManager` kapselt State und Math, aber die Einbindung ist unvollstaendig: Viewport, Grid-Metrik und Koordinatenlogik wurden nicht repo-weit auf denselben Pfad umgestellt.
- Die UI hatte zuvor keinen sauberen Resync-Mechanismus fuer geaenderte Weltgroessen. Dadurch konnte der deklarierte SoT-Zustand schon im eigenen Bootstrap kippen.

## Long-term Fix
- Alle produktiven Koordinatenverbraucher auf `RenderManager` ziehen: Overlay-/Linienpositionen ueber `worldToScreen()`, Hit-Tests ueber `screenToTile()`, keine DOM-Rechteck-Geometrie mehr als zweite Wahrheit.
- `GameUIController` und weitere Renderer-Initialisierungen auf denselben Grid-Snapshot umstellen, statt Tile-Masse lokal zu erfinden oder zu fixieren.
- Einen gezielten Bootstrap-/Resize-/Hit-Test-Regressionspfad anlegen, der `ViewportManager -> RenderManager -> UIController/Overlay` sowie `worldToScreen()` und `screenToTile()` explizit absichert. `npm test` allein deckt CF-002 aktuell nicht gezielt ab.

## Implemented Changes
- `app/src/ui/RenderManager.js`
  - Zentrale Default-Werte (`DEFAULT_GRID_BOUNDS`, `DEFAULT_TILE_SIZE`) und `normalizeRenderGrid()` eingefuehrt.
  - `setGrid()` normalisiert Grid-Metrik jetzt ueber denselben Pfad statt ad hoc in mehreren Stellen.
- `app/src/ui/UIController.js`
  - Harte `16/12/84`-Initialisierung entfernt und Grid-Spezifikation aus World-State bzw. `RenderManager`-Snapshot abgeleitet.
  - Grid-Resync fuer `bootstrap()`, `refresh()`, `handlePlan()`, `handleApply()` und `applyGameAction()` eingebaut, damit Weltgroesse und Renderer nicht auseinanderlaufen.
  - Direkten `ViewportManager`-Fallback entfernt; `UIController` bindet Viewport-Aenderungen nur noch ueber `RenderManager.subscribe(...)`.
  - `TileGridRenderer` wird bei geaenderter Grid-Metrik deterministisch neu aufgebaut statt mit veralteten Boot-Konstanten weiterzulaufen.
- `app/src/main.js`
  - `UIController` bekommt keinen `viewportManager` mehr injiziert; der aktive UI-Pfad liest Viewport-Updates nur noch aus `RenderManager`.

## Testresult
- `npm test`: PASS (`14/14` Module, ausgefuehrt am 2026-03-30).
- Rest-Risiko: Kein vorhandener Test verifiziert derzeit gezielt die CF-002-Aussage fuer `worldToScreen()`/`screenToTile()` oder die verbleibenden DOM-Geometriepfade ausserhalb meiner Ownership.
