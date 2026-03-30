import { MS_PER_TICK } from "./IconAnimations.js";
import { TileGridRenderer } from "./TileGridRenderer.js";
import { generateWorld } from "../game/worldGen.js";
import { DEFAULT_GRID_BOUNDS, DEFAULT_TILE_SIZE } from "./RenderManager.js";

const DEFAULT_ACTION = Object.freeze({
  type: "inspect",
  payload: {}
});

const DEFAULT_STATE = Object.freeze({
  world: {
    seed: "seedworld-v1",
    size: {
      width: DEFAULT_GRID_BOUNDS.width,
      height: DEFAULT_GRID_BOUNDS.height
    }
  }
});

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function clone(value) {
  return structuredClone(value);
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function parseJson(text, fallback, label) {
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) {
    return clone(fallback);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      throw new Error(`${label} muss JSON-Objekt sein.`);
    }

    return parsed;
  } catch (error) {
    throw new Error(`[UI_CONTROLLER] ${label}: ${error.message}`);
  }
}

function setTextContent(element, value) {
  if (element) {
    element.textContent = value;
  }
}

/**
 * Toggle the disabled state on a list of DOM elements.
 * @param {Iterable<HTMLElement|null|undefined>} elements - Iterable of elements; null/undefined entries are ignored.
 * @param {boolean} disabled - Whether to disable (`true`) or enable (`false`) the provided elements.
 */
function setDisabled(elements, disabled) {
  for (const element of elements) {
    if (element) {
      element.disabled = disabled;
    }
  }
}

/**
 * Convert a numeric value to a positive integer or return a fallback.
 * @param {number} value - The value to normalize into a positive integer.
 * @param {?number} [fallback=null] - The value to return when `value` is not a finite number or not greater than zero.
 * @returns {?number} The truncated integer greater than zero if `value` is finite and > 0, otherwise `fallback`.
 */
function toPositiveInteger(value, fallback = null) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : fallback;
}

/**
 * Derives a renderable grid specification (width, height, tileSize) from the provided state, using fallback values when the state does not supply valid dimensions.
 * @param {Object} state - Game/UI state that may contain `world.size` (with `width`/`height`) or `world.tiles` (array of tiles with numeric `x`/`y`).
 * @param {Object} [fallback={}] - Fallback values used when the state does not provide valid numbers.
 * @param {number} [fallback.width] - Fallback width to use when width cannot be derived from state.
 * @param {number} [fallback.height] - Fallback height to use when height cannot be derived from state.
 * @param {number} [fallback.tileSize] - Fallback tile size to use when not specified.
 * @returns {{width: number, height: number, tileSize: number}} An object containing positive integer `width` and `height` (derived from `state.world.size`, inferred from `state.world.tiles` as max coordinate + 1, or the provided fallbacks) and `tileSize` (from fallback or default).
 */
function resolveGridSpecFromState(state, fallback = {}) {
  const fallbackWidth = toPositiveInteger(fallback.width, DEFAULT_GRID_BOUNDS.width);
  const fallbackHeight = toPositiveInteger(fallback.height, DEFAULT_GRID_BOUNDS.height);
  const fallbackTileSize = toPositiveInteger(fallback.tileSize, DEFAULT_TILE_SIZE);
  const world = isPlainObject(state?.world) ? state.world : {};
  const size = isPlainObject(world.size) ? world.size : {};

  let width = toPositiveInteger(size.width, null);
  let height = toPositiveInteger(size.height, null);

  if ((!width || !height) && Array.isArray(world.tiles) && world.tiles.length > 0) {
    let maxX = -1;
    let maxY = -1;
    for (const tile of world.tiles) {
      const x = Number.isFinite(tile?.x) ? Math.trunc(tile.x) : -1;
      const y = Number.isFinite(tile?.y) ? Math.trunc(tile.y) : -1;
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    }

    width = width || toPositiveInteger(maxX + 1, fallbackWidth);
    height = height || toPositiveInteger(maxY + 1, fallbackHeight);
  }

  return {
    width: width || fallbackWidth,
    height: height || fallbackHeight,
    tileSize: fallbackTileSize
  };
}

