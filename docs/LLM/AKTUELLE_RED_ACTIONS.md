# AKTUELLE RED ACTIONS

Dieser Stand wird automatisch vor Preflight/Commit synchronisiert.

- Snapshot: `da5aaefa98589ba9`
- Candidate Changes: `8`

## Commit-Kandidat (Name-Status)
- `A` .github/rulesets/main-protection.json
- `A` .github/workflows/required-checks.yml
- `M` app/src/sot/FUNCTION_SOT.json
- `M` app/src/sot/REPO_HYGIENE_MAP.json
- `A` dev/tools/runtime/apply-github-ruleset.mjs
- `M` dev/tools/runtime/preflight-mutation-guard.mjs
- `M` docs/MANUEL/WORKFLOW.md
- `M` docs/SOT/REPO_HYGIENE_MAP.md

## Red-Actions (risikoreiche Treffer)
- `runtime-guard` -> `A` dev/tools/runtime/apply-github-ruleset.mjs
- `runtime-guard` -> `M` dev/tools/runtime/preflight-mutation-guard.mjs

## Regel
- Jeder Commit muss diesen Stand widerspruchsfrei spiegeln.

