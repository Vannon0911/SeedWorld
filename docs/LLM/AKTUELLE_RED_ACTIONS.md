# AKTUELLE RED ACTIONS

Dieser Stand wird automatisch vor Preflight/Commit synchronisiert.

- Snapshot: `808ab2a2f3ddefc8`
- Candidate Changes: `10`

## Commit-Kandidat (Name-Status)
- `M` .githooks/pre-commit
- `M` app/src/sot/FUNCTION_SOT.json
- `M` app/src/sot/REPO_HYGIENE_MAP.json
- `M` app/src/sot/testline-integrity.json
- `A` dev/tests/modules/07.preflight-mutation-guard.module.mjs
- `M` dev/tools/runtime/installGitHooks.mjs
- `M` dev/tools/runtime/preflight-mutation-guard.mjs
- `M` dev/tools/runtime/preflight.mjs
- `M` dev/tools/runtime/syncDocs.mjs
- `M` docs/SOT/REPO_HYGIENE_MAP.md

## Red-Actions (risikoreiche Treffer)
- `hook-flow` -> `M` .githooks/pre-commit
- `runtime-guard` -> `M` dev/tools/runtime/installGitHooks.mjs
- `runtime-guard` -> `M` dev/tools/runtime/preflight-mutation-guard.mjs
- `runtime-guard` -> `M` dev/tools/runtime/preflight.mjs
- `runtime-guard` -> `M` dev/tools/runtime/syncDocs.mjs

## Regel
- Jeder Commit muss diesen Stand widerspruchsfrei spiegeln.

