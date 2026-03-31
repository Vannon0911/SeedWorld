import { KernelController } from "./kernel/KernelController.js";
import { GameLogicController } from "./game/GameLogicController.js";
import { UIController } from "./ui/UIController.js";
import { ViewportManager } from "./ui/ViewportManager.js";
import { RenderManager } from "./ui/RenderManager.js";

const kernel = new KernelController({ seed: "seedworld-v1" });
const gameLogic = new GameLogicController(kernel, { domain: "game" });
const viewportManager = new ViewportManager().start();
const renderManager = new RenderManager({ viewportManager }).start();

const ui = new UIController({
  gameLogic,
  viewportManager,
  renderManager,
  elements: {
    tileGridContainer: document.querySelector("#tile-grid-container")
  }
});

ui.bootstrap();
