# RT-016 World Sampler Contract

## Scope
WorldGen auf reine Sampler-Schnittstellen vorbereiten.

## Betroffene Dateien
- `app/src/game/worldSampler.js`
- `app/src/game/worldGen.js`

## Abnahmekriterien
- `sampleBiome`, `sampleDensity`, `sampleHeight`, `sampleMaterial` existieren als pure deterministische Schnittstellen.
- V1-Generator darf weiterlaufen, nutzt aber dieselben Regeln.

## Testschritte
1. `npm test`
2. Sampler-Unit-Tests
3. Seed-Replay fuer Sampler-Ergebnisse
