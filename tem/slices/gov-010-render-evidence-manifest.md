# GOV-010 Render Evidence Manifest

## Scope
Render-Evidence-Manifest als Pflichtartefakt in den Verify-Pfad aufnehmen.

## Betroffene Dateien
- `runtime/evidence/render-manifest.json`
- `dev/scripts/verify-evidence.mjs`
- `dev/tools/runtime/run-required-checks.mjs`

## Abnahmekriterien
- Jeder Renderlauf materialisiert ein pruefbares Manifest mit Hash-/Preset-/Chunk-Bezug.
- Verify blockiert bei fehlendem oder inkonsistentem Manifest.

## Testschritte
1. `npm test`
2. Schema-Check fuer Render-Manifest
3. `npm run check:required:verify-only`
