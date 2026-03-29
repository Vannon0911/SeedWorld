# AKTUELLE RED ACTIONS

Dieser Stand wird automatisch vor Preflight/Commit synchronisiert.

- Snapshot: `fd13c98c7c8dbf0e`
- Candidate Changes: `10`

## Commit-Kandidat (Name-Status)
- `M` .githooks/pre-commit
- `M` .githooks/pre-push
- `M` app/src/sot/FUNCTION_SOT.json
- `M` app/src/sot/REPO_HYGIENE_MAP.json
- `M` dev/tools/runtime/preflight-mutation-guard.mjs
- `A` dev/tools/runtime/preflight-override.mjs
- `M` dev/tools/runtime/preflight.mjs
- `M` dev/tools/runtime/updateRedActions.mjs
- `M` docs/SOT/REPO_HYGIENE_MAP.md
- `M` package.json

## Red-Actions (risikoreiche Treffer)
- `hook-flow` -> `M` .githooks/pre-commit
- `hook-flow` -> `M` .githooks/pre-push
- `runtime-guard` -> `M` dev/tools/runtime/preflight-mutation-guard.mjs
- `runtime-guard` -> `A` dev/tools/runtime/preflight-override.mjs
- `runtime-guard` -> `M` dev/tools/runtime/preflight.mjs
- `runtime-guard` -> `M` dev/tools/runtime/updateRedActions.mjs
- `script-surface` -> `M` package.json

## Regel
- Jeder Commit muss diesen Stand widerspruchsfrei spiegeln.

