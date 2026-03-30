import { buildWorldFromState, generateWorld } from "./worldGen.js";
import { buildTransportPatches } from "./actions/transportAction.js";
import { buildBuildPatches } from "./actions/buildAction.js";
import { BUILD_COSTS, DEFAULT_DOMAIN, TILE_OUTPUT_LABELS } from "./gameConfig.js";
import { coerceInteger, coercePositiveInteger, coerceString, deepClone, isPlainObject } from "./gameInput.js";

function getMachineStateKey(machine) {
  if (machine === "miner") return "miners";
  if (machine === "conveyor") return "conveyors";
  if (machine === "assembler") return "assemblers";
  throw new Error(`[GAME_LOGIC] Unbekannte Maschine: ${machine}`);
}

function getResourcePath(resource) {
  if (resource === "ore" || resource === "copper" || resource === "iron" || resource === "gears") {
    return `resources.${resource}`;
  }

  throw new Error(`[GAME_LOGIC] Unbekannte Resource: ${resource}`);
}

function getStoragePath(slot) {
  if (slot === "storageA" || slot === "storageB") {
    return `logistics.${slot}`;
  }

  throw new Error(`[GAME_LOGIC] Unbekannter Storage-Slot: ${slot}`);
}

function getCountAtPath(state, path) {
  const [root, key] = path.split(".");
  const branch = state[root];
  const value = branch && typeof branch === "object" ? branch[key] : undefined;
  return Number.isFinite(value) ? value : 0;
}

function setCountPatch(path, value) {
  return { op: "set", domain: DEFAULT_DOMAIN, path, value };
}

function isKnownTileType(tileType) {
  return Object.prototype.hasOwnProperty.call(TILE_OUTPUT_LABELS, tileType);
}

function normalizeWorldState(state) {
  const world = isPlainObject(state.world) ? state.world : null;
  if (world && isPlainObject(world.size) && Array.isArray(world.tiles) && world.tiles.length > 0) {
    return deepClone(world);
  }

  return buildWorldFromState(state);
}

function updateTileTypeInWorld(state, payload = {}) {
  const world = normalizeWorldState(state);
  const x = coerceInteger(payload.x, "set_tile_type.x");
  const y = coerceInteger(payload.y, "set_tile_type.y");
  const tileType = coerceString(payload.tileType, "set_tile_type.tileType");

  if (!isKnownTileType(tileType)) {
    throw new Error(`[GAME_LOGIC] Unbekannter Tile-Typ: ${tileType}`);
  }

  const width = Number.isInteger(world?.size?.width) ? world.size.width : 0;
  const height = Number.isInteger(world?.size?.height) ? world.size.height : 0;
  if (x < 0 || y < 0 || x >= width || y >= height) {
    throw new Error(`[GAME_LOGIC] Tile ausserhalb der Welt: ${x},${y}`);
  }

  const nextTiles = world.tiles.map((tile, index) => {
    const tileX = Number.isInteger(tile?.x) ? tile.x : index % width;
    const tileY = Number.isInteger(tile?.y) ? tile.y : Math.floor(index / width);
    if (tileX !== x || tileY !== y) {
      return deepClone(tile);
    }

    return {
      ...deepClone(tile),
      x,
      y,
      type: tileType,
      outputText: TILE_OUTPUT_LABELS[tileType],
      isActive: tileType !== "empty",
      isEmpty: tileType === "empty"
    };
  });

  return [setCountPatch("world.tiles", nextTiles)];
}

function createWorldPatches(seed, payload = {}) {
  const width = Number.isInteger(payload.width) ? payload.width : 16;
  const height = Number.isInteger(payload.height) ? payload.height : 12;
  const generated = generateWorld({
    seed,
    width,
    height
  });

  return [
    setCountPatch("world.seed", generated.seed),
    setCountPatch("world.size", generated.size),
    setCountPatch("world.meta", generated.meta),
    setCountPatch("world.tiles", generated.tiles)
  ];
}

export function buildPatches(action, state) {
  switch (action.type) {
    case "produce": {
      const resource = coerceString(action.payload.resource, "produce.resource");
      const amount = coercePositiveInteger(action.payload.amount, "produce.amount");
      const path = getResourcePath(resource);
      return [setCountPatch(path, getCountAtPath(state, path) + amount)];
    }

    case "consume": {
      const resource = coerceString(action.payload.resource, "consume.resource");
      const amount = coercePositiveInteger(action.payload.amount, "consume.amount");
      const path = getResourcePath(resource);
      return [setCountPatch(path, Math.max(0, getCountAtPath(state, path) - amount))];
    }

    case "transport": {
      const from = coerceString(action.payload.from, "transport.from");
      const to = coerceString(action.payload.to, "transport.to");
      const amount = coercePositiveInteger(action.payload.amount, "transport.amount");
      return buildTransportPatches({
        domain: DEFAULT_DOMAIN,
        fromPath: getStoragePath(from),
        toPath: getStoragePath(to),
        amount,
        state
      });
    }

    case "build": {
      const machine = coerceString(action.payload.machine, "build.machine");
      const count = coercePositiveInteger(action.payload.count, "build.count");
      const costPerUnit = BUILD_COSTS[machine];
      if (!Number.isFinite(costPerUnit)) {
        throw new Error(`[GAME_LOGIC] Keine Baukosten fuer Maschine: ${machine}`);
      }

      return buildBuildPatches({
        domain: DEFAULT_DOMAIN,
        machinePath: `machines.${getMachineStateKey(machine)}`,
        orePath: "resources.ore",
        costPerUnit,
        count,
        state
      });
    }

    case "inspect":
      return [];

    case "set_tile_type":
      return updateTileTypeInWorld(state, action.payload);

    case "generate_world": {
      const seed = coerceString(action.payload.seed, "generate_world.seed");
      return createWorldPatches(seed, action.payload);
    }

    case "regenerate_world": {
      const seed = coerceString(action.payload.seed, "regenerate_world.seed");
      return createWorldPatches(seed, action.payload);
    }

    default:
      throw new Error(`[GAME_LOGIC] Unbekannte Action: ${action.type}`);
  }
}
