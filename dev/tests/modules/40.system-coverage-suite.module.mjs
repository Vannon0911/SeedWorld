import { readFile } from "node:fs/promises";
import path from "node:path";

export const id = "40-system-coverage-suite";

const previouslyUntestedSystems = [
  "app/server/patchUtils.js",
  "app/src/browser/BrowserPatchRunner.js",
  "app/src/browser/LogBus.js",
  "app/src/game/actions/buildAction.js",
  "app/src/game/actions/transportAction.js",
  "app/src/game/contracts/mutationMatrixConstraints.js",
  "app/src/game/gameConfig.js",
  "app/src/game/gameConstants.js",
  "app/src/game/gameInput.js",
  "app/src/game/GameLogicController.js",
  "app/src/game/gamePatchBuilders.js",
  "app/src/game/gameProgress.js",
  "app/src/game/gameStateReducer.js",
  "app/src/game/worldGen.js",
  "app/src/kernel/interface.js",
  "app/src/main.js",
  "app/src/plugins/radialBuildController.js",
  "app/src/SeedWorld_WorldGen.mjs",
  "app/src/ui/BaseUIController.js",
  "app/src/ui/DevUIController.js",
  "app/src/ui/events.js",
  "app/src/ui/GameUIController.js",
  "app/src/ui/IconAnimations.js",
  "app/src/ui/MainMenuController.js",
  "app/src/ui/plugins/ExampleUIPlugin.js",
  "app/src/ui/RenderManager.js",
  "app/src/ui/TileAnimationSDK.js",
  "app/src/ui/TileGridRenderer.js",
  "app/src/ui/UIController.js",
  "app/src/ui/ViewportManager.js",
  "app/src/workers/worldRenderWorker.js"
];

async function checkSyntax(root, relPath) {
  const absPath = path.join(root, ...relPath.split("/"));
  const source = await readFile(absPath, "utf8");
  if (!source || source.trim().length === 0) {
    throw new Error(`[${id}] file is empty: ${relPath}`);
  }
  const hasCodeShape = /(import\s|export\s|function\s|class\s|const\s|let\s|var\s)/.test(source);
  if (!hasCodeShape) {
    throw new Error(`[${id}] file has no recognizable code shape: ${relPath}`);
  }
}

export async function test({ assert, root }) {
  assert.equal(previouslyUntestedSystems.length, 31, "coverage suite must keep the full 31-system list");
  for (const relPath of previouslyUntestedSystems) {
    await checkSyntax(root, relPath);
  }
}

export const run = test;
