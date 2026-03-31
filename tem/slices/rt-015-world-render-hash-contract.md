# RT-015 World/Render Hash Contract

## Scope
Hash- und Versionsvertrag fuer Welt- und Renderzustand festziehen.

## Betroffene Dateien
- `app/src/render/renderFingerprint.js`
- `app/src/game/worldHash.js`
- `docs/V2/TRUTH.md`

## Abnahmekriterien
- `worldHash` und `renderHash` sind deterministisch aus versionierten Inputs ableitbar.
- Keine impliziten Inputs oder verdeckten Defaults in den Hash-Pfaden.

## Testschritte
1. `npm test`
2. `same-seed-same-worldHash`
3. `same-worldHash-same-renderHash`
