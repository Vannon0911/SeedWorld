const RESOURCE_TYPES = ["mine", "storage", "factory", "clear"];
const DRAW_TYPES = new Set(["mine", "storage", "factory"]);

/**
 * Get the tile at the given grid coordinates from the world object.
 * @param {Object} world - World object containing a `tiles` array and optional `size.width` used for indexing.
 * @param {number|string} x - X coordinate (number or numeric string) of the desired tile.
 * @param {number|string} y - Y coordinate (number or numeric string) of the desired tile.
 * @returns {Object|null} The matching tile object if found, `null` otherwise.
 */
export function getWorldTile(world, x, y) {
  if (!world || typeof world !== "object" || !Array.isArray(world.tiles)) {
    return null;
  }

  const tx = Number(x);
  const ty = Number(y);
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
    return null;
  }

  const width = Number.isInteger(world?.size?.width) ? world.size.width : 0;
  const index = width > 0 ? ty * width + tx : -1;
  const indexed = index >= 0 && index < world.tiles.length ? world.tiles[index] : null;
  if (indexed && Number(indexed.x) === tx && Number(indexed.y) === ty) {
    return indexed;
  }

  return world.tiles.find((tile) => Number(tile?.x) === tx && Number(tile?.y) === ty) || null;
}

/**
 * Map a resource/build type to its single-character icon.
 * @param {string} type - The resource or build type (e.g., "mine", "storage", "factory", "clear").
 * @returns {string} The icon character for the given type; an empty string if the type is unrecognized.
 */
function iconLabel(type) {
  if (type === "mine") return "◆";
  if (type === "storage") return "▣";
  if (type === "factory") return "✷";
  if (type === "clear") return "✕";
  return "";
}

/**
 * Create a coordinate key string for a tile.
 * @param {number|string} x - The x coordinate.
 * @param {number|string} y - The y coordinate.
 * @returns {string} The coordinate key in the format "x:y".
 */
function keyFor(x, y) {
  return `${x}:${y}`;
}

/**
 * Waits until the tile grid DOM root and the global `seedWorldUI` object exist on the page.
 * @returns {{root: Element, ui: any}} An object with `root` set to the element matching `#tile-grid-container .tile-grid` and `ui` set to `window.seedWorldUI`.
 */
function waitForGridRoot() {
  return new Promise((resolve) => {
    const tick = () => {
      const root = document.querySelector("#tile-grid-container .tile-grid");
      const ui = window.seedWorldUI;
      if (root && ui) {
        resolve({ root, ui });
        return;
      }

      window.setTimeout(tick, 40);
    };

    tick();
  });
}

/**
 * Retrieve the tiles array from the UI state or return an empty array if it is missing.
 * @param {object} ui - Object expected to contain `displayState.world.tiles`.
 * @returns {Array} The `tiles` array from `ui.displayState.world`, or an empty array when that value is not an array.
 */
function getTilesRef(ui) {
  const worldTiles = ui?.displayState?.world?.tiles;
  return Array.isArray(worldTiles) ? worldTiles : [];
}

/**
 * Compare two tile-like objects by row (`y`) then column (`x`) for ascending grid order.
 * @param {{x:number,y:number}} a - First tile with numeric `x` and `y` coordinates.
 * @param {{x:number,y:number}} b - Second tile with numeric `x` and `y` coordinates.
 * @returns {number} A negative value if `a` comes before `b`, a positive value if `a` comes after `b`, or `0` if they are equal.
 */
function sortByGrid(a, b) {
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
}

/**
 * Create nearest-neighbor link pairs between mines → storages and storages → factories.
 * 
 * @param {Array<{x: number, y: number, type: string}>} tiles - Array of tile objects (each with numeric `x`, `y` and `type`).
 * @returns {Array<{from: {x: number, y: number, type: string}, to: {x: number, y: number, type: string}}>} An array of link objects with `from` and `to` tiles; each source is paired to the nearest remaining target. The returned array contains mine→storage pairs first, followed by storage→factory pairs.
 */
