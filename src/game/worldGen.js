const DEFAULT_CHUNK_SIZE = 16;
const DEFAULT_GENERATOR_ID = "worldgen.v1.voronoi-noise";
const DEFAULT_BIOMES = Object.freeze(["meadow", "forest", "scrub", "steppe"]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function toInt(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashString(input) {
  let h = 2166136261 >>> 0;
  const text = String(input);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hashInts(a, b, c = 0, d = 0) {
  let h = 0x9e3779b9;
  h ^= Math.imul((a | 0) ^ 0x85ebca6b, 0xc2b2ae35);
  h = (h << 13) | (h >>> 19);
  h ^= Math.imul((b | 0) ^ 0x27d4eb2f, 0x165667b1);
  h = (h << 11) | (h >>> 21);
  h ^= Math.imul((c | 0) ^ 0x7f4a7c15, 0x85ebca77);
  h = (h << 7) | (h >>> 25);
  h ^= Math.imul((d | 0) ^ 0x94d049bb, 0xc2b2ae3d);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

function hashToUnit(value) {
  return (value >>> 0) / 4294967295;
}

function valueNoise2D(seedInt, x, y, frequency = 0.08) {
  const fx = x * frequency;
  const fy = y * frequency;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;

  function corner(cx, cy) {
    return hashToUnit(hashInts(seedInt, cx, cy, 11));
  }

  const c00 = corner(ix, iy);
  const c10 = corner(ix + 1, iy);
  const c01 = corner(ix, iy + 1);
  const c11 = corner(ix + 1, iy + 1);

  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const nx0 = c00 + (c10 - c00) * sx;
  const nx1 = c01 + (c11 - c01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function createVoronoiSites(seedInt, width, height, count) {
  const sites = [];
  for (let i = 0; i < count; i += 1) {
    const sx = Math.floor(hashToUnit(hashInts(seedInt, i, 1, 71)) * width);
    const sy = Math.floor(hashToUnit(hashInts(seedInt, i, 2, 73)) * height);
    const biomeIndex = hashInts(seedInt, i, 3, 79) % DEFAULT_BIOMES.length;
    sites.push({
      x: clamp(sx, 0, Math.max(0, width - 1)),
      y: clamp(sy, 0, Math.max(0, height - 1)),
      biome: DEFAULT_BIOMES[biomeIndex]
    });
  }
  return sites;
}

function classifyBiomeFromSites(x, y, sites, noiseValue) {
  let best = null;
  let second = null;

  for (const site of sites) {
    const dx = x - site.x;
    const dy = y - site.y;
    const dist = dx * dx + dy * dy;
    if (!best || dist < best.dist) {
      second = best;
      best = { site, dist };
    } else if (!second || dist < second.dist) {
      second = { site, dist };
    }
  }

  if (!best) {
    return "meadow";
  }

  if (!second) {
    return best.site.biome;
  }

  const boundaryFactor = Math.abs(second.dist - best.dist) / Math.max(1, second.dist + best.dist);
  if (boundaryFactor < 0.12 && noiseValue > 0.6) {
    return second.site.biome;
  }

  return best.site.biome;
}

function createLakeMask(seedInt, width, height) {
  const side = hashInts(seedInt, width, height, 41) % 4;
  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.16));
  const inset = 1;

  let cx = 0;
  let cy = 0;

  if (side === 0) {
    cx = inset + 1;
    cy = Math.round(height * 0.32);
  } else if (side === 1) {
    cx = width - inset - 2;
    cy = Math.round(height * 0.68);
  } else if (side === 2) {
    cx = Math.round(width * 0.3);
    cy = inset + 1;
  } else {
    cx = Math.round(width * 0.7);
    cy = height - inset - 2;
  }

  cx = clamp(cx, 0, Math.max(0, width - 1));
  cy = clamp(cy, 0, Math.max(0, height - 1));

  return function isLakeTile(x, y) {
    const dx = x - cx;
    const dy = y - cy;
    const nx = (dx * dx) / (radius * radius);
    const ny = (dy * dy) / ((radius * 0.65) * (radius * 0.65));
    return nx + ny <= 1;
  };
}

function createTileBase({ x, y, biome }) {
  return {
    x,
    y,
    type: "empty",
    outputText: "",
    isActive: false,
    isEmpty: true,
    biome,
    terrain: biome,
    resource: "none"
  };
}

function createTerrainStamps() {
  return Object.freeze([
    {
      id: "ore-pocket-a",
      width: 3,
      height: 2,
      cells: [
        { x: 0, y: 0, resource: "ore", terrain: "rock" },
        { x: 1, y: 0, resource: "ore", terrain: "rock" },
        { x: 2, y: 0, resource: "none", terrain: "rock" },
        { x: 0, y: 1, resource: "none", terrain: "rock" },
        { x: 1, y: 1, resource: "ore", terrain: "rock" },
        { x: 2, y: 1, resource: "none", terrain: "rock" }
      ]
    },
    {
      id: "coal-pocket-b",
      width: 2,
      height: 3,
      cells: [
        { x: 0, y: 0, resource: "coal", terrain: "rock" },
        { x: 1, y: 0, resource: "none", terrain: "rock" },
        { x: 0, y: 1, resource: "coal", terrain: "rock" },
        { x: 1, y: 1, resource: "coal", terrain: "rock" },
        { x: 0, y: 2, resource: "none", terrain: "rock" },
        { x: 1, y: 2, resource: "coal", terrain: "rock" }
      ]
    },
    {
      id: "meadow-clear-a",
      width: 3,
      height: 3,
      cells: [
        { x: 0, y: 0, terrain: "meadow" },
        { x: 1, y: 0, terrain: "meadow" },
        { x: 2, y: 0, terrain: "meadow" },
        { x: 0, y: 1, terrain: "meadow" },
        { x: 1, y: 1, terrain: "meadow" },
        { x: 2, y: 1, terrain: "meadow" },
        { x: 0, y: 2, terrain: "meadow" },
        { x: 1, y: 2, terrain: "meadow" },
        { x: 2, y: 2, terrain: "meadow" }
      ]
    }
  ]);
}

function stampEligibility(stamp, anchorX, anchorY, width, height, tileMap) {
  if (anchorX < 0 || anchorY < 0 || anchorX + stamp.width > width || anchorY + stamp.height > height) {
    return false;
  }

  for (const cell of stamp.cells) {
    const key = `${anchorX + cell.x}:${anchorY + cell.y}`;
    const tile = tileMap.get(key);
    if (!tile || tile.biome === "water") {
      return false;
    }
  }
  return true;
}

function applyStamp(stamp, anchorX, anchorY, tileMap) {
  for (const cell of stamp.cells) {
    const key = `${anchorX + cell.x}:${anchorY + cell.y}`;
    const tile = tileMap.get(key);
    if (!tile) {
      continue;
    }
    if (typeof cell.resource === "string") {
      tile.resource = cell.resource;
    }
    if (typeof cell.terrain === "string") {
      tile.terrain = cell.terrain;
    }
  }
}

function applyDeterministicStamps(seedInt, width, height, tiles) {
  const tileMap = new Map(tiles.map((tile) => [`${tile.x}:${tile.y}`, tile]));
  const stamps = createTerrainStamps();
  const placements = [];

  const targetCount = Math.max(2, Math.round((width * height) / 110));
  let guard = 0;
  while (placements.length < targetCount && guard < targetCount * 20) {
    const pick = hashInts(seedInt, guard, 91, 17);
    const stamp = stamps[pick % stamps.length];
    const anchorX = hashInts(seedInt, guard, 92, 19) % Math.max(1, width - stamp.width + 1);
    const anchorY = hashInts(seedInt, guard, 93, 23) % Math.max(1, height - stamp.height + 1);
    guard += 1;

    const key = `${anchorX}:${anchorY}:${stamp.id}`;
    if (placements.some((x) => x.key === key)) {
      continue;
    }
    if (!stampEligibility(stamp, anchorX, anchorY, width, height, tileMap)) {
      continue;
    }

    applyStamp(stamp, anchorX, anchorY, tileMap);
    placements.push({
      key,
      stampId: stamp.id,
      anchorX,
      anchorY
    });
  }

  return placements.map((x) => ({
    stampId: x.stampId,
    anchorX: x.anchorX,
    anchorY: x.anchorY
  }));
}

export function generateWorld(options = {}) {
  const seed = typeof options.seed === "string" && options.seed.trim() ? options.seed.trim() : "seedworld-default";
  const width = clamp(toInt(options.width, 16), 4, 256);
  const height = clamp(toInt(options.height, 12), 4, 256);
  const chunkSize = clamp(toInt(options.chunkSize, DEFAULT_CHUNK_SIZE), 4, 64);
  const seedInt = hashString(seed);

  const siteCount = clamp(Math.round((width * height) / 42), 5, 18);
  const sites = createVoronoiSites(seedInt, width, height, siteCount);
  const isLakeTile = createLakeMask(seedInt, width, height);
  const tiles = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isLakeTile(x, y)) {
        tiles.push(
          createTileBase({
            x,
            y,
            biome: "water"
          })
        );
        continue;
      }

      const noiseA = valueNoise2D(seedInt ^ 0x4f1bbcdc, x, y, 0.085);
      const noiseB = valueNoise2D(seedInt ^ 0x8a5c31ef, x + 100, y + 100, 0.16);
      const noiseBlend = noiseA * 0.7 + noiseB * 0.3;
      const biome = classifyBiomeFromSites(x, y, sites, noiseBlend);

      const tile = createTileBase({ x, y, biome });
      if (biome === "forest" && noiseBlend > 0.58) {
        tile.terrain = "trees";
      } else if (biome === "scrub" && noiseBlend < 0.38) {
        tile.terrain = "dry";
      } else if (biome === "steppe" && noiseBlend < 0.33) {
        tile.terrain = "dust";
      }

      tiles.push(tile);
    }
  }

  const stampPlacements = applyDeterministicStamps(seedInt, width, height, tiles);
  return {
    seed,
    size: { width, height },
    tiles,
    meta: {
      version: 1,
      generatorId: DEFAULT_GENERATOR_ID,
      chunkSize,
      siteCount,
      stampPlacements
    }
  };
}

export function buildWorldFromState(state = {}, fallbackSeed = "seedworld-default") {
  const world = isPlainObject(state.world) ? state.world : {};
  const size = isPlainObject(world.size) ? world.size : {};
  return generateWorld({
    seed: typeof world.seed === "string" ? world.seed : fallbackSeed,
    width: toInt(size.width, 16),
    height: toInt(size.height, 12),
    chunkSize: toInt(world.meta?.chunkSize, DEFAULT_CHUNK_SIZE)
  });
}

export function validateWorldShape(world) {
  assert(isPlainObject(world), "[WORLD_GEN] world muss Objekt sein.");
  assert(typeof world.seed === "string" && world.seed.trim(), "[WORLD_GEN] world.seed fehlt.");
  assert(isPlainObject(world.size), "[WORLD_GEN] world.size fehlt.");
  assert(Number.isInteger(world.size.width) && world.size.width > 0, "[WORLD_GEN] world.size.width ungueltig.");
  assert(Number.isInteger(world.size.height) && world.size.height > 0, "[WORLD_GEN] world.size.height ungueltig.");
  assert(Array.isArray(world.tiles), "[WORLD_GEN] world.tiles muss Array sein.");
  assert(isPlainObject(world.meta), "[WORLD_GEN] world.meta fehlt.");
}
