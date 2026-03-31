# Workflow

## Pflichtlinie

```bash
npm run check:required
npm run check:required:verify-only
```

Die Pflichtlinie wird zentral durch `app/src/kernel/GovernanceEngine.js` definiert.
Die maschinenlesbare SoT-2.0-Verkabelung liegt in `app/src/sot/governance-engine.sot.v2.json`.
Versionsdrift wird mechanisch ueber `versioning:sync`/`versioning:verify` in derselben Engine-Pipeline geregelt.

## Reihenfolge

1. Kernel- oder Content-Aenderung lokal ausfuehren.
2. `check:required` ausfuehren (teilautomatische Sync-Artefakte + fail-closed Verify-Reihenfolge).
3. Belegreport unter `runtime/evidence/required-check-report.json` und Manifest unter `runtime/evidence/governance-proof-manifest.json` pruefen.
4. Vor Push `check:required:verify-only` sicherstellen (kein Auto-Write).
5. Erst dann committen/pushen.

## Regeln

- Kein Pflichttest ohne zwei Laeufe.
- Kein Pflichttest ohne Evidence.
- Kein offener Planungspfad ausserhalb von `tem/tasks/open/*.json`.
- Kein Gesamtstatus ohne Testline-Schlusstest.
- Kein `PASS` ohne Reproduktionsbeweis.
- Kein Claim ohne Proof-Report + Manifest (`required-check-report.json` + `governance-proof-manifest.json`).
- Browser-, Patch- und Serverreste sind nicht fuehrend.
