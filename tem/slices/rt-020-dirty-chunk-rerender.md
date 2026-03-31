# RT-020 Dirty Chunk Rerender

## Scope
Gezielte Re-Render-Strategie fuer Dirty Chunks einziehen.

## Betroffene Dateien
- `app/src/game/chunkState.js`
- `app/src/game/mutationQueue.js`
- `app/src/workers/chunkRenderWorker.js`

## Abnahmekriterien
- Nur betroffene Chunks plus notwendige Nachbarn werden neu gerendert.
- Grenzen/Occlusion bleiben konsistent.

## Testschritte
1. `npm test`
2. Dirty-Chunk-Smoke
3. Neighbor-Propagation-Test
