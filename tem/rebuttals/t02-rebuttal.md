# T02 Rebuttal

## Ergebnis
T02 kann aktuell nicht bestaetigt werden. Die Matrix beschreibt einen sinnvollen Zielzustand, aber sie ist noch nicht vollstaendig kanonisiert und die Migration ist im Repo nicht durchgehend umgesetzt.

## Ursachenanalyse
- `RenderManager.worldToScreen()` und `RenderManager.screenToTile()` existieren zwar in `app/src/ui/RenderManager.js`, aber `rg -n` findet im Repo keine produktiven Aufrufer. Das sind damit Ziel-APIs ohne echte Verdrahtung, keine bereits etablierte SoT.
- `app/src/ui/UIController.js` bleibt in `#bindViewport()` dual: Wenn `RenderManager` fehlt, faellt der Code weiter auf `ViewportManager.subscribe(...)` zurueck. Der Legacy-Pfad ist also noch aktiv und nicht nur dokumentiert.
- `app/public/game.html` liest die Grid-Daten weiter aus `ui.tileGridRenderer.width/height/tileSize` und reicht sie an den World-Render weiter. Der Terrain-Pfad haengt damit noch an der Renderer-Instanz statt am `RenderManager`-Snapshot.
- Die Matrix ordnet die Legacy-Geometrie nicht sauber zu: `app/src/ui/TileGridRenderer.js` benutzt keine `getBoundingClientRect()`-Hit-Tests, sondern nur `dataset.x/y` fuer Click-Identity. Die echte DOM-Geometrie sitzt in `app/public/game.html` und `app/src/plugins/radialBuildController.js`.
- `app/src/ui/GameUIController.js` und `app/src/ui/UIController.js` initialisieren `TileGridRenderer` weiterhin mit festen `16/12/84`-Werten. Damit fehlt der behauptete zentrale Live-Pfad fuer Grid-Metrik und Resync.

## Langfristige Loesung
1. `RenderManager` als einzige Geometriequelle fuer Viewport, Grid und Koordinaten-Math konsequent verdrahten.
2. Den `ViewportManager`-Fallback aus `UIController` erst entfernen, wenn `app/public/game.html` und `app/src/plugins/radialBuildController.js` auf `RenderManager.subscribe(...)` umgestellt sind.
3. Einen Bootstrap- und Resize-Smoke-Test anlegen, der den Weg `ViewportManager -> RenderManager -> UIController -> TileGridRenderer` sowie den World-Render-Parameterfluss absichert.

## Fazit fuer T02
Die Spezifikation ist als Zielbild brauchbar, aber nicht als erledigte Kanonisierung. Solange `worldToScreen` und `screenToTile` keine aktiven Verbraucher haben und die DOM-Pfade parallel weiterlaufen, ist T02 nur ein unvollstaendiger Migrationsentwurf.
