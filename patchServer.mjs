import http from "node:http";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { URL } from "node:url";

const ROOT = process.cwd();
const PORT = Number(process.env.PATCH_PORT || 3000);
const PATCH_MANAGER_DIR = path.join(ROOT, ".patch-manager");
const UPLOAD_DIR = path.join(PATCH_MANAGER_DIR, "uploads");
const SESSION_DIR = path.join(PATCH_MANAGER_DIR, "sessions");
const LOG_DIR = path.join(PATCH_MANAGER_DIR, "logs");
const ACTIVE_SESSION_PATH = path.join(PATCH_MANAGER_DIR, "active-session.json");
const MAX_BODY_BYTES = Number(process.env.PATCH_MAX_BODY_BYTES || 35_000_000);

const STATIC_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"]
]);

const state = {
  sseClients: new Set(),
  activeSessionId: null,
  activeStatusPath: null,
  activeChild: null,
  lastStatusHash: "",
  statusPollTimer: null
};

function nowIso() {
  return new Date().toISOString();
}

async function ensureDirs() {
  await fs.mkdir(PATCH_MANAGER_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(SESSION_DIR, { recursive: true });
  await fs.mkdir(LOG_DIR, { recursive: true });
}

function json(res, code, data) {
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function sendError(res, code, message, details = null) {
  json(res, code, { error: message, details });
}

function hashObject(data) {
  return createHash("sha256").update(JSON.stringify(data || {})).digest("hex");
}

function emitSse(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of state.sseClients) {
    try {
      res.write(data);
    } catch {
      state.sseClients.delete(res);
    }
  }
}

async function safeReadJson(absPath) {
  try {
    const raw = await fs.readFile(absPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function getStatusBySessionId(sessionId) {
  if (!sessionId) {
    return {
      sessionId: null,
      status: "idle",
      phase: "intake",
      progress: { current: 0, total: 13, percent: 0 },
      counts: { total: 0, applied: 0, skipped: 0, failed: 0 },
      result: null,
      error: null,
      current: { patchId: null, file: null },
      gateStatus: { required: false, state: "idle", steps: [] },
      lock: { state: "idle", ownerSessionId: null, expiresAt: null },
      logPath: null,
      summaryPath: null,
      updatedAt: nowIso()
    };
  }
  const statusPath = path.join(SESSION_DIR, `${sessionId}.status.json`);
  const status = await safeReadJson(statusPath);
  if (!status) {
    return {
      sessionId,
      status: "unknown",
      phase: "intake",
      progress: { current: 0, total: 13, percent: 0 },
      counts: { total: 0, applied: 0, skipped: 0, failed: 0 },
      result: null,
      error: {
        code: "SESSION_NOT_FOUND",
        phase: "intake",
        patchId: null,
        file: null,
        message: "Session status not found",
        details: {},
        suggestedFix: "Start a new session."
      },
      current: { patchId: null, file: null },
      gateStatus: { required: false, state: "idle", steps: [] },
      lock: { state: "idle", ownerSessionId: null, expiresAt: null },
      logPath: null,
      summaryPath: null,
      updatedAt: nowIso()
    };
  }
  return status;
}

async function getActiveSessionInfo() {
  const active = await safeReadJson(ACTIVE_SESSION_PATH);
  if (!active?.sessionId) {
    return { sessionId: state.activeSessionId || null, statusPath: state.activeStatusPath || null };
  }
  state.activeSessionId = active.sessionId;
  state.activeStatusPath = active.statusPath || path.join(SESSION_DIR, `${active.sessionId}.status.json`);
  return { sessionId: active.sessionId, statusPath: state.activeStatusPath };
}

async function readJsonl(absPath) {
  try {
    const raw = await fs.readFile(absPath, "utf8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function startStatusBroadcastLoop() {
  if (state.statusPollTimer) return;
  state.statusPollTimer = setInterval(async () => {
    const { sessionId } = await getActiveSessionInfo();
    const status = await getStatusBySessionId(sessionId);
    const nextHash = hashObject(status);
    if (nextHash !== state.lastStatusHash) {
      state.lastStatusHash = nextHash;
      emitSse("status", status);
      if (status.error) {
        emitSse("error", status.error);
      }
      if (status.result?.status && status.status !== "running") {
        emitSse("result", {
          sessionId: status.sessionId,
          result: status.result,
          summaryPath: status.summaryPath
        });
      }
    }
  }, 1000);
}

function stopStatusBroadcastLoopIfIdle() {
  if (state.sseClients.size === 0 && state.statusPollTimer) {
    clearInterval(state.statusPollTimer);
    state.statusPollTimer = null;
  }
}

function sanitizeFileName(name, fallback) {
  const base = String(name || fallback)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .trim();
  return base || fallback;
}

async function writeInputFile({ sessionId, inputType, fileName, payloadBase64, manifestText }) {
  const sessionUploadDir = path.join(UPLOAD_DIR, sessionId);
  await fs.mkdir(sessionUploadDir, { recursive: true });

  if (inputType === "zip") {
    const outName = sanitizeFileName(fileName || "patches.zip", "patches.zip");
    const abs = path.join(sessionUploadDir, outName.toLowerCase().endsWith(".zip") ? outName : `${outName}.zip`);
    const bytes = Buffer.from(String(payloadBase64 || ""), "base64");
    if (bytes.length === 0) {
      throw new Error("ZIP payload empty");
    }
    await fs.writeFile(abs, bytes);
    return abs;
  }

  if (inputType === "manifest") {
    let text = String(manifestText || "");
    if (!text && payloadBase64) {
      text = Buffer.from(String(payloadBase64), "base64").toString("utf8");
    }
    if (!text.trim()) {
      throw new Error("Manifest payload empty");
    }
    JSON.parse(text);
    const outName = sanitizeFileName(fileName || "manifest.json", "manifest.json");
    const abs = path.join(sessionUploadDir, outName.toLowerCase().endsWith(".json") ? outName : `${outName}.json`);
    await fs.writeFile(abs, text, "utf8");
    return abs;
  }

  throw new Error("inputType must be zip or manifest");
}

async function startSession(body) {
  const currentStatus = await getStatusBySessionId(state.activeSessionId);
  if (currentStatus.status === "running") {
    throw new Error("A session is already running.");
  }

  const sessionId = randomUUID();
  const actor = String(body.actor || "browser-ui");
  const inputPath = await writeInputFile({
    sessionId,
    inputType: String(body.inputType || ""),
    fileName: String(body.fileName || ""),
    payloadBase64: String(body.payloadBase64 || ""),
    manifestText: String(body.manifestText || "")
  });

  state.activeSessionId = sessionId;
  state.activeStatusPath = path.join(SESSION_DIR, `${sessionId}.status.json`);
  state.lastStatusHash = "";

  const child = spawn("node", ["tools/patch/apply.mjs", "--input", inputPath, "--actor", actor, "--session-id", sessionId], {
    cwd: ROOT,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  state.activeChild = child;

  child.stdout.on("data", async (chunk) => {
    const msg = chunk.toString("utf8").trim();
    if (msg) {
      emitSse("process", { level: "stdout", message: msg });
    }
  });
  child.stderr.on("data", (chunk) => {
    const msg = chunk.toString("utf8").trim();
    if (msg) {
      emitSse("process", { level: "stderr", message: msg });
    }
  });
  child.on("close", async () => {
    state.activeChild = null;
    const status = await getStatusBySessionId(state.activeSessionId);
    emitSse("status", status);
    emitSse("result", { sessionId: status.sessionId, result: status.result, summaryPath: status.summaryPath });
  });

  await writeJsonSafe(ACTIVE_SESSION_PATH, {
    sessionId,
    statusPath: state.activeStatusPath,
    startedAt: nowIso(),
    status: "running"
  });

  return { sessionId, inputPath };
}

async function writeJsonSafe(absPath, payload) {
  await fs.writeFile(absPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function serveStatic(res, filePath) {
  const abs = path.resolve(ROOT, filePath);
  const rel = path.relative(ROOT, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return sendError(res, 403, "Forbidden");
  }
  try {
    const data = await fs.readFile(abs);
    const contentType = STATIC_TYPES.get(path.extname(abs).toLowerCase()) || "application/octet-stream";
    res.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store"
    });
    res.end(data);
  } catch {
    sendError(res, 404, "File not found");
  }
}

async function handleApi(req, res, urlObj) {
  if (req.method === "GET" && urlObj.pathname === "/api/status") {
    const requested = String(urlObj.searchParams.get("sessionId") || "").trim();
    const sessionId = requested || (await getActiveSessionInfo()).sessionId;
    const status = await getStatusBySessionId(sessionId);
    return json(res, 200, status);
  }

  if (req.method === "GET" && urlObj.pathname === "/api/log") {
    const requested = String(urlObj.searchParams.get("sessionId") || "").trim();
    const sessionId = requested || (await getActiveSessionInfo()).sessionId;
    if (!sessionId) {
      return json(res, 200, { entries: [] });
    }
    const entries = await readJsonl(path.join(LOG_DIR, `${sessionId}.jsonl`));
    return json(res, 200, { sessionId, entries });
  }

  if (req.method === "GET" && urlObj.pathname === "/api/result") {
    const requested = String(urlObj.searchParams.get("sessionId") || "").trim();
    const sessionId = requested || (await getActiveSessionInfo()).sessionId;
    const status = await getStatusBySessionId(sessionId);
    let summary = "";
    if (status.summaryPath) {
      try {
        summary = await fs.readFile(status.summaryPath, "utf8");
      } catch {
        summary = "";
      }
    }
    return json(res, 200, {
      sessionId: status.sessionId,
      status: status.status,
      result: status.result,
      summary,
      summaryPath: status.summaryPath
    });
  }

  if (req.method === "GET" && urlObj.pathname === "/api/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive"
    });
    res.write("event: ready\ndata: {}\n\n");
    state.sseClients.add(res);
    startStatusBroadcastLoop();
    req.on("close", () => {
      state.sseClients.delete(res);
      stopStatusBroadcastLoopIfIdle();
    });
    return;
  }

  if (req.method === "POST" && urlObj.pathname === "/api/start-session") {
    try {
      const body = await readBody(req);
      const started = await startSession(body);
      return json(res, 200, { ok: true, ...started });
    } catch (error) {
      return sendError(res, 400, "Failed to start session", { message: error.message });
    }
  }

  if (req.method === "POST" && urlObj.pathname === "/api/cancel") {
    if (!state.activeChild) {
      return json(res, 200, { ok: true, message: "No active process" });
    }
    state.activeChild.kill("SIGTERM");
    return json(res, 200, { ok: true, message: "Cancel signal sent" });
  }

  return sendError(res, 404, "API endpoint not found");
}

async function handle(req, res) {
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (urlObj.pathname.startsWith("/api/")) {
    return handleApi(req, res, urlObj);
  }

  if (urlObj.pathname === "/" || urlObj.pathname === "/patchUI.html") {
    return serveStatic(res, "patchUI.html");
  }
  if (urlObj.pathname === "/popup" || urlObj.pathname === "/patchPopup.html") {
    return serveStatic(res, "patchPopup.html");
  }
  return serveStatic(res, urlObj.pathname.slice(1));
}

await ensureDirs();
await getActiveSessionInfo();

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    sendError(res, 500, "Server error", { message: error.message });
  });
});

server.listen(PORT, () => {
  console.log(`[PATCH_SERVER] listening on http://localhost:${PORT}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (state.activeChild) {
      try {
        state.activeChild.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
    process.exit(0);
  });
}
