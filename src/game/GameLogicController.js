import { createDefaultWorldMap, getWorldTile } from "../plugins/radialBuildController.js";
import {
  TICKS_PER_SECOND,
  MS_PER_TICK,
  getStorageCapacity,
  advanceTickState
} from "./gameConstants.js";

const STRUCTURE_LABELS = Object.freeze({
  miner: "Abbauer",
  storage: "Lager",
  smelter: "Schmelze"
});

function cloneState(value) {
  return structuredClone(value);
}

function countStructures(state, type) {
  return Array.isArray(state?.structures)
    ? state.structures.filter((structure) => structure.type === type).length
    : 0;
}

function findStructure(state, x, y) {
  return Array.isArray(state?.structures)
    ? state.structures.find((structure) => structure.x === x && structure.y === y) || null
    : null;
}

function nextStructureId(state, type) {
  return `${type}-${countStructures(state, type) + 1}`;
}

function incrementStats(stats, type) {
  if (type === "miner") {
    stats.minersBuilt += 1;
  } else if (type === "storage") {
    stats.storagesBuilt += 1;
  } else if (type === "smelter") {
    stats.smeltersBuilt += 1;
  }
}

function createInitialState() {
  return {
    world: createDefaultWorldMap(),
    clock: {
      tick: 0,
      ticksPerSecond: TICKS_PER_SECOND,
      secondsElapsed: 0
    },
    resources: {
      ore: 0,
      iron: 0
    },
    structures: [],
    stats: {
      minersBuilt: 0,
      storagesBuilt: 0,
      smeltersBuilt: 0,
      minedTotal: 0,
      smeltedTotal: 0
    },
    meta: {
      mapName: "Pixel Basin",
      lastAction: "boot",
      statusText: "Standardkarte geladen",
      summaryText: "Ersten Abbauer auf ein Erzfeld setzen. 24 Ticks = 1 Sekunde."
    }
  };
}

function getStructurePrice(state, structureType) {
  const minersBuilt = countStructures(state, "miner");
  const smeltersBuilt = countStructures(state, "smelter");
  const ore = Number.isFinite(state?.resources?.ore) ? state.resources.ore : 0;

  if (structureType === "miner") {
    if (minersBuilt === 0) {
      return { iron: 0, locked: false, label: "gratis", reason: "Erster Abbauer gratis" };
    }
    return { iron: 5, locked: false, label: "5 Eisen", reason: "Weitere Abbauer kosten 5 Eisen" };
  }

  if (structureType === "smelter") {
    if (smeltersBuilt === 0 && ore < 5) {
      return { iron: 0, locked: true, label: "gesperrt", reason: "Erste Schmelze wird bei 5 Erz gratis freigeschaltet" };
    }
    if (smeltersBuilt === 0) {
      return { iron: 0, locked: false, label: "gratis", reason: "Erste Schmelze gratis ab 5 Erz" };
    }
    return { iron: 5, locked: false, label: "5 Eisen", reason: "Weitere Schmelzen kosten 5 Eisen" };
  }

  if (structureType === "storage") {
    return { iron: 0, locked: false, label: "gratis", reason: "Lager ist aktuell kostenloser Platzhalter" };
  }

  return { iron: 0, locked: true, label: "-", reason: "Unbekannter Gebaeudetyp" };
}

function canAfford(resources, price) {
  const iron = Number.isFinite(resources?.iron) ? resources.iron : 0;
  return iron >= (Number.isFinite(price?.iron) ? price.iron : 0);
}

function spendPrice(resources, price) {
  return {
    ore: Number.isFinite(resources?.ore) ? resources.ore : 0,
    iron: Math.max(0, (Number.isFinite(resources?.iron) ? resources.iron : 0) - (Number.isFinite(price?.iron) ? price.iron : 0))
  };
}

export class GameLogicController {
  constructor(kernel = null, options = {}) {
    this.kernel = kernel;
    this.domain = typeof options.domain === "string" && options.domain.trim()
      ? options.domain.trim()
      : "game";
  }

  createInitialState() {
    return createInitialState();
  }

  getTickRate() {
    return TICKS_PER_SECOND;
  }

  getTickMs() {
    return MS_PER_TICK;
  }

  advanceTick(state, steps = 1) {
    return advanceTickState(state, steps);
  }

