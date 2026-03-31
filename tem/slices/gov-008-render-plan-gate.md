# GOV-008 Render Plan Gate

## Scope
Validierten Render-Plan als Pflichtvertrag im Governance-Pfad verankern.

## Betroffene Dateien
- `app/src/render/renderPlan.js`
- `app/src/kernel/KernelGates.js`
- `app/src/kernel/gates/render-plan-gate.js`

## Abnahmekriterien
- Worker/UI akzeptieren nur validierten `renderPlan` mit `expectedWorldHash` und whitelisted Presets.
- Fail-closed bei fehlendem Hash, unbekannten Presets oder freien Kamera-/Lichtparametern.

## Testschritte
1. `npm test`
2. `render-gate-denies-free-camera`
3. `render-gate-denies-unknown-preset`
