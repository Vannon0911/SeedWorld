# AKTUELLE RED ACTIONS

Dieser Stand wird automatisch vor Preflight/Commit synchronisiert.

- Snapshot: `ed00ee8005c431d9`
- Candidate Changes: `31`

## Commit-Kandidat (Name-Status)
- `M` README.md
- `M` app/public/index.html
- `M` app/public/menu.html
- `D` app/public/patch-popup.html
- `D` app/public/patchUI.html
- `A` app/server/appServer.mjs
- `D` app/server/patchServer.mjs
- `D` app/server/runtimeCheckHandler.mjs
- `D` app/server/sessionRoutes.mjs
- `M` app/server/staticHandler.mjs
- `M` app/src/sot/FUNCTION_SOT.json
- `M` app/src/sot/REPO_HYGIENE_MAP.json
- `M` app/src/sot/repo-boundaries.json
- `M` app/src/sot/testline-integrity.json
- `M` app/src/ui/DevUIController.js
- `M` app/src/ui/MainMenuController.js
- `D` dev/scripts/patch-flow-test.mjs
- `M` dev/scripts/playwright-tiles-full.mjs
- `M` dev/scripts/smoke-test.mjs
- `M` dev/scripts/test-runner.mjs
- `M` dev/scripts/verify-evidence.mjs
- `M` dev/tests/README.md
- `D` dev/tests/modules/02.patch-flow-script.module.mjs
- `M` dev/tests/modules/05.static-handler-security.module.mjs
- `M` dev/tools/runtime/preflight-mutation-guard.mjs
- `M` dev/tools/runtime/syncDocs.mjs
- `M` docs/INDEX.md
- `M` docs/SOT/ORIENTATION.md
- `M` docs/SOT/REPO_HYGIENE_MAP.md
- `M` package.json
- `M` start-server.js

## Red-Actions (risikoreiche Treffer)
- `runtime-guard` -> `M` dev/tools/runtime/preflight-mutation-guard.mjs
- `runtime-guard` -> `M` dev/tools/runtime/syncDocs.mjs
- `script-surface` -> `M` package.json

## Regel
- Jeder Commit muss diesen Stand widerspruchsfrei spiegeln.

