import { renderIsoTerrain, resolveRenderOptions, computeIsoMetrics } from "./render/isoTerrainCore.js";

export class IsometricWorldGen {
  constructor(width = 64, height = 64, options = {}) {
    this.width = Math.max(4, width | 0);
    this.height = Math.max(4, height | 0);
    this.options = resolveRenderOptions({
      ...options,
      tileSize: Number.isFinite(options.tileSize) ? Number(options.tileSize) : 84
    });
  }

  render() {
    const tileSize = Number.isFinite(this.options.tileSize) ? Number(this.options.tileSize) : 84;
    const metrics = computeIsoMetrics(this.width, this.height, tileSize, 1);
    const source = document.createElement("canvas");
    source.width = metrics.sourceWidth;
    source.height = metrics.sourceHeight;
    const sourceCtx = source.getContext("2d");
    if (!sourceCtx) {
      return source;
    }

    renderIsoTerrain(sourceCtx, {
      width: metrics.width,
      height: metrics.height,
      tileSize: metrics.tileSize,
      options: this.options,
      drawGrid: true
    });

    source.style.maxWidth = "100%";
    source.style.height = "auto";
    source.style.imageRendering = "crisp-edges";
    return source;
  }
}
