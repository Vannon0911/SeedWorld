# AKTUELLE RED ACTIONS

Dieser Stand wird automatisch vor Preflight/Commit synchronisiert.

- Snapshot: `aef984ec07f96313`
- Candidate Changes: `4`

## Commit-Kandidat (Name-Status)
- `A` dev/tools/runtime/evidence-lock.mjs
- `A` dev/tools/runtime/preflight-mutation-guard.mjs
- `M` dev/tools/runtime/preflight.mjs
- `M` package.json

## Red-Actions (risikoreiche Treffer)
- `runtime-guard` -> `A` dev/tools/runtime/evidence-lock.mjs
- `runtime-guard` -> `A` dev/tools/runtime/preflight-mutation-guard.mjs
- `runtime-guard` -> `M` dev/tools/runtime/preflight.mjs
- `script-surface` -> `M` package.json

## Regel
- Jeder Commit muss diesen Stand widerspruchsfrei spiegeln.

