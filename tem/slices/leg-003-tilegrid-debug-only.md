# LEG-003 TileGrid Debug Only

## Scope
`TileGridRenderer` auf Debug-/Inspection-Rolle reduzieren.

## Betroffene Dateien
- `app/src/ui/TileGridRenderer.js`
- `app/src/ui/UIController.js`
- `app/public/game.html`

## Abnahmekriterien
- Produktionspfad rendert ueber Canvas-/Chunk-Layer.
- TileGrid ist nur Debug-Overlay und nicht mehr kanonischer Renderer.

## Testschritte
1. `npm test`
2. Browser-Smoke mit Debug-Umschaltung
3. Keine sichtbaren Tile-Kanten im Produktionsmodus
