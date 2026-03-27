import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleStaticRequest } from './server/staticHandler.mjs';
import { handleRuntimePatchCheck } from './server/runtimeCheckHandler.mjs';
import {
  handleCreateSession, handleStatus, handleLogs, handleResult,
  handleCancel, handleEvents, activeProcesses
} from './server/sessionRoutes.mjs';

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function text(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

async function routeRequest(req, res) {
  const requestUrl = new URL(req.url, 'http://127.0.0.1');
  const pathname = requestUrl.pathname;

  if (pathname === '/api/patches' || pathname.startsWith('/api/patches/') || pathname === '/api/hooks') {
    json(res, 404, { error: 'legacy patch api removed' });
    return;
  }

  if (pathname === '/api/patch-sessions' && req.method === 'POST') {
    await handleCreateSession(req, res, json);
    return;
  }

  if (pathname === '/api/runtime-patch-check' && req.method === 'POST') {
    await handleRuntimePatchCheck(req, res, json);
    return;
  }

  const sessionMatch = pathname.match(/^\/api\/patch-sessions\/([^/]+)(?:\/(events|logs|result|cancel))?$/);
  if (sessionMatch) {
    const sessionId = sessionMatch[1];
    const action = sessionMatch[2] || 'status';

    if (action === 'status' && req.method === 'GET') { await handleStatus(res, sessionId, json); return; }
    if (action === 'events' && req.method === 'GET') { await handleEvents(req, res, sessionId, json); return; }
    if (action === 'logs'   && req.method === 'GET') { await handleLogs(res, sessionId, json); return; }
    if (action === 'result' && req.method === 'GET') { await handleResult(res, sessionId, json); return; }
    if (action === 'cancel' && req.method === 'POST') { await handleCancel(req, res, sessionId, json); return; }

    json(res, 405, { error: 'method not allowed' });
    return;
  }

  const served = await handleStaticRequest(res, pathname);
  if (!served) {
    text(res, 404, 'Not found');
  }
}

export class PatchServer {
  constructor(port = 3000) {
    this.port = port;
    this.server = createServer((req, res) => {
      routeRequest(req, res).catch((error) => {
        console.error('[PATCH_SERVER] request failed:', error);
        json(res, 500, { error: 'internal server error' });
      });
    });
  }

  listen() {
    return new Promise((resolvePromise) => {
      this.server.listen(this.port, () => {
        const address = this.server.address();
        const port = typeof address === 'object' && address ? address.port : this.port;
        console.log(`[PATCH_SERVER] running on http://127.0.0.1:${port}`);
        resolvePromise();
      });
    });
  }

  close() {
    for (const child of activeProcesses.values()) {
      child.kill();
    }
    activeProcesses.clear();
    return new Promise((resolvePromise) => this.server.close(resolvePromise));
  }
}

const isDirectRun = (() => {
  if (!process.argv[1]) return false;
  try { return resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]); }
  catch { return false; }
})();

if (isDirectRun) {
  const server = new PatchServer(Number(process.env.PORT || 3000));
  await server.listen();

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}