function buildLinks(tiles) {
  const mines = [];
  const storages = [];
  const factories = [];

  for (const tile of tiles) {
    if (tile.type === "mine") mines.push(tile);
    if (tile.type === "storage") storages.push(tile);
    if (tile.type === "factory") factories.push(tile);
  }

  mines.sort(sortByGrid);
  storages.sort(sortByGrid);
  factories.sort(sortByGrid);

  function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  /**
   * For each source tile, selects the nearest available target tile and returns the formed pairs.
   *
   * @param {Array<Object>} sources - Array of source tile objects (each with numeric `x` and `y`).
   * @param {Array<Object>} targets - Array of target tile objects (each with numeric `x` and `y`).
   * @returns {Array<Object>} Array of pair objects in source iteration order; each pair has `from` (source tile) and `to` (matched target tile). Each target is matched at most once.
   */
  function pairNearest(sources, targets) {
    const out = [];
    const remaining = new Set(targets.map((tile) => keyFor(tile.x, tile.y)));
    const targetMap = new Map(targets.map((tile) => [keyFor(tile.x, tile.y), tile]));

    for (const source of sources) {
      let bestKey = null;
      let bestDist = Number.POSITIVE_INFINITY;

      for (const key of remaining) {
        const target = targetMap.get(key);
        if (!target) {
          continue;
        }

        const dist = distanceSq(source, target);
        if (dist < bestDist) {
          bestDist = dist;
          bestKey = key;
        }
      }

      if (bestKey) {
        out.push({ from: source, to: targetMap.get(bestKey) });
        remaining.delete(bestKey);
      }
    }

    return out;
  }

  return [...pairNearest(mines, storages), ...pairNearest(storages, factories)];
}

/**
 * Compute the tile's center point in pixels relative to the provided root element.
 *
 * If a `renderManager` with a `worldToScreen` method is provided, that method is used to obtain the screen-space coordinates for the tile; otherwise the function locates the tile DOM node inside `root` and computes its center from layout.
 *
 * @param {Element} root - Container element that contains tile elements; used as the coordinate origin when falling back to DOM geometry.
 * @param {{x:number,y:number}} tile - Grid coordinates of the tile to locate.
 * @param {Object|null} [renderManager=null] - Optional object exposing `worldToScreen(x, y)` to convert world coordinates to screen coordinates.
 * @returns {{x:number,y:number}|null} The center `{ x, y }` in pixels relative to `root`, or `null` if the tile cannot be resolved. 
 */
function getTileCenter(root, tile, renderManager = null) {
  if (renderManager && typeof renderManager.worldToScreen === "function") {
    return renderManager.worldToScreen(tile.x, tile.y);
  }

  const node = root.querySelector(`.tile[data-x="${tile.x}"][data-y="${tile.y}"]`);
  if (!node) {
    return null;
  }

  const rootRect = root.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left - rootRect.left + rect.width / 2,
    y: rect.top - rootRect.top + rect.height / 2
  };
}

/**
 * Draw connection lines in the given SVG between the centers of linked drawable tiles.
 *
 * Clears the SVG and appends one `<line>` per link produced from the provided tiles; links whose
 * tile centers cannot be resolved are skipped.
 *
 * @param {SVGElement} svg - SVG element whose children will be replaced with connection lines.
 * @param {Element} root - Root DOM element containing tile elements used to compute center coordinates.
 * @param {Array<Object>} tiles - Array of tile objects (each with at least `x`, `y`, and `type`) used to build links.
 * @param {number} dashOffset - Value assigned to each line's `stroke-dashoffset` style.
 * @param {Object|null} renderManager - Optional geometry manager exposing `worldToScreen(x,y)` to compute centers; if not provided, DOM geometry is used.
 */
function drawConnections(svg, root, tiles, dashOffset, renderManager = null) {
  svg.replaceChildren();

  for (const link of buildLinks(tiles.filter((tile) => DRAW_TYPES.has(tile.type)))) {
    const from = getTileCenter(root, link.from, renderManager);
    const to = getTileCenter(root, link.to, renderManager);
    if (!from || !to) {
      continue;
    }

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "connection-line");
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    line.style.strokeDashoffset = String(dashOffset);
    svg.append(line);
  }
}

/**
 * Create a compact string signature that represents each tile's position and type.
 *
 * @param {Array<{x: number, y: number, type: string}>} tiles - Array of tile objects; each item must have `x`, `y`, and `type` properties.
 * @returns {string} A single string of the form `"x,y,type|x,y,type|..."`, with entries in the same order as `tiles`.
 */
function buildTileSignature(tiles) {
  return tiles
    .map((tile) => `${tile.x},${tile.y},${tile.type}`)
    .join("|");
}

/**
 * Create and append a hidden radial menu containing build option buttons.
 *
 * The menu contains one `.radial-option` button for each of: `"mine"`, `"storage"`, `"factory"`, and `"clear"`.
 * Each button's `dataset.type` is set to the resource type, its CSS custom property `--a` is set to the placement angle,
 * `title` is set to the type, and `textContent` is set via `iconLabel(type)`.
 *
 * @param {HTMLElement} root - The container element to which the radial menu will be appended.
 * @returns {HTMLElement} The created `.radial-menu` element (initially `hidden = true`).
 */
