function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hash2(seed, x, y) {
  let h = seed ^ Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

function unitFromHash(h) {
  return (h >>> 0) / 4294967295;
}

function valueNoise(seed, x, y, scale) {
  const fx = x * scale;
  const fy = y * scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;

  const c00 = unitFromHash(hash2(seed, ix, iy));
  const c10 = unitFromHash(hash2(seed, ix + 1, iy));
  const c01 = unitFromHash(hash2(seed, ix, iy + 1));
  const c11 = unitFromHash(hash2(seed, ix + 1, iy + 1));

  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const nx0 = c00 + (c10 - c00) * sx;
  const nx1 = c01 + (c11 - c01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function fbm(seed, x, y, options) {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let norm = 0;
  const octaves = Math.max(1, options.octaves | 0);
  const persistence = Number.isFinite(options.persistence) ? options.persistence : 0.5;
  const scale = Number.isFinite(options.scale) ? options.scale : 0.1;

  for (let i = 0; i < octaves; i += 1) {
    total += valueNoise(seed + i * 911, x * frequency, y * frequency, scale) * amplitude;
    norm += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return norm > 0 ? total / norm : 0;
}

function hsl(h, s, l) {
  return `hsl(${h} ${s}% ${l}%)`;
}

function biomePalette(name) {
  if (name === "desert") {
    return { low: [42, 55, 42], mid: [45, 52, 52], high: [34, 56, 64] };
  }
  if (name === "forest") {
    return { low: [126, 48, 30], mid: [132, 45, 38], high: [140, 42, 49] };
  }
  if (name === "snow") {
    return { low: [210, 16, 42], mid: [205, 20, 58], high: [200, 20, 76] };
  }
  return { low: [28, 20, 26], mid: [95, 40, 42], high: [110, 32, 60] };
}

function sampleHeight(heights, width, height, x, y) {
  const sx = clamp(x, 0, width - 1);
  const sy = clamp(y, 0, height - 1);
  return heights[sy * width + sx];
}

function computeLightIntensity(heights, width, height, x, y, lightAngleRad) {
  const dx = sampleHeight(heights, width, height, x + 1, y) - sampleHeight(heights, width, height, x - 1, y);
  const dy = sampleHeight(heights, width, height, x, y + 1) - sampleHeight(heights, width, height, x, y - 1);
  const nx = -dx;
  const ny = -dy;
  const nz = 0.8;
  const nLen = Math.hypot(nx, ny, nz) || 1;

  const lx = Math.cos(lightAngleRad);
  const ly = Math.sin(lightAngleRad);
  const lz = 0.72;
  const lLen = Math.hypot(lx, ly, lz) || 1;

  const dot = (nx / nLen) * (lx / lLen) + (ny / nLen) * (ly / lLen) + (nz / nLen) * (lz / lLen);
  return clamp(0.58 + dot * 0.28, 0.32, 0.94);
}

export function hashString(input) {
  let h = 2166136261 >>> 0;
  const text = String(input);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function resolveRenderOptions(raw = {}) {
  const options = raw || {};
  return {
    biome: typeof options.biome === "string" ? options.biome : "mountain",
    scale: Number.isFinite(options.scale) ? Number(options.scale) : 0.1,
    octaves: Number.isFinite(options.octaves) ? Number(options.octaves) : 5,
    persistence: Number.isFinite(options.persistence) ? Number(options.persistence) : 0.55,
    seed: options.seed ?? Date.now(),
    tileSize: Number.isFinite(options.tileSize) ? Number(options.tileSize) : 84,
    lightAngleDeg: Number.isFinite(options.lightAngleDeg) ? Number(options.lightAngleDeg) : 14,
    shadowStrength: Number.isFinite(options.shadowStrength) ? clamp(Number(options.shadowStrength), 0, 1) : 0.18
  };
}

export function computeIsoMetrics(width, height, tileSize, spacingMultiplier = 1) {
  const safeWidth = Math.max(4, Number(width) | 0);
  const safeHeight = Math.max(4, Number(height) | 0);
  const safeTileSize = Math.max(24, Number(tileSize) || 84);
  const tileW = safeTileSize * 2 * spacingMultiplier;
  const tileH = safeTileSize * 2 * spacingMultiplier;
  const sourceWidth = Math.round((safeWidth + safeHeight) * (tileW / 2) + tileW);
  const sourceHeight = Math.round((safeWidth + safeHeight) * (tileH / 2) + tileH);
  const originX = Math.round((safeHeight * tileW) / 2 + tileW / 2);
  const originY = Math.round(tileH / 2);
  return { width: safeWidth, height: safeHeight, tileSize: safeTileSize, tileW, tileH, sourceWidth, sourceHeight, originX, originY };
}

export function renderIsoTerrain(ctx, { width, height, tileSize, options, drawGrid = true }) {
  const resolved = resolveRenderOptions(options);
  const metrics = computeIsoMetrics(width, height, tileSize, 1);
  const palette = biomePalette(resolved.biome);
  const seedInt = hashString(resolved.seed);
  const elev = metrics.tileH * 0.22;
  const lightAngleRad = (resolved.lightAngleDeg * Math.PI) / 180;
  const shadowDx = Math.cos(lightAngleRad) * metrics.tileW * 0.06;
  const shadowDy = Math.sin(lightAngleRad) * metrics.tileH * 0.06 + metrics.tileH * 0.06;

  const heights = new Array(metrics.width * metrics.height);
  for (let y = 0; y < metrics.height; y += 1) {
    for (let x = 0; x < metrics.width; x += 1) {
      heights[y * metrics.width + x] = clamp(fbm(seedInt, x, y, resolved), 0, 1);
    }
  }

  ctx.clearRect(0, 0, metrics.sourceWidth, metrics.sourceHeight);

  if (drawGrid) {
    ctx.save();
    ctx.strokeStyle = "rgb(185 220 205 / 16%)";
    ctx.lineWidth = 1;
    for (let y = 0; y < metrics.height; y += 1) {
      for (let x = 0; x < metrics.width; x += 1) {
        const px = (x - y) * (metrics.tileW / 2) + metrics.originX;
        const py = (x + y) * (metrics.tileH / 2) + metrics.originY;
        ctx.beginPath();
        ctx.moveTo(px, py - metrics.tileH / 2);
        ctx.lineTo(px + metrics.tileW / 2, py);
        ctx.lineTo(px, py + metrics.tileH / 2);
        ctx.lineTo(px - metrics.tileW / 2, py);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  for (let y = 0; y < metrics.height; y += 1) {
    for (let x = 0; x < metrics.width; x += 1) {
      const hLevel = heights[y * metrics.width + x];
      const px = (x - y) * (metrics.tileW / 2) + metrics.originX;
      const py = (x + y) * (metrics.tileH / 2) + metrics.originY;
      const lift = Math.round(hLevel * elev);

      let color = palette.low;
      if (hLevel > 0.66) {
        color = palette.high;
      } else if (hLevel > 0.33) {
        color = palette.mid;
      }

      const light = computeLightIntensity(heights, metrics.width, metrics.height, x, y, lightAngleRad);
      const jitter = (hash2(seedInt, x, y) % 7) - 3;
      let lit = clamp(color[2] + jitter + Math.round((light - 0.58) * 18), 18, 82);

      if (resolved.shadowStrength > 0) {
        ctx.fillStyle = `rgb(0 0 0 / ${Math.max(0, Math.min(0.34, resolved.shadowStrength * 0.7)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(px + shadowDx, py + shadowDy - lift - metrics.tileH / 2);
        ctx.lineTo(px + shadowDx + metrics.tileW / 2, py + shadowDy - lift);
        ctx.lineTo(px + shadowDx, py + shadowDy - lift + metrics.tileH / 2);
        ctx.lineTo(px + shadowDx - metrics.tileW / 2, py + shadowDy - lift);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = hsl(color[0], color[1], lit);
      ctx.beginPath();
      ctx.moveTo(px, py - lift - metrics.tileH / 2);
      ctx.lineTo(px + metrics.tileW / 2, py - lift);
      ctx.lineTo(px, py - lift + metrics.tileH / 2);
      ctx.lineTo(px - metrics.tileW / 2, py - lift);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgb(0 0 0 / 25%)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  return metrics;
}
