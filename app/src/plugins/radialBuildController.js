const RESOURCE_TYPES = ["mine", "storage", "factory", "clear"];
const DRAW_TYPES = new Set(["mine", "storage", "factory"]);

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

function iconLabel(type) {
  if (type === "mine") return "◆";
  if (type === "storage") return "▣";
  if (type === "factory") return "✷";
  if (type === "clear") return "✕";
  return "";
}

function keyFor(x, y) {
  return `${x}:${y}`;
}

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

function getTilesRef(ui) {
  const worldTiles = ui?.displayState?.world?.tiles;
  return Array.isArray(worldTiles) ? worldTiles : [];
}

function sortByGrid(a, b) {
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
}

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

function getTileCenter(root, tile) {
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

function drawConnections(svg, root, tiles, dashOffset) {
  svg.replaceChildren();

  for (const link of buildLinks(tiles.filter((tile) => DRAW_TYPES.has(tile.type)))) {
    const from = getTileCenter(root, link.from);
    const to = getTileCenter(root, link.to);
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

function buildTileSignature(tiles) {
  return tiles
    .map((tile) => `${tile.x},${tile.y},${tile.type}`)
    .join("|");
}

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

export function installRadialBuildController({ viewportManager = null } = {}) {
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

    const optionNodes = () => Array.from(menu.querySelectorAll(".radial-option"));

    function resizeSvg() {
      const width = Math.max(1, root.clientWidth);
      const height = Math.max(1, root.clientHeight);
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    function setActive(type) {
      selectedType = RESOURCE_TYPES.includes(type) ? type : "mine";
      for (const node of optionNodes()) {
        node.classList.toggle("is-active", node.dataset.type === selectedType);
      }
    }

    function openMenuAt(tileEl) {
      const tileRect = tileEl.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const cx = tileRect.left - rootRect.left + tileRect.width / 2;
      const cy = tileRect.top - rootRect.top + tileRect.height / 2;
      menu.style.left = `${cx}px`;
      menu.style.top = `${cy}px`;
      menu.hidden = false;
      setActive(selectedType);
    }

    function closeMenu() {
      menu.hidden = true;
    }

    function redrawConnections(force = false) {
      const tiles = getTilesRef(ui);
      const signature = buildTileSignature(tiles);
      if (!force && signature === lastSignature) {
        return;
      }

      lastSignature = signature;
      drawConnections(svg, root, tiles, dashOffset);
    }

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

      const tileEl = event.target?.closest?.(".tile");
      if (!tileEl || !root.contains(tileEl)) {
        closeMenu();
        return;
      }

      const x = Number(tileEl.dataset.x);
      const y = Number(tileEl.dataset.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }

      targetTile = { x, y, el: tileEl, key: keyFor(x, y) };
      openMenuAt(tileEl);
      updateDebug(selectedType, { x, y }, 0);
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
