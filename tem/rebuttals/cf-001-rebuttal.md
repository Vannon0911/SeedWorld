# CF-001 Rebuttal

## Verdict
REBUTTED

CF-001 ist in diesem Workspace noch nicht erfuellt. Die Architektur-Notiz beschreibt ein Zielbild, aber sie ist weder als harter Runtime-Contract umgesetzt noch als verifizierte Arbeitsgrundlage durchgezogen.

## Findings
1. Die Notiz ist nicht genutzt, sondern nur als Referenz in einem Plan verlinkt.
   - `tem/slices/t02-kanonische-api-matrix.md:7` verweist auf `tem/cf-001-architektur-notiz.md` als Zielbild.
   - Es gibt keine Runtime-, Build- oder Test-Stelle, die die Notiz selbst konsumiert oder gegen ihre Aussagen validiert.

2. Die behauptete Single-Source-of-Truth existiert in der Runtime nicht durchgehend.
   - `app/public/game.html:335-338` liest `width`, `height` und `tileSize` weiterhin direkt aus `ui.tileGridRenderer.*`.
   - `app/src/ui/UIController.js:263-270` initialisiert `RenderManager` zwar mit Grid-Massen, aber die Massen stammen zuerst aus `TileGridRenderer`, nicht umgekehrt.
   - `app/src/ui/UIController.js:285-300` faellt bei fehlendem `RenderManager` immer noch auf `viewportManager` zurueck.

3. Der benannte Koordinatenkern ist faktisch noch nicht kanonisch genutzt.
   - `app/src/ui/RenderManager.js:86-103` definiert `worldToScreen()` und `screenToTile()`.
   - Die Code-Suche findet dafuer keine aktiven Consumer ausser der Definition selbst; damit ist die zentrale Geometrie-API im Repo noch ein unbenutzter Buchstabe auf Papier.

4. `TileGridRenderer` behaelt eigene Geometriehoheit.
   - `app/src/ui/TileGridRenderer.js:45-58` speichert `width`, `height` und `tileSize` als eigene Instanzdaten.
   - `app/src/ui/TileGridRenderer.js:138-149` synchronisiert nur Layout-CSS, nicht die globale Geometriewahrheit.
   - Das ist nicht "keine zweite Quelle". Das ist eine zweite Quelle mit besserem Marketing.

## Root Cause
CF-001 wurde wie ein erledigter Architekturvertrag behandelt, obwohl es technisch nur ein Ziel-Statement ist. Der Workspace zeigt ein paralleles Modell: `ViewportManager`, `RenderManager`, `UIController`, `TileGridRenderer` und `game.html` halten jeweils noch eigene Stuecke der Geometrie-Logik oder lesen sie direkt aus fremden Objekten.

Der Kernfehler ist damit nicht ein einzelner Bug, sondern fehlende Durchsetzung: Keine zentrale Quelle ist gegen direkte Zugriffe abgesichert, und die Notiz benennt keine zwingenden Migrations- oder Verifikationsschritte fuer die vorhandenen Callsites.

## Long-term Fix
1. `RenderManager` als einzige Geometriequelle hart festlegen und alle direkten Lesezugriffe auf `tileGridRenderer.*`, `viewportManager.*` und ad-hoc Pixel-Math in die kanonischen APIs ueberfuehren.
2. Eine Bootstrap-/Resize-Regression hinzufuegen, die den Weg `ViewportManager -> RenderManager -> UIController -> TileGridRenderer` und die Nutzung von `worldToScreen()`/`screenToTile()` absichert.
3. Die Architektur-Notiz auf einen echten Contract umbauen: aktuelle vs. Zielzustand trennen, konkrete Callsite-Liste angeben, erlaubte und verbotene Pfade markieren und ein Abnahmekriterium pro Pfad definieren.

## Implemented Changes
- Diese Rebuttal-Datei wurde als Ownership-Artifact angelegt und fasst die Gegenargumente samt Langfristplan zusammen.
- Es wurden keine fremden Dateien angefasst und keine Runtime- oder Legacy-Pfade in diesem Schritt veraendert.
