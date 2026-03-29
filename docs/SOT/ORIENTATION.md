# SeedWorld Orientation (Synced: 2026-03-29)

## 1) System Map

- `app/src/ui/`: Rendering und Input, keine direkten Domain-State Writes.
- `app/src/game/`: Gameplay-Regeln und erlaubte Patch-Berechnung.
- `app/src/kernel/`: Deterministische Domain-Grenzen und Mutationskontrolle.
- `app/server/`: Schlanker Runtime-Server fuer Launcher, Menue und Game-Assets.
- `dev/tools/patch/`: Terminal-only Patch-Tooling, keine Browser-Apply-Pfade.
- `dev/tests/`: Einstieg `dev/tests/MainTest.mjs`, Module unter `dev/tests/modules/`.

## 2) Lokale Reihenfolge

```bash
npm install
npm run sync:docs
npm run preflight
npm test
npm start
```

## 3) Verifizierte Testlinie

- `node dev/scripts/smoke-test.mjs`
- `node dev/scripts/runtime-guards-test.mjs`
- `node dev/scripts/test-runner.mjs`

## 4) Hinweise

- Browser-Runtime startet nur Launcher, Menue und Game-Ansichten.
- Patch-Ausfuehrung bleibt terminalseitig ueber `npm run patch:apply -- --input <zip|json>`.
- Terrain/DOM/SVG-Rendering ist getrennt: Canvas unten, DOM Mitte, SVG oben.