  inspectTile(state, { x, y }) {
    const terrainTile = getWorldTile(state?.world, x, y);
    const structure = findStructure(state, x, y);

    if (!terrainTile) {
      return { title: "Ausserhalb", summary: "Dieses Feld liegt ausserhalb der Karte.", structure: null, terrain: null };
    }

    if (structure) {
      return {
        title: STRUCTURE_LABELS[structure.type] || structure.type,
        summary: `${STRUCTURE_LABELS[structure.type] || structure.type} auf ${terrainTile.terrain}.`,
        structure,
        terrain: terrainTile
      };
    }

    if (terrainTile.terrain === "ore") {
      return {
        title: "Erzfeld",
        summary: "Hier darf ein Abbauer stehen. Abbau laeuft dann automatisch im Tick-System.",
        structure: null,
        terrain: terrainTile
      };
    }

    if (terrainTile.terrain === "water") {
      return { title: "Wasser", summary: "Wasserfelder sind gesperrt.", structure: null, terrain: terrainTile };
    }

    return {
      title: "Baufeld",
      summary: "Hier koennen Lager oder Schmelze gesetzt werden.",
      structure: null,
      terrain: terrainTile
    };
  }

  getBuildCatalog(state, { x, y }) {
    const terrainTile = getWorldTile(state?.world, x, y);
    const occupied = findStructure(state, x, y);

    if (!terrainTile || occupied || terrainTile.terrain === "water") {
      return [];
    }

    return ["miner", "storage", "smelter"].map((type) => {
      const check = this.canPlaceStructure(state, { type, x, y });
      return {
        type,
        label: STRUCTURE_LABELS[type] || type,
        allowed: check.ok,
        reason: check.reason,
        price: check.price,
        terrain: terrainTile.terrain
      };
    });
  }

  canPlaceStructure(state, { type, x, y }) {
    const terrainTile = getWorldTile(state?.world, x, y);
    const existing = findStructure(state, x, y);
    const price = getStructurePrice(state, type);

    if (!terrainTile) {
      return { ok: false, reason: "Feld nicht gefunden.", price };
    }
    if (existing) {
      return { ok: false, reason: "Feld ist bereits belegt.", price };
    }
    if (terrainTile.terrain === "water") {
      return { ok: false, reason: "Auf Wasser kann nichts gebaut werden.", price };
    }
    if (type === "miner" && terrainTile.terrain !== "ore") {
      return { ok: false, reason: "Abbauer funktionieren nur auf Erzfeldern.", price };
    }
    if (type === "smelter" && terrainTile.terrain === "ore") {
      return { ok: false, reason: "Schmelzen gehoeren auf Land, nicht auf Erzfelder.", price };
    }
    if (price.locked) {
      return { ok: false, reason: price.reason, price };
    }
    if (!canAfford(state.resources, price)) {
      return { ok: false, reason: `Nicht genug Eisen (${price.label}).`, price };
    }

    return { ok: true, reason: price.reason, price };
  }

  placeStructure(state, { type, x, y }) {
    const check = this.canPlaceStructure(state, { type, x, y });
    if (!check.ok) {
      return { ok: false, state, statusText: "Bau blockiert", summaryText: check.reason };
    }

    const next = cloneState(state);
    next.resources = spendPrice(next.resources, check.price);
    next.structures.push({ id: nextStructureId(next, type), type, x, y });
    incrementStats(next.stats, type);
    next.meta.lastAction = `build:${type}`;
    next.meta.statusText = `${STRUCTURE_LABELS[type] || type} gebaut`;
    next.meta.summaryText = `${STRUCTURE_LABELS[type] || type} auf (${x}, ${y}) platziert. ${check.price.reason}`;

    return { ok: true, state: next, statusText: next.meta.statusText, summaryText: next.meta.summaryText };
  }

  getHudModel(state) {
    return {
      ore: Number.isFinite(state?.resources?.ore) ? state.resources.ore : 0,
      iron: Number.isFinite(state?.resources?.iron) ? state.resources.iron : 0,
      storageCapacity: getStorageCapacity(state),
      tick: Number.isFinite(state?.clock?.tick) ? state.clock.tick : 0,
      secondsElapsed: Number.isFinite(state?.clock?.secondsElapsed) ? state.clock.secondsElapsed : 0,
      miners: countStructures(state, "miner"),
      storages: countStructures(state, "storage"),
      smelters: countStructures(state, "smelter")
    };
  }

  getStateSnapshot(state) {
    return {
      resources: state.resources,
      clock: state.clock,
      stats: state.stats,
      structures: state.structures,
      map: {
        id: state.world?.id,
        name: state.world?.name,
        width: state.world?.width,
        height: state.world?.height
      }
    };
  }

  getActionSchema() {
    return {};
  }

  getMutationMatrix() {
    return {};
  }

  calculateAction(action, state) {
    return {
      domain: this.domain,
      action,
      patches: [],
      previewState: state
    };
  }
}
