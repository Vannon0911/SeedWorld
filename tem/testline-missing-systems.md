# Testline Missing Systems Report

Automatisch erzeugt aus `app/src/sot/REPO_HYGIENE_MAP.json`.

## Summary
- System-Codefiles gesamt: 46
- Direkt/indirekt durch Testline erreichbar: 46
- Ohne Testline-Bezug: 0

## Untested Systems
- none

## Tested Systems
- app/server/appServer.mjs
- app/server/patchUtils.js
- app/server/staticHandler.mjs
- app/src/browser/BrowserPatchRunner.js
- app/src/browser/LogBus.js
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
- app/src/kernel/fingerprint.js
- app/src/kernel/GateManager.js
- app/src/kernel/gates/accessGates.js
- app/src/kernel/gates/operationGates.js
- app/src/kernel/interface.js
- app/src/kernel/KernelController.js
- app/src/kernel/KernelGates.js
- app/src/kernel/KernelRouter.js
- app/src/kernel/PatchOrchestrator.js
- app/src/kernel/runtimeGuards.js
- app/src/kernel/seedGuard.js
- app/src/main.js
- app/src/plugins/radialBuildController.js
- app/src/SeedWorld_WorldGen.mjs
- app/src/ui/BaseUIController.js
- app/src/ui/DevUIController.js
- app/src/ui/events.js
- app/src/ui/GameUIController.js
- app/src/ui/IconAnimations.js
- app/src/ui/MainMenuController.js
- app/src/ui/plugins/ExampleUIPlugin.js
- app/src/ui/RenderManager.js
- app/src/ui/TileAnimationSDK.js
- app/src/ui/TileGridRenderer.js
- app/src/ui/UIController.js
- app/src/ui/UIPluginController.js
- app/src/ui/ViewportManager.js
- app/src/workers/worldRenderWorker.js

## Rule
- Zielzustand: `Untested Systems = 0` oder begruendete Ausnahme in `tem/slices/` dokumentiert.
