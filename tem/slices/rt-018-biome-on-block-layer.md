# RT-018 Biome on Block Layer

## Scope
Biome- und Materiallogik auf Block-/Chunk-Daten sichtbar machen.

## Betroffene Dateien
- `app/src/game/blockCompiler.js`
- `app/src/game/chunkCompiler.js`
- `app/src/render/renderState.js`

## Abnahmekriterien
- Blockdaten enthalten `biomePrimary`, `biomeWeights`, `transitionFlags`, `materialPreset`, `shadowClass`.
- Renderpfad kann Uebergaenge ohne Tile-Hauptmodell bestimmen.

## Testschritte
1. `npm test`
2. Biome-Mischkanten-Test
3. Material-/Transition-Snapshot
