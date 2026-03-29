import { renderIsoTerrain, resolveRenderOptions, computeIsoMetrics } from "../render/isoTerrainCore.js";

function renderWorldBitmap({ width, height, tileSize, options }) {
  const resolvedOptions = resolveRenderOptions(options);
  const metrics = computeIsoMetrics(width, height, tileSize, 1);
  const sourceCanvas = new OffscreenCanvas(metrics.sourceWidth, metrics.sourceHeight);
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) {
    throw new Error("Offscreen canvas context unavailable.");
  }

  renderIsoTerrain(sourceCtx, {
    width: metrics.width,
    height: metrics.height,
    tileSize: metrics.tileSize,
    options: resolvedOptions,
    drawGrid: true
  });

  return sourceCanvas.transferToImageBitmap();
}

self.onmessage = (event) => {
  const message = event?.data || {};
  if (message.type !== "render-world") {
    return;
  }

  try {
    const width = Math.max(4, Number(message.width) | 0);
    const height = Math.max(4, Number(message.height) | 0);
    const tileSize = Number.isFinite(message.tileSize) ? Math.max(24, Number(message.tileSize)) : 84;
    const options = resolveRenderOptions(message.options);
    const bitmap = renderWorldBitmap({ width, height, tileSize, options });
    self.postMessage({ type: "world-ready", bitmap }, [bitmap]);
  } catch (error) {
    self.postMessage({
      type: "world-error",
      error: String(error?.message || error)
    });
  }
};
