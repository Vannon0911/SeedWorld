# RT-019 Chunk Offscreen Worker

## Scope
Chunk-Offscreen-Renderer als reinen Executor einbauen.

## Betroffene Dateien
- `app/src/workers/chunkRenderWorker.js`
- `app/src/workers/worldRenderWorker.js`
- `app/src/render/renderPlan.js`

## Abnahmekriterien
- Worker rendert deterministische Layer (`albedo`, `shadow`, `mask`, optional `debug`) aus freigegebenem `renderPlan`.
- Kein Grid-Pass im Produktionsmodus.

## Testschritte
1. `npm test`
2. `chunk-halo-no-seams`
3. `same-worldHash-same-renderHash`