export class UIController {
  constructor({ kernel, gameLogic, kernelCommand, renderManager = null, elements = {} } = {}) {
    if (!kernel || typeof kernel.plan !== "function" || typeof kernel.apply !== "function") {
      throw new Error("[UI_CONTROLLER] kernel mit plan/apply erforderlich.");
    }

    if (!gameLogic || typeof gameLogic.calculateAction !== "function") {
      throw new Error("[UI_CONTROLLER] gameLogic mit calculateAction erforderlich.");
    }

    if (typeof kernelCommand !== "function") {
      throw new Error("[UI_CONTROLLER] kernelCommand erforderlich.");
    }

    this.kernel = kernel;
    this.gameLogic = gameLogic;
    this.kernelCommand = kernelCommand;
    this.renderManager = renderManager && typeof renderManager.subscribe === "function" ? renderManager : null;
    this.unsubscribeViewport = null;
    this.elements = elements;
    this.currentState = clone(DEFAULT_STATE);
    this.displayState = clone(DEFAULT_STATE);
    this.lastPlan = null;
    this.lastApply = null;
    this.lastGuardResult = null;
    this.busy = false;
    this.currentTick = 0;
    this.tickTimer = null;
    this.tickDrainTimer = null;
    this.renderFrameHandle = null;
    this.pendingTicks = 0;
    this.tickRateMs = Number.isFinite(elements.tickRateMs) ? elements.tickRateMs : MS_PER_TICK;
    this.tileGridRenderer = null;
    this.tileClickHandler = ({ tile, x, y }) => {
      this.#renderStatus(`tile:${x},${y}`);
      this.#renderSummary({
        mode: "tile-click",
        tile
      });
    };
  }

  bootstrap() {
    this.#ensureDefaultInputs();
    this.#ensureWorldState();
    this.#syncRenderGridFromState(this.currentState);
    this.#bindViewport();
    this.#renderGrid();
    this.#startTickScheduler();
    this.#startRenderLoop();
    this.refresh();
  }

  async handlePlan() {
    try {
      this.#setBusy(true);
      const request = this.#readRequest();
      const result = this.gameLogic.applyActionLocally(request.action, request.state);

      this.lastPlan = result;
      this.displayState = clone(result.previewState);
      this.#syncRenderGridFromState(this.displayState);
      this.#renderStatus("plan-ok");
      this.#renderSummary({
        mode: "plan",
        kernel: result
      });
      this.#renderState(this.displayState);
      this.#renderGrid();
    } catch (error) {
      this.#renderStatus("plan-blocked");
      this.#renderSummary({ error: String(error.message || error) });
    } finally {
      this.#setBusy(false);
    }
  }

  async handleApply() {
    try {
      this.#setBusy(true);
      const request = this.#readRequest();
      const result = this.gameLogic.applyActionLocally(request.action, request.state);

      this.currentState = clone(result.previewState);
      this.displayState = clone(result.previewState);
      this.#syncRenderGridFromState(this.currentState);
      this.lastApply = result;
      this.#syncStateInput(this.currentState);
      this.#renderStatus("apply-ok");
      this.#renderSummary({
        mode: "apply",
        kernel: result
      });
      this.#renderState(this.currentState);
      this.#renderGrid();
    } catch (error) {
      this.#renderStatus("apply-blocked");
      this.#renderSummary({ error: String(error.message || error) });
    } finally {
      this.#setBusy(false);
    }
  }

  refresh() {
    try {
      this.currentState = this.#readStateInput();
      this.displayState = clone(this.currentState);
      this.#ensureWorldState();
      this.#syncRenderGridFromState(this.currentState);
      this.#renderStatus("refresh");
      this.#renderSummary({
        mode: "refresh",
        kernelState: this.currentState
      });
      this.#renderState(this.currentState);
      this.#renderGrid();
    } catch (error) {
      this.#renderStatus("refresh-blocked");
      this.#renderSummary({ error: String(error.message || error) });
    }
  }

  async handleGuard() {
    this.#setBusy(true);
    try {
      const result = await this.kernelCommand("governance.llm-chain", {
        domain: "kernelMeta",
        state: { kernelMeta: { revision: 1, note: "baseline" } },
        action: { type: "PATCH_REVIEW", payload: { requestedBy: "ui" } },
        actionSchema: {
          PATCH_REVIEW: { required: ["requestedBy"] }
        },
        mutationMatrix: {
          kernelMeta: ["kernelMeta.revision", "kernelMeta.note"]
        },
        patches: [
          { op: "set", path: "kernelMeta.revision", value: 2, domain: "kernelMeta" },
          { op: "set", path: "kernelMeta.note", value: "reviewed", domain: "kernelMeta" }
        ]
      });

      this.lastGuardResult = result;
      this.#renderStatus("guard-ok");
      setTextContent(this.elements.guardValue, pretty(result));
    } catch (error) {
      this.#renderStatus("guard-blocked");
      setTextContent(this.elements.guardValue, String(error.message || error));
    } finally {
      this.#setBusy(false);
    }
  }

  applyGameAction(action, state = this.currentState) {
    const result = this.gameLogic.applyActionLocally(action, state);
    this.currentState = clone(result.previewState);
    this.displayState = clone(result.previewState);
    this.#syncRenderGridFromState(this.currentState);
    this.lastApply = result;
    this.#syncStateInput(this.currentState);
    this.#renderState(this.currentState);
    this.#renderGrid();
    return result;
  }

  #readRequest() {
    const action = parseJson(this.elements.actionInput?.value, DEFAULT_ACTION, "action");
    const state = parseJson(this.elements.stateInput?.value, DEFAULT_STATE, "state");
    return { action, state };
  }

  #readStateInput() {
    if (!this.elements.stateInput) {
      return clone(this.currentState);
    }
    return parseJson(this.elements.stateInput?.value, DEFAULT_STATE, "state");
  }

  #ensureDefaultInputs() {
    if (this.elements.actionInput && !this.elements.actionInput.value.trim()) {
      this.elements.actionInput.value = pretty(DEFAULT_ACTION);
    }

    if (this.elements.stateInput && !this.elements.stateInput.value.trim()) {
      this.elements.stateInput.value = pretty(DEFAULT_STATE);
    }

    this.currentState = clone(DEFAULT_STATE);
    this.displayState = clone(DEFAULT_STATE);
    this.#renderStatus("ready");
    this.#renderSummary({ mode: "boot" });
    this.#renderState(this.currentState);
    setTextContent(this.elements.guardValue, "-");
  }

  #ensureTileGrid() {
    const container = this.elements.tileGridContainer || document.getElementById("tile-grid-container");
    if (!container) {
      return;
    }

    const snapshot = this.#getRenderSnapshot();
    const shouldRebuild =
      !this.tileGridRenderer ||
      this.tileGridRenderer.width !== snapshot.gridBounds.width ||
      this.tileGridRenderer.height !== snapshot.gridBounds.height ||
      this.tileGridRenderer.tileSize !== snapshot.tileSize;

    if (shouldRebuild) {
      this.tileGridRenderer = new TileGridRenderer(
        container,
        snapshot.gridBounds.width,
        snapshot.gridBounds.height,
        snapshot.tileSize
      );
      this.tileGridRenderer.onTileClick(this.tileClickHandler);
    }

    if (typeof this.tileGridRenderer?.onViewportChange === "function") {
      this.tileGridRenderer.onViewportChange(snapshot.viewport);
    }
  }

  #bindViewport() {
    if (this.unsubscribeViewport || !this.renderManager) {
      return;
    }

    this.unsubscribeViewport = this.renderManager.subscribe((snapshot) => {
      this.#ensureTileGrid();
      if (this.tileGridRenderer && typeof this.tileGridRenderer.onViewportChange === "function") {
        this.tileGridRenderer.onViewportChange(snapshot.viewport);
      }
      this.#renderGrid();
    });
  }

  #renderGrid() {
    this.#ensureTileGrid();
    if (this.tileGridRenderer) {
      this.tileGridRenderer.render(this.displayState, this.currentTick);
    }
  }

  #ensureWorldState() {
    const world = this.currentState?.world;
    if (world && Array.isArray(world.tiles) && world.tiles.length > 0) {
      this.#syncRenderGridFromState(this.currentState);
      return;
    }

    const payload = {
      seed: typeof world?.seed === "string" && world.seed.trim() ? world.seed.trim() : "seedworld-v1",
      width: Number.isInteger(world?.size?.width) ? world.size.width : DEFAULT_GRID_BOUNDS.width,
      height: Number.isInteger(world?.size?.height) ? world.size.height : DEFAULT_GRID_BOUNDS.height
    };

    const applyLocalFallback = () => {
      const generated = generateWorld(payload);
      this.currentState = clone({
        ...this.currentState,
        world: generated
      });
      this.displayState = clone(this.currentState);
      this.#syncStateInput(this.currentState);
    };

    try {
      const result = this.gameLogic.applyActionLocally({ type: "generate_world", payload }, this.currentState);
      this.currentState = clone(result.previewState);
      this.displayState = clone(result.previewState);
      this.#syncStateInput(this.currentState);
    } catch (_) {
      applyLocalFallback();
    }

    this.#syncRenderGridFromState(this.currentState);
  }

  #startTickScheduler() {
    if (this.tickTimer !== null || typeof window === "undefined" || typeof window.setInterval !== "function") {
      return;
    }

    this.tickTimer = window.setInterval(() => {
      this.pendingTicks += 1;
    }, this.tickRateMs);

    this.tickDrainTimer = window.setInterval(() => {
      if (this.pendingTicks <= 0) {
        return;
      }
      const batch = Math.min(this.pendingTicks, 5);
      this.pendingTicks -= batch;
      this.currentTick += batch;
    }, 4);
  }

  #startRenderLoop() {
    if (
      this.renderFrameHandle !== null ||
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      return;
    }

    const frame = () => {
      this.#renderGrid();
      this.renderFrameHandle = window.requestAnimationFrame(frame);
    };

    this.renderFrameHandle = window.requestAnimationFrame(frame);
  }

  #renderStatus(value) {
    setTextContent(this.elements.statusValue, value);
  }

  #renderSummary(value) {
    setTextContent(this.elements.summaryValue, pretty(value));
  }

  #renderState(value) {
    setTextContent(this.elements.stateValue, pretty(value));
  }

  #syncStateInput(value) {
    if (this.elements.stateInput) {
      this.elements.stateInput.value = pretty(value);
    }
  }

  #setBusy(isBusy) {
    this.busy = isBusy;
    const controls = [
      this.elements.planButton,
      this.elements.applyButton,
      this.elements.refreshButton,
      this.elements.guardButton
    ];

    if (this.elements.form) {
      this.elements.form.toggleAttribute("aria-busy", isBusy);
    }

    setDisabled(controls.filter(Boolean), isBusy);
  }

  #getRenderSnapshot() {
    if (this.renderManager && typeof this.renderManager.getSnapshot === "function") {
      return this.renderManager.getSnapshot();
    }

    const gridSpec = resolveGridSpecFromState(this.displayState, {
      width: DEFAULT_GRID_BOUNDS.width,
      height: DEFAULT_GRID_BOUNDS.height,
      tileSize: DEFAULT_TILE_SIZE
    });

    return {
      viewport: {
        width: 0,
        height: 0,
        devicePixelRatio: 1
      },
      tileSize: gridSpec.tileSize,
      gridBounds: {
        width: gridSpec.width,
        height: gridSpec.height
      }
    };
  }

  #syncRenderGridFromState(state) {
    const snapshot = this.renderManager && typeof this.renderManager.getSnapshot === "function"
      ? this.renderManager.getSnapshot()
      : null;

    const gridSpec = resolveGridSpecFromState(state, {
      width: snapshot?.gridBounds?.width ?? DEFAULT_GRID_BOUNDS.width,
      height: snapshot?.gridBounds?.height ?? DEFAULT_GRID_BOUNDS.height,
      tileSize: snapshot?.tileSize ?? DEFAULT_TILE_SIZE
    });

    if (this.renderManager && typeof this.renderManager.setGrid === "function") {
      this.renderManager.setGrid(gridSpec);
    }

    this.#ensureTileGrid();
  }
}
