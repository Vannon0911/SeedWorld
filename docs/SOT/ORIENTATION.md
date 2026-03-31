# SeedWorld Orientation (Synced: 2026-03-31)

## 1) System Map

- `app/src/ui/`: schlanker Browser-Adapter fuer die verbleibende Spielansicht.
- `app/src/game/`: Gameplay-Regeln und erlaubte Patch-Berechnung.
- `app/src/kernel/`: Deterministische Domain-Grenzen und Mutationskontrolle.
- `app/server/`: Altpfad, nicht Teil des Pflichtkerns.
- `dev/tools/patch/`: Altpfad, nicht Teil des Pflichtkerns.
- `dev/tests/`: Pflichtpfad laeuft ueber `dev/scripts/test-runner.mjs` und die Module unter `dev/tests/modules/`.

## 2) Lokale Reihenfolge

```bash
npm install
npm run check:required
npm run check:required:verify-only
```

## 3) Verifizierte Testlinie

- `node dev/scripts/test-runner.mjs`
- `node dev/scripts/verify-evidence.mjs`
- `node dev/tools/runtime/verify-testline-integrity.mjs`
- `node dev/tools/runtime/run-required-checks.mjs`
- `app/src/kernel/GovernanceEngine.js` ist der zentrale Governance-Vertrag fuer Pipeline/Policy/Claim-Rule.
- `app/src/sot/governance-engine.sot.v2.json` ist die SoT-2.0-Fuehrung fuer Engine-Verkabelung und Proof-Artefakte.
- `runtime/evidence/governance-proof-manifest.json` manifestiert Zero-Trust-Beweise fuer SoT + Evidence + Gate-Outputs.

## 4) Hinweise

- Menschenlesbare Fuehrung laeuft primär ueber `docs/V2/`.
- Browser-Runtime fuehrt nur noch die reduzierte Spielansicht aus.
- Pflichtqualitaet ist nur noch Doppel-Lauf plus Evidence plus Testline-Schlusstest.
- Green-Status ist nur gueltig mit `runtime/evidence/required-check-report.json`.
- Aktive Spiel- und Doku-Strings werden ueber `STRING_MATRIX` mechanisch synchron gehalten.
- Server-, Patch-, Menue- und Plugin-Reste sind nicht Teil des reproduzierbaren Pflichtpfads.
- Planung und Archivierung laufen ueber atomare JSON-Tasks unter `tem/tasks/` und die menschenlesbare V2-Doku unter `docs/V2/`.
