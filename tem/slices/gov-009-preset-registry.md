# GOV-009 Preset Registry

## Scope
Kamera-/Licht-/Material-/Schatten-Presets als einzige Produktions-Eingabebasis fixieren.

## Betroffene Dateien
- `app/src/render/renderPresets.js`
- `app/src/kernel/gates/render-plan-gate.js`
- `docs/V2/TRUTH.md`

## Abnahmekriterien
- Nur versionierte Presets sind im Produktionspfad erlaubt.
- Rohparameter werden fail-closed abgelehnt.

## Testschritte
1. `npm test`
2. Preset-Whitelist-Test
3. Snapshot gegen Registry-Version
