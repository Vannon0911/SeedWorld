# RT-017 Block/Chunk Compiler

## Scope
Compiler fuer Block- und Chunk-Daten einfuehren.

## Betroffene Dateien
- `app/src/game/blockCompiler.js`
- `app/src/game/chunkCompiler.js`
- `app/src/game/worldGen.js`

## Abnahmekriterien
- `compileBlock` und `compileChunk` liefern normalisierte Daten.
- Keine verdeckte Abhaengigkeit auf Tile-/UI-Strukturen.

## Testschritte
1. `npm test`
2. `chunk-compile-same-seed-same-hash`
3. Snapshot-Test fuer Chunk-Struktur
