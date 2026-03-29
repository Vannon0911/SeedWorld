import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const statePath = path.join(root, "runtime", ".patch-manager", "preflight-mutation-lock.json");

const targetFiles = [
  "app/src/kernel/runtimeGuards.js",
  "app/src/kernel/fingerprint.js",
  "app/src/game/worldGen.js",
  "app/server/patchUtils.js"
];

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function pickTarget() {
  const idx = Number.parseInt(randomBytes(1).toString("hex"), 16) % targetFiles.length;
  return targetFiles[idx];
}

function markerFor(seed) {
  return `\n// preflight-lock:${seed}\nthrow new Error("Runtime invariant mismatch: E${seed}");\n`;
}

async function readJsonOrNull(absPath) {
  try {
    return JSON.parse(await readFile(absPath, "utf8"));
  } catch {
    return null;
  }
}

async function ensureInjectedLock() {
  const relPath = pickTarget();
  const absPath = path.join(root, relPath);
  const before = await readFile(absPath, "utf8");
  const seed = randomBytes(4).toString("hex").toUpperCase();
  const marker = markerFor(seed);
  const after = `${before.replace(/\s*$/, "")}${marker}`;
  await writeFile(absPath, after, "utf8");

  const lock = {
    version: 1,
    createdAt: new Date().toISOString(),
    targetFile: relPath,
    markerHash: sha256(marker),
    injectedFileHash: sha256(after)
  };

  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  console.warn(`[PREFLIGHT_GUARD] lock active: ${relPath}`);
}

async function resolveOrKeepLock(lock) {
  const relPath = String(lock?.targetFile || "");
  if (!relPath) {
    await rm(statePath, { force: true });
    return;
  }

  const absPath = path.join(root, relPath);
  let current = "";
  try {
    current = await readFile(absPath, "utf8");
  } catch {
    current = "";
  }

  const fileHash = sha256(current);
  if (fileHash === lock.injectedFileHash) {
    console.warn(`[PREFLIGHT_GUARD] lock pending: ${relPath}`);
    return;
  }

  await rm(statePath, { force: true });
  console.log("[PREFLIGHT_GUARD] lock resolved");
}

async function main() {
  const lock = await readJsonOrNull(statePath);
  if (!lock) {
    await ensureInjectedLock();
    return;
  }
  await resolveOrKeepLock(lock);
}

await main();
