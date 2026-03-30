# SoT Doc Validity Report

Datum: 2026-03-30

## Executed Checks

| Check | Result | Notes |
| --- | --- | --- |
| `npm run sync:docs` | Fail | Abbruch in `dev/tools/runtime/repo-hygiene-map.mjs` mit Drift-Meldung. |
| `npm run sot:verify` | Fail | Drift in `app/src/sot/FUNCTION_SOT.json`. |
| `npm run check:required` | Fail | `governance:verify` passierte, danach scheiterte der eingebettete `sync:docs`-Schritt am selben Hygiene-Drift. |

## Pass / Fail

- Pass:
  - `governance:verify` innerhalb von `npm run check:required`
- Fail:
  - `npm run sync:docs`
  - `npm run sot:verify`
  - `npm run check:required`

## Drift-Files

- `app/src/sot/REPO_HYGIENE_MAP.json`
- `docs/SOT/REPO_HYGIENE_MAP.md`
- `app/src/sot/FUNCTION_SOT.json`

## Root-Cause-Hypothese

Die generierten SoT-Artefakte sind nicht mehr synchron zum aktuellen Arbeitsbaum. Das Hygiene-Map-Artefakt wird von `sync:docs` bereits vor den Markdown-Checks als driftend erkannt, und die Funktion-SoT-Datei ist separat veraltet.

Inferenz: Im Worktree liegen bereits mehrere uncommitted Source- und Doku-Änderungen vor; sehr wahrscheinlich wurden die generierten Snapshots nach diesen Änderungen nicht neu erzeugt.

## Empfohlene Fix-Reihenfolge

1. `app/src/sot/REPO_HYGIENE_MAP.json` und `docs/SOT/REPO_HYGIENE_MAP.md` mit `npm run sync:docs:apply` regenerieren.
2. `app/src/sot/FUNCTION_SOT.json` mit `npm run sot:apply` regenerieren.
3. Danach erneut `npm run sync:docs` und `npm run sot:verify` ausführen.
4. Erst wenn beide Checks sauber sind, `npm run check:required` erneut laufen lassen.
