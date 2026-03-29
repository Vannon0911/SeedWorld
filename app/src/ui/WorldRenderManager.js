export class WorldRenderManager {
  constructor({
    container,
    getUi,
    viewportManager = null,
    workerUrl = "./src/workers/worldRenderWorker.js",
    fallbackFactory,
    debounceMs = 120
  } = {}) {
    if (!container || typeof container.replaceChildren !== "function") {
      throw new Error("[WORLD_RENDER_MANAGER] container required.");
    }
    if (typeof getUi !== "function") {
      throw new Error("[WORLD_RENDER_MANAGER] getUi callback required.");
    }
    if (typeof fallbackFactory !== "function") {
      throw new Error("[WORLD_RENDER_MANAGER] fallbackFactory required.");
    }

    this.container = container;
    this.getUi = getUi;
    this.viewportManager = viewportManager;
    this.workerUrl = workerUrl;
    this.fallbackFactory = fallbackFactory;
    this.debounceMs = Number.isFinite(debounceMs) ? Math.max(0, debounceMs) : 120;

    this.activeWorker = null;
    this.resizeTimer = null;
    this.unsubscribeViewport = null;
  }

  async start() {
    await this.renderNow();
    this.#bindViewport();
  }

  stop() {
    if (this.resizeTimer) {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    if (this.activeWorker) {
      this.activeWorker.terminate();
      this.activeWorker = null;
    }
    if (typeof this.unsubscribeViewport === "function") {
      this.unsubscribeViewport();
      this.unsubscribeViewport = null;
    }
  }

  async renderNow() {
    const params = this.#readTerrainParams();
    if (!params) {
      return;
    }

    if (this.activeWorker) {
      this.activeWorker.terminate();
      this.activeWorker = null;
    }

    const { width, height, tileSize, options } = params;
    if (typeof Worker === "function" && typeof OffscreenCanvas === "function") {
      const worker = new Worker(this.workerUrl, { type: "module" });
      this.activeWorker = worker;
      worker.onmessage = (event) => {
        const message = event?.data || {};
        if (message.type === "world-ready" && message.bitmap) {
          this.#mountBitmap(message.bitmap);
          worker.terminate();
          if (this.activeWorker === worker) {
            this.activeWorker = null;
          }
          return;
        }
        if (message.type === "world-error") {
          worker.terminate();
          if (this.activeWorker === worker) {
            this.activeWorker = null;
          }
          this.#renderFallback(width, height, options);
        }
      };
      worker.postMessage({ type: "render-world", width, height, tileSize, options });
      return;
    }

    this.#renderFallback(width, height, options);
  }

  #bindViewport() {
    if (!this.viewportManager || typeof this.viewportManager.subscribe !== "function") {
      return;
    }
    this.unsubscribeViewport = this.viewportManager.subscribe(
      () => {
        if (this.resizeTimer) {
          window.clearTimeout(this.resizeTimer);
        }
        this.resizeTimer = window.setTimeout(() => {
          this.resizeTimer = null;
          this.renderNow();
        }, this.debounceMs);
      },
      { immediate: false }
    );
  }

  #readTerrainParams() {
    const ui = this.getUi();
    if (!ui) {
      return null;
    }

    const width = Number(ui?.tileGridRenderer?.width) || 16;
    const height = Number(ui?.tileGridRenderer?.height) || 12;
    const tileSize = Number(ui?.tileGridRenderer?.tileSize) || 84;
    const worldSeed =
      typeof ui?.currentState?.world?.seed === "string" && ui.currentState.world.seed.trim()
        ? ui.currentState.world.seed.trim()
        : Date.now();

    return {
      width,
      height,
      tileSize,
      options: {
        biome: "mountain",
        scale: 0.1,
        octaves: 5,
        persistence: 0.55,
        tileSize,
        seed: worldSeed,
        lightAngleDeg: 14,
        shadowStrength: 0.18
      }
    };
  }

  #mountBitmap(bitmap) {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.style.width = `${bitmap.width}px`;
    canvas.style.height = `${bitmap.height}px`;
    canvas.style.maxWidth = "100%";
    canvas.style.maxHeight = "100%";
    canvas.style.imageRendering = "crisp-edges";

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0);
    }
    this.container.replaceChildren(canvas);
  }

  #renderFallback(width, height, options) {
    const node = this.fallbackFactory(width, height, options);
    if (node) {
      this.container.replaceChildren(node);
    }
  }
}
