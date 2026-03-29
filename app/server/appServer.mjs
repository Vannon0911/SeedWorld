import http from "node:http";
import { handleStaticRequest } from "./staticHandler.mjs";

const PORT = Number(process.env.PORT || 3000);

/**
 * Sends a JSON response with no-store caching for runtime endpoints.
 */
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

export class AppServer {
  /**
   * Creates the lightweight runtime server that only exposes app routes.
   */
  constructor({ port = PORT } = {}) {
    this.port = port;
    this.server = http.createServer((req, res) => this.#handleRequest(req, res));
  }

  /**
   * Serves static assets first and falls back to a minimal health/runtime API.
   */
  async #handleRequest(req, res) {
    const url = new URL(req.url || "/", "http://127.0.0.1");

    if (req.method === "GET") {
      const served = await handleStaticRequest(res, url.pathname);
      if (served) {
        return;
      }
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "seedworld-app-server"
      });
      return;
    }

    sendJson(res, 404, {
      error: "Not found",
      path: url.pathname
    });
  }

  /**
   * Starts listening on the configured loopback port.
   */
  async listen() {
    await new Promise((resolve) => {
      this.server.listen(this.port, "127.0.0.1", resolve);
    });
    return this.server;
  }

  /**
   * Stops the underlying HTTP server.
   */
  close() {
    this.server.close();
  }
}

let appServerInstance = null;

/**
 * Starts a singleton app server instance for local runtime usage.
 */
export async function startAppServer(options = {}) {
  if (appServerInstance) {
    return appServerInstance.server;
  }

  appServerInstance = new AppServer(options);
  await appServerInstance.listen();
  return appServerInstance.server;
}

/**
 * Stops the singleton app server instance when one is active.
 */
export async function stopAppServer() {
  if (!appServerInstance) {
    return;
  }

  const activeServer = appServerInstance;
  appServerInstance = null;
  await new Promise((resolve, reject) => {
    activeServer.server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
