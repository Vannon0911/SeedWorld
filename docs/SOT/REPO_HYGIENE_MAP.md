# Repo Hygiene Map

## Ownership
- **Kernel Core**: Deterministic execution and seed-bound kernel state transitions
  prefixes: app/src/kernel/deterministicKernel.js, app/src/kernel/fingerprint.js, app/src/kernel/runtimeGuards.js, app/src/kernel/seedGuard.js, app/src/kernel/KernelController.js, app/src/kernel/ActionRegistry.js, app/src/kernel/KernelRouter.js
- **Authoritative Content**: Canonical gameplay content and deterministic interpretation rules
  prefixes: app/src/game/
- **Reproduction Evidence**: Double-run orchestration, evidence generation, comparison and final proof
  prefixes: dev/scripts/evidence-shared.mjs, dev/scripts/test-runner.mjs, dev/scripts/verify-evidence.mjs, dev/tools/runtime/verify-testline-integrity.mjs, dev/tests/modules/
- **Documentation V2**: Human-readable truth, atomic planning tasks and archive automation
  prefixes: app/src/sot/docs-v2.json, docs/V2/, tem/tasks/, dev/tools/runtime/docs-v2-shared.mjs, dev/tools/runtime/scan-doc-tasks.mjs, dev/tools/runtime/sync-docs-v2.mjs
- **Deprecated Runtime**: No longer part of mandatory truth or gates
  prefixes: app/server/, start-server.js, app/src/main.js, app/src/browser/, app/src/ui/, app/src/plugins/, app/src/workers/, app/src/SeedWorld_WorldGen.mjs, dev/tools/patch/, dev/patches/, dev/scripts/playwright-tiles-full.mjs, dev/tools/runtime/preflight.mjs

## Entry Points
- dev/scripts/test-runner.mjs
- dev/scripts/verify-evidence.mjs
- dev/tools/runtime/verify-testline-integrity.mjs

## Unowned Files
- app/src/kernel/GateManager.js
- app/src/kernel/gates/accessGates.js
- app/src/kernel/gates/operationGates.js
- app/src/kernel/KernelGates.js
- app/src/kernel/PatchOrchestrator.js
- dev/scripts/build-evidence-bundle.mjs
- dev/scripts/repo-cleanup-baseline.mjs
- dev/scripts/runtime-guards-test.mjs

## Unreachable Code Files (from configured entrypoints)
- app/src/game/actions/buildAction.js
- app/src/game/actions/transportAction.js
- app/src/game/contracts/mutationMatrixConstraints.js
- app/src/game/gameConfig.js
- app/src/game/gameConstants.js
- app/src/game/gameInput.js
- app/src/game/GameLogicController.js
- app/src/game/gamePatchBuilders.js
- app/src/game/gameProgress.js
- app/src/game/gameStateReducer.js
- app/src/game/worldGen.js
- app/src/kernel/ActionRegistry.js
- app/src/kernel/deterministicKernel.js
- app/src/kernel/GateManager.js
- app/src/kernel/gates/accessGates.js
- app/src/kernel/gates/operationGates.js
- app/src/kernel/KernelController.js
- app/src/kernel/KernelGates.js
- app/src/kernel/KernelRouter.js
- app/src/kernel/PatchOrchestrator.js
- app/src/kernel/runtimeGuards.js
- app/src/kernel/seedGuard.js
- dev/scripts/build-evidence-bundle.mjs
- dev/scripts/repo-cleanup-baseline.mjs
- dev/scripts/runtime-guards-test.mjs
- dev/tests/modules/00.runtime-governance-suite.module.mjs
- dev/tests/modules/10.determinism-seed-proof-suite.module.mjs
- dev/tests/modules/20.gameplay-state-suite.module.mjs

## Zero Inbound Code Files (excluding entrypoints)
- app/src/game/contracts/mutationMatrixConstraints.js
- app/src/game/gameConstants.js
- app/src/game/GameLogicController.js
- app/src/kernel/deterministicKernel.js
- app/src/kernel/GateManager.js
- app/src/kernel/KernelGates.js
- app/src/kernel/PatchOrchestrator.js
- dev/scripts/build-evidence-bundle.mjs
- dev/scripts/repo-cleanup-baseline.mjs
- dev/scripts/runtime-guards-test.mjs
- dev/tests/modules/00.runtime-governance-suite.module.mjs
- dev/tests/modules/10.determinism-seed-proof-suite.module.mjs
- dev/tests/modules/20.gameplay-state-suite.module.mjs

## Cross-Owner Imports
- app/src/kernel/KernelController.js (Kernel Core) -> app/src/game/worldGen.js (Authoritative Content)
- dev/scripts/evidence-shared.mjs (Reproduction Evidence) -> app/src/kernel/fingerprint.js (Kernel Core)
- dev/scripts/runtime-guards-test.mjs (UNOWNED) -> app/src/kernel/runtimeGuards.js (Kernel Core)
- dev/scripts/test-runner.mjs (Reproduction Evidence) -> app/src/kernel/fingerprint.js (Kernel Core)

## Notes
- Unreachable/zero-inbound are candidates, not auto-delete orders.
- Dynamic imports built from runtime strings are not fully discoverable.
- Ownership comes from app/src/sot/repo-boundaries.json.

