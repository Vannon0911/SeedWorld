function hashString(input) {
  let h = 2166136261 >>> 0;
  const text = String(input);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

export class IsometricWorldGen {
  constructor(width = 64, height = 64, options = {}) {
    this.width = Math.max(4, width | 0);
    this.height = Math.max(4, height | 0);
    this.options = {
      biome: typeof options.biome === "string" ? options.biome : "mountain",
      scale: Number.isFinite(options.scale) ? options.scale : 0.1,
      octaves: Number.isFinite(options.octaves) ? options.octaves : 5,
      persistence: Number.isFinite(options.persistence) ? options.persistence : 0.55,
      seed: options.seed ?? Date.now()
    };
    this.seedInt = hashString(this.options.seed);
  }

  render() {
    const tw = 18;
    const th = 10;
    const elev = 7;
    const pad = 30;
    const w = (this.width + this.height) * (tw / 2) + pad * 2;
    const h = (this.width + this.height) * (th / 2) + pad * 2 + 120;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";
    canvas.style.imageRendering = "crisp-edges";
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return canvas;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const palette = biomePalette(this.options.biome);
    const originX = canvas.width / 2;
    const originY = 50;

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const n = fbm(this.seedInt, x, y, this.options);
        const hLevel = Math.max(0, Math.min(1, n));
        const px = (x - y) * (tw / 2) + originX;
        const py = (x + y) * (th / 2) + originY;
        const lift = Math.round(hLevel * elev * 2.4);

        let color = palette.low;
        if (hLevel > 0.66) {
          color = palette.high;
        } else if (hLevel > 0.33) {
          color = palette.mid;
        }
        const shade = (hash2(this.seedInt, x, y) % 7) - 3;
        const lit = Math.max(18, Math.min(82, color[2] + shade));
        ctx.fillStyle = hsl(color[0], color[1], lit);

        ctx.beginPath();
        ctx.moveTo(px, py - lift - th / 2);
        ctx.lineTo(px + tw / 2, py - lift);
        ctx.lineTo(px, py - lift + th / 2);
        ctx.lineTo(px - tw / 2, py - lift);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgb(0 0 0 / 25%)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    return canvas;
  }
}