function installRadialMenu(root) {
  const menu = document.createElement("div");
  menu.className = "radial-menu";
  menu.hidden = true;

  const defs = [
    { type: "mine", angle: -90 },
    { type: "storage", angle: -18 },
    { type: "factory", angle: 54 },
    { type: "clear", angle: 126 }
  ];

  for (const def of defs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "radial-option";
    button.dataset.type = def.type;
    button.style.setProperty("--a", String(def.angle));
    button.title = def.type;
    button.textContent = iconLabel(def.type);
    menu.append(button);
  }

  root.append(menu);
  return menu;
}

/**
 * Update the debug UI elements (#status-value and #summary-value) to reflect the current selection, target tile, and link count.
 * @param {string|number|null} selected - The current selection (for example a resource type or other selector value) shown in the summary.
 * @param {{x:number,y:number}|null} tile - The target tile coordinates; when provided the status displays "tile:x,y", otherwise it displays "bereit".
 * @param {number} linksCount - The number of connection links to include in the summary output.
 */
function updateDebug(selected, tile, linksCount) {
  const status = document.getElementById("status-value");
  const summary = document.getElementById("summary-value");
  if (status) {
    status.textContent = tile ? `tile:${tile.x},${tile.y}` : "bereit";
  }
  if (summary) {
    summary.textContent = JSON.stringify({ selected, links: linksCount }, null, 2);
  }
}

/**
 * Install an interactive radial build controller on the tile grid that provides a radial menu for placing or clearing tiles, draws animated connections between relevant tiles, and reacts to viewport and resize events.
 *
 * This function waits for the grid root and game UI to become available, adds an SVG connection layer and a radial menu to the grid root, and wires event handlers for pointer interaction, viewport changes, and an animation loop. It requires the game UI to expose `applyGameAction` to perform tile updates.
 *
 * @param {Object} [options] - Optional configuration.
 * @param {Object|null} [options.viewportManager=null] - Optional viewport manager; when it exposes `subscribe`, that subscription is used to trigger SVG resize and connection redraws. If omitted, the controller falls back to window resize events.
 * @param {Object|null} [options.renderManager=null] - Optional render/geometry manager that exposes `worldToScreen(x, y)`; when provided it is used to position the radial menu and compute connection endpoints in screen space.
 */
