# TEM WORKFLOW

Diese Datei wird automatisch gepflegt und definiert den verbindlichen Ablauf.
TEM ist die einzige aktuelle TODO-Betriebsflaeche fuer operative Plan-/Statusarbeit.

## Sequenz
1. Implementierung eines klar abgegrenzten Slices.
2. Technische Validierung (`npm test`, bei Bedarf weitere Gates).
3. Befund-/Risiko-Pruefung gegen bestehende Reports/Rebuttals.
4. Dokumente in `tem/` aktualisieren, dann `npm run tem:sync`.
5. `npm run tem:verify` muss sauber durchlaufen.

## Guardrails
- Keine Sidecar-Dateien (`*.todo.md`, `*.konflikte.md`, `*.check.md`, `_TODO.md`, `_KONFLIKTE.md`, `_CHECK.md`).
- Nur diese 3 Steuerdateien sind kanonisch: `tem/TODO.md`, `tem/WORKFLOW.md`, `tem/SCHEMA.json`.
- Drift der 3 Steuerdateien blockt `check:required`.
- Globale Dateiredundanz (hash-identischer Inhalt in den gescannten Roots) muss 0 sein.

## Betriebsregel
- Nach jeder inhaltlichen Aenderung unter `tem/`: zuerst `npm run tem:sync`, danach `npm run tem:verify`.
- Vor Merge: `npm run check:required` muss ohne Drift laufen.
