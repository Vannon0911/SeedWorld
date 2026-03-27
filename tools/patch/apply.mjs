import { randomUUID, createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import JSZip from "jszip";

const ROOT = process.cwd();
const PATCH_MANAGER_DIR = path.join(ROOT, ".patch-manager");
const INTAKE_DIR = path.join(PATCH_MANAGER_DIR, "intake");
const LOG_DIR = path.join(PATCH_MANAGER_DIR, "logs");
const SESSION_DIR = path.join(PATCH_MANAGER_DIR, "sessions");
const BACKUP_DIR = path.join(PATCH_MANAGER_DIR, "backups");
const LOCK_PATH = path.join(PATCH_MANAGER_DIR, "terminal-session.lock");
const ACTIVE_SESSION_PATH = path.join(PATCH_MANAGER_DIR, "active-session.json");

const PHASES = [
  "intake",
  "unpack",
  "manifest-validate",
  "normalize",
  "risk-classify",
  "acquire-lock",
  "llm-gates",
  "backup",
  "apply",
  "verify",
  "test",
  "finalize",
  "release-lock"
];

const DEFAULT_ALLOWED_COMMAND_PREFIXES = (process.env.PATCH_ALLOWED_COMMANDS || "npm test,npm run sync:docs,node tools/runtime/preflight.mjs")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const FORBIDDEN_COMMAND_CHARS = /[;|`&<>$()\n\r]/;

function nowIso() {
  return new Date().toISOString();
}

function normalizeRelFile(file) {
  const raw = String(file || "").trim();
  if (!raw) return "";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    throw new Error(`Invalid file encoding: ${raw}`);
  }
  if (decoded.includes("\0")) {
    throw new Error(`Invalid file path: ${raw}`);
  }
  const normalized = decoded.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  if (segments.some((seg) => seg === "." || seg === "..")) {
    throw new Error(`Invalid file path: ${raw}`);
  }
  return segments.join("/");
}

function splitCommand(command) {
  const input = String(command || "").trim();
  if (!input) {
    throw new Error("run-command requires a command string.");
  }
  if (FORBIDDEN_COMMAND_CHARS.test(input)) {
    throw new Error("run-command blocked: contains forbidden shell characters.");
  }
  const tokens = input.match(/(?:[^\s\"]+|\"[^\"]*\")+/g) || [];
  if (tokens.length === 0) {
    throw new Error("run-command blocked: no command tokens found.");
  }
  return tokens.map((t) => t.replace(/^\"|\"$/g, ""));
}

function commandPrefixAllowed(command) {
  const input = String(command || "").trim();
  return DEFAULT_ALLOWED_COMMAND_PREFIXES.some((prefix) => {
    if (!prefix) return false;
    return input === prefix || input.startsWith(`${prefix} `);
  });
}

function makeError(code, phase, message, context = {}) {
  const err = new Error(message);
  err.code = code;
  err.phase = phase;
  err.context = context;
  return err;
}

function suggestedFixFromMessage(message) {
  const m = String(message || "").toLowerCase();
  if (m.includes("manifest")) return "Pruefe Manifest-Struktur und Pflichtfelder (meta, patches).";
  if (m.includes("lock")) return "Warte auf Lock-Timeout oder stoppe die andere Session kontrolliert.";
  if (m.includes("llm")) return "Fuehre Entry/Ack/Check fuer die betroffenen Pfade erneut aus.";
  if (m.includes("run-command")) return "Nutze nur freigegebene Befehls-Prefixe ohne Sonderzeichen.";
  if (m.includes("zip")) return "Pruefe ZIP-Inhalt und stelle genau ein valides Manifest sicher.";
  return "Pruefe den Fehlerkontext in den Session-Logs und wiederhole den Lauf mit korrigiertem Input.";
}

async function ensureDirs() {
  await fs.mkdir(PATCH_MANAGER_DIR, { recursive: true });
  await fs.mkdir(INTAKE_DIR, { recursive: true });
  await fs.mkdir(LOG_DIR, { recursive: true });
  await fs.mkdir(SESSION_DIR, { recursive: true });
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

async function fileExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const out = {
    input: "",
    actor: "terminal",
    sessionId: ""
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") {
      out.input = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--actor") {
      out.actor = argv[i + 1] || out.actor;
      i += 1;
      continue;
    }
    if (arg === "--session-id") {
      out.sessionId = argv[i + 1] || "";
      i += 1;
    }
  }
  if (!out.input) {
    throw new Error("Missing required --input <path-to-zip-or-json>.");
  }
  return out;
}

async function writeJson(absPath, data) {
  await fs.writeFile(absPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function createSessionContext({ sessionId, actor, input }) {
  const logPath = path.join(LOG_DIR, `${sessionId}.jsonl`);
  const summaryPath = path.join(LOG_DIR, `${sessionId}.summary.txt`);
  const statusPath = path.join(SESSION_DIR, `${sessionId}.status.json`);

  const context = {
    sessionId,
    actor,
    input,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    phase: "intake",
    phaseIndex: 0,
    phaseTotal: PHASES.length,
    progress: 0,
    status: "running",
    lock: {
      state: "not-acquired",
      path: LOCK_PATH,
      ownerSessionId: null,
      expiresAt: null
    },
    current: {
      patchId: null,
      file: null
    },
    gateStatus: {
      required: false,
      state: "pending",
      steps: []
    },
    counts: {
      total: 0,
      applied: 0,
      skipped: 0,
      failed: 0
    },
    patches: [],
    result: {
      status: "running",
      applied: [],
      skipped: [],
      failed: [],
      rollback: {
        attempted: false,
        restoredFiles: [],
        failedFiles: []
      }
    },
    error: null,
    logPath,
    summaryPath,
    statusPath,
    manifestPath: null,
    intakePath: null,
    phaseHistory: []
  };

  return context;
}

async function appendLog(context, entry) {
  const row = {
    time: nowIso(),
    sessionId: context.sessionId,
    phase: context.phase,
    ...entry
  };
  await fs.appendFile(context.logPath, `${JSON.stringify(row)}\n`, "utf8");
}

async function persistStatus(context) {
  context.updatedAt = nowIso();
  const status = {
    sessionId: context.sessionId,
    actor: context.actor,
    input: context.input,
    startedAt: context.startedAt,
    updatedAt: context.updatedAt,
    phase: context.phase,
    progress: {
      current: context.phaseIndex + 1,
      total: context.phaseTotal,
      percent: context.progress
    },
    status: context.status,
    lock: context.lock,
    current: context.current,
    gateStatus: context.gateStatus,
    counts: context.counts,
    patches: context.patches,
    result: context.result,
    error: context.error,
    logPath: context.logPath,
    summaryPath: context.summaryPath,
    manifestPath: context.manifestPath,
    intakePath: context.intakePath,
    phaseHistory: context.phaseHistory
  };
  await writeJson(context.statusPath, status);
  await writeJson(ACTIVE_SESSION_PATH, {
    sessionId: context.sessionId,
    statusPath: context.statusPath,
    logPath: context.logPath,
    summaryPath: context.summaryPath,
    updatedAt: context.updatedAt,
    status: context.status
  });
}

async function enterPhase(context, phase, note = "") {
  const idx = PHASES.indexOf(phase);
  context.phase = phase;
  context.phaseIndex = idx >= 0 ? idx : context.phaseIndex;
  context.progress = Math.round(((context.phaseIndex + 1) / context.phaseTotal) * 100);
  context.phaseHistory.push({ phase, at: nowIso(), note });
  await appendLog(context, { level: "info", event: "phase", note });
  await persistStatus(context);
}

async function writeSummary(context) {
  const lines = [];
  lines.push(`Session: ${context.sessionId}`);
  lines.push(`Actor: ${context.actor}`);
  lines.push(`Input: ${context.input}`);
  lines.push(`Status: ${context.result.status}`);
  lines.push(`Phase: ${context.phase}`);
  lines.push(`Started: ${context.startedAt}`);
  lines.push(`Updated: ${context.updatedAt}`);
  lines.push("");
  lines.push(`Applied (${context.result.applied.length}):`);
  for (const item of context.result.applied) {
    lines.push(`- ${item.patchId} (${item.file || "n/a"})`);
  }
  lines.push("");
  lines.push(`Skipped (${context.result.skipped.length}):`);
  for (const item of context.result.skipped) {
    lines.push(`- ${item.patchId}: ${item.reason}`);
  }
  lines.push("");
  lines.push(`Failed (${context.result.failed.length}):`);
  for (const item of context.result.failed) {
    lines.push(`- ${item.patchId || "n/a"}: ${item.message}`);
  }
  lines.push("");
  lines.push(`Rollback attempted: ${context.result.rollback.attempted}`);
  lines.push(`Rollback restored (${context.result.rollback.restoredFiles.length}): ${context.result.rollback.restoredFiles.join(", ") || "-"}`);
  lines.push(`Rollback failed (${context.result.rollback.failedFiles.length}): ${context.result.rollback.failedFiles.join(", ") || "-"}`);
  lines.push("");
  if (context.error) {
    lines.push("Last error:");
    lines.push(JSON.stringify(context.error, null, 2));
    lines.push("");
  }
  lines.push("Next action:");
  if (context.result.status === "succeeded") {
    lines.push("- Review summary, then continue with the next patch input.");
  } else {
    lines.push("- Open jsonl log, fix the cause, and rerun `npm run patch:apply -- --input <path>`.");
  }
  await fs.writeFile(context.summaryPath, `${lines.join("\n")}\n`, "utf8");
}

function normalizeZipEntryName(entry) {
  return String(entry || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

async function unpackZipToDir(zipPath, targetDir) {
  const buf = await fs.readFile(zipPath);
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files)
    .map((name) => normalizeZipEntryName(name))
    .filter(Boolean);

  const files = [];
  for (const name of names) {
    const entry = zip.files[name];
    if (!entry || entry.dir) {
      continue;
    }
    const abs = path.join(targetDir, name);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const data = await entry.async("nodebuffer");
    await fs.writeFile(abs, data);
    files.push(name);
  }
  return files.sort();
}

function pickManifestFromFileList(files) {
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));
  if (jsonFiles.length === 0) {
    return { selected: null, reason: "No JSON file found in ZIP." };
  }

  const preferred = jsonFiles.filter((f) => /(^|\/)patches.*\.json$/i.test(f));
  if (preferred.length === 1) {
    return { selected: preferred[0], reason: "preferred patches*.json" };
  }
  if (preferred.length > 1) {
    return { selected: null, reason: `Multiple patches*.json candidates: ${preferred.join(", ")}` };
  }
  if (jsonFiles.length === 1) {
    return { selected: jsonFiles[0], reason: "single JSON file" };
  }
  return { selected: null, reason: `Multiple JSON files, cannot auto-select: ${jsonFiles.join(", ")}` };
}

function ensureManifestShape(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw makeError("MANIFEST_INVALID", "manifest-validate", "Manifest must be an object.");
  }
  if (!manifest.meta || typeof manifest.meta !== "object" || Array.isArray(manifest.meta)) {
    throw makeError("MANIFEST_INVALID", "manifest-validate", "Manifest requires meta object.");
  }
  if (!Array.isArray(manifest.patches) && !Array.isArray(manifest.agentPatches)) {
    throw makeError("MANIFEST_INVALID", "manifest-validate", "Manifest requires patches or agentPatches array.");
  }
}

function sha256Text(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function normalizeManifest(manifest) {
  const entries = [];
  if (Array.isArray(manifest.agentPatches)) {
    for (const agentItem of manifest.agentPatches) {
      const agentId = String(agentItem?.agentId || "unknown-agent");
      const patches = Array.isArray(agentItem?.patches) ? agentItem.patches : [];
      patches.forEach((patch, idx) => {
        entries.push({
          agentId,
          ordinal: idx,
          patch
        });
      });
    }
  }

  if (Array.isArray(manifest.patches)) {
    manifest.patches.forEach((patch, idx) => {
      entries.push({
        agentId: String(patch?.agentId || manifest.meta?.llm?.agentId || "default-agent"),
        ordinal: idx,
        patch
      });
    });
  }

  if (entries.length === 0) {
    throw makeError("MANIFEST_EMPTY", "normalize", "No patch entries found after normalization.");
  }

  const normalized = entries
    .map((entry) => {
      const patch = entry.patch || {};
      return {
        ...patch,
        agentId: entry.agentId,
        id: String(patch.id || "").trim(),
        name: String(patch.name || "").trim(),
        type: String(patch.type || "").trim(),
        file: patch.type === "run-command" ? null : normalizeRelFile(patch.file),
        _agentId: entry.agentId,
        _ordinal: entry.ordinal
      };
    })
    .sort((a, b) => {
      const byAgent = a._agentId.localeCompare(b._agentId);
      if (byAgent !== 0) return byAgent;
      const byId = String(a.id || "").localeCompare(String(b.id || ""));
      if (byId !== 0) return byId;
      return a._ordinal - b._ordinal;
    })
    .map((patch, idx) => {
      const canonicalId = patch.id || `patch-${String(idx + 1).padStart(4, "0")}`;
      return {
        ...patch,
        id: canonicalId,
        name: patch.name || canonicalId
      };
    });

  const seen = new Map();
  for (const patch of normalized) {
    if (!patch.type) {
      throw makeError("PATCH_INVALID", "normalize", `Patch ${patch.id} has no type.`, {
        patchId: patch.id
      });
    }
    if (!["string-replace", "file-create", "file-append", "file-replace", "json-update", "run-command"].includes(patch.type)) {
      throw makeError("PATCH_INVALID", "normalize", `Patch ${patch.id} has unsupported type: ${patch.type}.`, {
        patchId: patch.id
      });
    }

    if (patch.type !== "run-command" && !patch.file) {
      throw makeError("PATCH_INVALID", "normalize", `Patch ${patch.id} requires a file target.`, {
        patchId: patch.id
      });
    }

    const digest = sha256Text(JSON.stringify({ ...patch, _agentId: undefined, _ordinal: undefined }));
    if (seen.has(patch.id) && seen.get(patch.id) !== digest) {
      throw makeError("PATCH_CONFLICT", "normalize", `Conflicting duplicate patch id: ${patch.id}.`, {
        patchId: patch.id
      });
    }
    seen.set(patch.id, digest);
  }

  return {
    meta: {
      ...manifest.meta,
      normalizedAt: nowIso(),
      normalizedBy: "tools/patch/apply.mjs"
    },
    patches: normalized
  };
}

function classifyRisk(manifest) {
  const files = [...new Set(manifest.patches.map((p) => p.file).filter(Boolean))];
  const criticalHit = files.some((f) => f.startsWith("src/kernel/") || f.startsWith("docs/llm/"));
  if (criticalHit) {
    return { level: "critical", files };
  }
  const cautionHit = files.some((f) => f.startsWith("src/") || f.startsWith("tools/"));
  if (cautionHit) {
    return { level: "caution", files };
  }
  return { level: "safe", files };
}

function isProcessAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireTerminalLock(context, ttlSeconds) {
  const now = Date.now();
  const ttlMs = Math.max(10_000, Math.floor(ttlSeconds * 1000));
  let takeover = false;
  let existing = null;

  if (await fileExists(LOCK_PATH)) {
    try {
      existing = JSON.parse(await fs.readFile(LOCK_PATH, "utf8"));
    } catch {
      existing = null;
    }
  }

  if (existing) {
    const expiresAtMs = new Date(existing.expiresAt || 0).getTime();
    const alive = isProcessAlive(Number(existing.pid || 0));
    const stale = !alive || !Number.isFinite(expiresAtMs) || now >= expiresAtMs;
    if (!stale) {
      throw makeError("LOCK_ACTIVE", "acquire-lock", `Another active terminal session holds the lock (${existing.sessionId || "unknown"}).`, {
        lockOwner: existing
      });
    }
    takeover = true;
  }

  const lock = {
    pid: process.pid,
    startedAt: nowIso(),
    heartbeatAt: nowIso(),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    sessionId: context.sessionId,
    actor: context.actor
  };

  await writeJson(LOCK_PATH, lock);
  context.lock = {
    state: takeover ? "acquired-stale-takeover" : "acquired",
    path: LOCK_PATH,
    ownerSessionId: context.sessionId,
    expiresAt: lock.expiresAt
  };

  let interval = setInterval(async () => {
    try {
      const latest = JSON.parse(await fs.readFile(LOCK_PATH, "utf8"));
      if (latest.sessionId !== context.sessionId) {
        clearInterval(interval);
        interval = null;
        return;
      }
      latest.heartbeatAt = nowIso();
      latest.expiresAt = new Date(Date.now() + ttlMs).toISOString();
      await writeJson(LOCK_PATH, latest);
      context.lock.expiresAt = latest.expiresAt;
      await persistStatus(context);
    } catch {
      // ignore heartbeat race
    }
  }, 5000);

  return async () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    try {
      const latest = JSON.parse(await fs.readFile(LOCK_PATH, "utf8"));
      if (latest.sessionId === context.sessionId) {
        await fs.unlink(LOCK_PATH);
      }
    } catch {
      // ignore
    }
    context.lock.state = "released";
    context.lock.ownerSessionId = null;
    context.lock.expiresAt = null;
    await persistStatus(context);
  };
}

async function runProcess(command, args, cwd = ROOT) {
  const binary = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error(`${binary} ${args.join(" ")} failed (${code}): ${stderr || stdout}`));
      }
    });
  });
}

async function runCommandPatch(command) {
  const [cmd, ...args] = splitCommand(command);
  if (!commandPrefixAllowed(command)) {
    throw new Error(`run-command blocked. Allowed prefixes: ${DEFAULT_ALLOWED_COMMAND_PREFIXES.join(", ")}`);
  }
  return runProcess(cmd, args, ROOT);
}

function setByPath(target, pathExpr, value) {
  const parts = String(pathExpr || "")
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error("json-update requires a non-empty path.");
  }
  let ptr = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!Object.prototype.hasOwnProperty.call(ptr, key) || typeof ptr[key] !== "object" || ptr[key] === null) {
      ptr[key] = {};
    }
    ptr = ptr[key];
  }
  ptr[parts[parts.length - 1]] = value;
}

async function backupTouchedFiles(context, manifest) {
  const touched = [...new Set(manifest.patches.map((p) => p.file).filter(Boolean))];
  const records = new Map();

  for (const rel of touched) {
    const abs = path.join(ROOT, rel);
    const backupAbs = path.join(BACKUP_DIR, context.sessionId, rel);
    await fs.mkdir(path.dirname(backupAbs), { recursive: true });
    if (await fileExists(abs)) {
      const data = await fs.readFile(abs);
      await fs.writeFile(backupAbs, data);
      records.set(rel, { existed: true, backupAbs });
    } else {
      records.set(rel, { existed: false, backupAbs: null });
    }
  }

  return records;
}

async function applyPatchItem(patch) {
  if (patch.type === "run-command") {
    const result = await runCommandPatch(String(patch.command || ""));
    return { status: "applied", details: { stdout: result.stdout, stderr: result.stderr } };
  }

  const rel = normalizeRelFile(patch.file);
  const abs = path.join(ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });

  if (patch.type === "file-create") {
    await fs.writeFile(abs, String(patch.content || ""), "utf8");
    return { status: "applied" };
  }

  if (patch.type === "file-append") {
    await fs.appendFile(abs, String(patch.content || ""), "utf8");
    return { status: "applied" };
  }

  if (patch.type === "file-replace") {
    await fs.writeFile(abs, String(patch.content || ""), "utf8");
    return { status: "applied" };
  }

  if (patch.type === "string-replace") {
    const source = await fs.readFile(abs, "utf8");
    const find = String(patch.find || "");
    if (!find) {
      throw new Error(`Patch ${patch.id} string-replace missing find.`);
    }
    if (!source.includes(find)) {
      throw new Error(`Patch ${patch.id} cannot find target string in ${rel}.`);
    }
    const replace = String(patch.replace || "");
    const next = patch.all === true ? source.split(find).join(replace) : source.replace(find, replace);
    await fs.writeFile(abs, next, "utf8");
    return { status: "applied" };
  }

  if (patch.type === "json-update") {
    const source = await fs.readFile(abs, "utf8");
    const data = JSON.parse(source);
    setByPath(data, patch.path, patch.value);
    await fs.writeFile(abs, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    return { status: "applied" };
  }

  throw new Error(`Unsupported patch type: ${patch.type}`);
}

async function rollbackFromBackups(context, backups) {
  context.result.rollback.attempted = true;
  const restored = [];
  const failed = [];

  for (const [rel, record] of backups.entries()) {
    try {
      const abs = path.join(ROOT, rel);
      if (record.existed) {
        const data = await fs.readFile(record.backupAbs);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, data);
      } else {
        if (await fileExists(abs)) {
          await fs.unlink(abs);
        }
      }
      restored.push(rel);
    } catch {
      failed.push(rel);
    }
  }

  context.result.rollback.restoredFiles = restored;
  context.result.rollback.failedFiles = failed;
  return { restored, failed };
}

async function runLlmGates(context, manifest) {
  const affected = [...new Set(manifest.patches.map((p) => p.file).filter(Boolean))];
  context.gateStatus = {
    required: affected.length > 0,
    state: affected.length > 0 ? "running" : "skipped",
    steps: []
  };
  await persistStatus(context);

  if (affected.length === 0) {
    return;
  }

  const pathArg = affected.join(",");
  const steps = ["entry", "ack", "check"];

  for (const step of steps) {
    const args = ["tools/llm-preflight.mjs", step, "--paths", pathArg];
    const result = await runProcess("node", args, ROOT);
    context.gateStatus.steps.push({ step, ok: true, output: (result.stdout || "").trim().slice(0, 2000) });
    await appendLog(context, {
      level: "info",
      event: "llm-gate",
      gateStep: step,
      message: "completed"
    });
    await persistStatus(context);
  }

  context.gateStatus.state = "passed";
  await persistStatus(context);
}

function toErrorPayload(context, error, extra = {}) {
  const phase = error.phase || context.phase;
  const patchId = error.context?.patchId || context.current.patchId || null;
  const file = error.context?.file || context.current.file || null;
  return {
    code: error.code || "PATCH_FAILED",
    phase,
    patchId,
    file,
    message: error.message || "Unknown error",
    details: {
      stack: error.stack || "",
      context: error.context || {},
      ...extra
    },
    suggestedFix: suggestedFixFromMessage(error.message || "")
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const sessionId = args.sessionId || randomUUID();

  await ensureDirs();
  const context = createSessionContext({
    sessionId,
    actor: String(args.actor || "terminal"),
    input: String(args.input)
  });

  await persistStatus(context);
  await appendLog(context, { level: "info", event: "session-start", message: "session started" });

  let releaseLock = null;
  let backups = new Map();

  try {
    await enterPhase(context, "intake", "Resolve input");

    const inputPath = path.isAbsolute(args.input) ? args.input : path.resolve(ROOT, args.input);
    const inputExists = await fileExists(inputPath);
    if (!inputExists) {
      throw makeError("INPUT_NOT_FOUND", "intake", `Input not found: ${inputPath}`, { file: inputPath });
    }

    const intakeSessionDir = path.join(INTAKE_DIR, context.sessionId);
    await fs.mkdir(intakeSessionDir, { recursive: true });
    context.intakePath = intakeSessionDir;

    const ext = path.extname(inputPath).toLowerCase();
    let manifest = null;
    let manifestAbsPath = null;

    if (ext === ".zip") {
      await enterPhase(context, "unpack", "Unpack ZIP into intake directory");
      const unpackedFiles = await unpackZipToDir(inputPath, intakeSessionDir);
      const pick = pickManifestFromFileList(unpackedFiles);
      if (!pick.selected) {
        throw makeError("MANIFEST_NOT_FOUND", "unpack", `Manifest auto-detect failed: ${pick.reason}`, {
          files: unpackedFiles
        });
      }
      manifestAbsPath = path.join(intakeSessionDir, pick.selected);
      context.manifestPath = manifestAbsPath;
      manifest = JSON.parse(await fs.readFile(manifestAbsPath, "utf8"));
      await appendLog(context, {
        level: "info",
        event: "manifest-detected",
        message: "Manifest selected from ZIP",
        manifestFile: pick.selected,
        fileCount: unpackedFiles.length
      });
    } else {
      manifestAbsPath = inputPath;
      context.manifestPath = manifestAbsPath;
      manifest = JSON.parse(await fs.readFile(inputPath, "utf8"));
    }

    await enterPhase(context, "manifest-validate", "Validate manifest shape");
    ensureManifestShape(manifest);

    await enterPhase(context, "normalize", "Normalize incoming patches into canonical manifest");
    const normalizedManifest = normalizeManifest(manifest);
    context.patches = normalizedManifest.patches.map((patch) => ({
      id: patch.id,
      type: patch.type,
      file: patch.file,
      state: "pending"
    }));
    context.counts.total = normalizedManifest.patches.length;
    await appendLog(context, {
      level: "info",
      event: "manifest-normalized",
      message: "canonical manifest built",
      patchCount: normalizedManifest.patches.length
    });

    await enterPhase(context, "risk-classify", "Classify risk by target scope");
    const risk = classifyRisk(normalizedManifest);
    await appendLog(context, {
      level: "info",
      event: "risk",
      message: `risk=${risk.level}`,
      files: risk.files
    });

    await enterPhase(context, "acquire-lock", "Acquire terminal session lock");
    const ttlSeconds = Number(normalizedManifest.meta?.gates?.deadmanSeconds || 120);
    releaseLock = await acquireTerminalLock(context, ttlSeconds);

    await enterPhase(context, "llm-gates", "Execute terminal-only LLM gates");
    await runLlmGates(context, normalizedManifest);

    await enterPhase(context, "backup", "Create pre-apply backup snapshot");
    backups = await backupTouchedFiles(context, normalizedManifest);

    await enterPhase(context, "apply", "Apply canonical patch sequence");
    for (const patch of normalizedManifest.patches) {
      context.current.patchId = patch.id;
      context.current.file = patch.file || null;
      await persistStatus(context);

      const patchState = context.patches.find((p) => p.id === patch.id);
      if (patchState) patchState.state = "running";
      await persistStatus(context);

      try {
        await applyPatchItem(patch);
        if (patchState) patchState.state = "applied";
        context.result.applied.push({ patchId: patch.id, file: patch.file || null });
        context.counts.applied += 1;
        await appendLog(context, {
          level: "info",
          event: "patch-applied",
          patchId: patch.id,
          file: patch.file || null
        });
      } catch (error) {
        if (patchState) patchState.state = "failed";
        context.counts.failed += 1;
        context.result.failed.push({
          patchId: patch.id,
          file: patch.file || null,
          message: error.message
        });
        throw makeError("PATCH_APPLY_FAILED", "apply", error.message, {
          patchId: patch.id,
          file: patch.file || null
        });
      }
      await persistStatus(context);
    }

    await enterPhase(context, "verify", "Run post-apply verification");
    const verifyCommands = Array.isArray(normalizedManifest.meta?.gates?.afterCommands)
      ? normalizedManifest.meta.gates.afterCommands
      : [];
    for (const command of verifyCommands) {
      const result = await runCommandPatch(String(command));
      await appendLog(context, {
        level: "info",
        event: "verify-command",
        command,
        stdout: (result.stdout || "").slice(0, 2000)
      });
    }

    await enterPhase(context, "test", "Optional test execution");
    if (normalizedManifest.meta?.gates?.runTests === true) {
      const result = await runProcess("npm", ["test"], ROOT);
      await appendLog(context, {
        level: "info",
        event: "tests",
        message: "npm test passed",
        stdout: (result.stdout || "").slice(0, 2000)
      });
    } else {
      await appendLog(context, { level: "info", event: "tests", message: "skipped (runTests=false)" });
    }

    await enterPhase(context, "finalize", "Finalize successful run");
    context.current.patchId = null;
    context.current.file = null;
    context.result.status = "succeeded";
    context.status = "completed";
    await appendLog(context, { level: "info", event: "finalized", message: "session succeeded" });

    await enterPhase(context, "release-lock", "Release terminal lock");
    if (releaseLock) {
      await releaseLock();
      releaseLock = null;
    }

    await writeSummary(context);
    await persistStatus(context);
    process.stdout.write(`${JSON.stringify({ ok: true, sessionId: context.sessionId, summaryPath: context.summaryPath })}\n`);
  } catch (error) {
    const payload = toErrorPayload(context, error);
    context.error = payload;
    await appendLog(context, {
      level: "error",
      event: "session-error",
      ...payload
    });

    if (context.phase !== "release-lock") {
      try {
        const rollback = await rollbackFromBackups(context, backups);
        context.result.status = rollback.failed.length === 0 ? "failed_rolled_back" : "failed_partial";
      } catch (rollbackError) {
        context.result.status = "failed_partial";
        context.result.rollback.failedFiles.push(`rollback-internal: ${rollbackError.message}`);
      }
    }

    context.status = "failed";

    try {
      await enterPhase(context, "finalize", "Finalize failed run");
      await enterPhase(context, "release-lock", "Release terminal lock after failure");
    } catch {
      // no-op
    }

    if (releaseLock) {
      try {
        await releaseLock();
      } catch {
        // ignore lock release errors on failure path
      }
      releaseLock = null;
    }

    await writeSummary(context);
    await persistStatus(context);

    process.stderr.write(`${JSON.stringify({ ok: false, sessionId: context.sessionId, error: payload })}\n`);
    process.exit(1);
  }
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