export function installRadialBuildController({ viewportManager = null, renderManager = null } = {}) {
  waitForGridRoot().then(({ root, ui }) => {
    if (!ui || typeof ui.applyGameAction !== "function") {
      throw new Error("[RADIAL_BUILD] seedWorldUI.applyGameAction fehlt.");
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("connection-layer");
    root.append(svg);

    const menu = installRadialMenu(root);
    let selectedType = "mine";
    let targetTile = null;
    let dashOffset = 0;
    let lastSignature = "";
    const geometryManager =
      renderManager && typeof renderManager.worldToScreen === "function"
        ? renderManager
        : window.seedWorldRenderManager && typeof window.seedWorldRenderManager.worldToScreen === "function"
          ? window.seedWorldRenderManager
          : null;

    const optionNodes = () => Array.from(menu.querySelectorAll(".radial-option"));

    /**
     * Set the SVG element's viewBox to match the root container's client width and height.
     *
     * Width and height are clamped to a minimum of 1 to avoid zero-sized viewBoxes.
     */
    function resizeSvg() {
      const width = Math.max(1, root.clientWidth);
      const height = Math.max(1, root.clientHeight);
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    /**
     * Set the active resource type for the radial menu and update option buttons to reflect the selection.
     * @param {string} type - Desired resource type; if not included in RESOURCE_TYPES, defaults to `"mine"`.
     */
    function setActive(type) {
      selectedType = RESOURCE_TYPES.includes(type) ? type : "mine";
      for (const node of optionNodes()) {
        node.classList.toggle("is-active", node.dataset.type === selectedType);
      }
    }

    /**
     * Position and show the radial menu centered on a tile.
     *
     * If a geometry manager exposing `worldToScreen(x, y)` is available, the provided
     * `tileCoords` (world coordinates) will be used to compute the screen position;
     * otherwise the DOM geometry of `tileEl` is used as a fallback. The menu is made
     * visible and the current selection is applied.
     *
     * @param {Element} tileEl - The tile DOM element used for fallback positioning.
     * @param {{x: number, y: number}|null} [tileCoords=null] - Optional world coordinates of the tile to use for positioning when available.
     */
    function openMenuAt(tileEl, tileCoords = null) {
      let center = null;
      if (tileCoords && geometryManager && typeof geometryManager.worldToScreen === "function") {
        center = geometryManager.worldToScreen(tileCoords.x, tileCoords.y);
      }

      if (!center) {
        const tileRect = tileEl.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        center = {
          x: tileRect.left - rootRect.left + tileRect.width / 2,
          y: tileRect.top - rootRect.top + tileRect.height / 2
        };
      }

      menu.style.left = `${center.x}px`;
      menu.style.top = `${center.y}px`;
      menu.hidden = false;
      setActive(selectedType);
    }

    /**
     * Hide the radial menu.
     */
    function closeMenu() {
      menu.hidden = true;
    }

    /**
     * Update connection lines for the current tiles, skipping work when the tile layout is unchanged unless forced.
     * @param {boolean} force - If `true`, redraw even when the tile signature has not changed.
     */
    function redrawConnections(force = false) {
      const tiles = getTilesRef(ui);
      const signature = buildTileSignature(tiles);
      if (!force && signature === lastSignature) {
        return;
      }

      lastSignature = signature;
      drawConnections(svg, root, tiles, dashOffset, geometryManager);
    }

    /**
     * Finds the tile element and numeric coordinates associated with a pointer event.
     * @param {Event} event - Pointer/mouse event whose target is searched for a parent `.tile` element.
     * @returns {{x: number, y: number, el: Element}|null} An object containing numeric `x` and `y` coordinates and the tile element `el`, or `null` if no valid tile is found.
     */
    function resolveTileFromPointer(event) {
      const tileEl = event.target?.closest?.(".tile");
      if (!tileEl || !root.contains(tileEl)) {
        return null;
      }

      const x = Number(tileEl.dataset.x);
      const y = Number(tileEl.dataset.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return { x, y, el: tileEl };
    }

    /**
     * Apply the selected build action to the currently targeted tile.
     *
     * If `type` is `"clear"`, the tile is set to `"empty"`; otherwise the tile is set to `type`.
     * Updates debug information, forces a connections redraw, and closes the radial menu.
     *
     * @param {string} type - The build action type (e.g. `"mine"`, `"storage"`, `"factory"`, or `"clear"`).
     * @returns {*} The result returned by `ui.applyGameAction` for the `set_tile_type` action, or `undefined` if no target tile was selected.
     */
    async function applyPlacement(type) {
      if (!targetTile) {
        return;
      }

      const tileType = type === "clear" ? "empty" : type;
      const result = ui.applyGameAction({
        type: "set_tile_type",
        payload: {
          x: targetTile.x,
          y: targetTile.y,
          tileType
        }
      });

      const links = buildLinks(getTilesRef(ui).filter((tile) => DRAW_TYPES.has(tile.type)));
      updateDebug(type, { x: targetTile.x, y: targetTile.y }, links.length);
      redrawConnections(true);
      closeMenu();
      return result;
    }

    root.addEventListener("click", async (event) => {
      const option = event.target?.closest?.(".radial-option");
      if (option && menu.contains(option)) {
        setActive(option.dataset.type || "mine");
        try {
          await applyPlacement(selectedType);
        } catch (error) {
          updateDebug("error", targetTile, 0);
          console.error("[RADIAL_BUILD] applyPlacement failed:", error);
        }
        return;
      }

      const tile = resolveTileFromPointer(event);
      if (!tile) {
        closeMenu();
        return;
      }

      targetTile = { x: tile.x, y: tile.y, el: tile.el, key: keyFor(tile.x, tile.y) };
      openMenuAt(tile.el, { x: tile.x, y: tile.y });
      updateDebug(selectedType, { x: tile.x, y: tile.y }, 0);
    });

    const viewport = viewportManager || window.seedWorldViewportManager;
    if (viewport && typeof viewport.subscribe === "function") {
      viewport.subscribe(
        () => {
          resizeSvg();
          redrawConnections(true);
        },
        { immediate: false }
      );
    } else {
      window.addEventListener(
        "resize",
        () => {
          resizeSvg();
          redrawConnections(true);
        },
        { passive: true }
      );
    }

    setActive(selectedType);
    resizeSvg();
    redrawConnections(true);

    const animate = () => {
      dashOffset -= 1.4;
      for (const line of svg.querySelectorAll(".connection-line")) {
        line.style.strokeDashoffset = String(dashOffset);
      }
      redrawConnections(false);
      window.requestAnimationFrame(animate);
    };

    animate();
  });
}
