import { createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const vaultDir = path.join(root, "runtime", ".patch-manager", ".vault");
const keyPath = path.join(vaultDir, ".k");
const lockPath = path.join(vaultDir, ".evidence.lock");
const logsDir = path.join(root, "runtime", ".patch-manager", "logs");

function parseArgs(argv) {
  const mode = argv.includes("--update") ? "update" : "verify";
  return { mode };
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

async function readUtf8OrNull(absPath) {
  try {
    return await readFile(absPath, "utf8");
  } catch {
    return null;
  }
}

async function ensureKey() {
  await mkdir(vaultDir, { recursive: true });
  const existing = await readUtf8OrNull(keyPath);
  if (existing && existing.trim()) {
    return existing.trim();
  }
  const key = randomBytes(32).toString("hex");
  await writeFile(keyPath, `${key}\n`, "utf8");
  return key;
}

async function collectEvidenceFiles() {
  const rows = [];
  let entries = [];
  try {
    entries = await readdir(logsDir, { withFileTypes: true });
  } catch {
    entries = [];
  }

  const files = entries
    .filter((entry) => entry.isFile() && /^test-run-.*\.json$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  for (const name of files) {
    const abs = path.join(logsDir, name);
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const raw = await readFile(abs, "utf8");
    const info = await stat(abs);
    rows.push({
      file: rel,
      sha256: sha256(raw),
      bytes: info.size,
      mtime: info.mtime.toISOString()
    });
  }

  return rows;
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded) {
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
}

function signPayload(key, encodedPayload) {
  return sha256(`${key}::${encodedPayload}`);
}

async function writeLock(key) {
  const files = await collectEvidenceFiles();
  const payload = {
    version: 1,
    createdAt: new Date().toISOString(),
    files,
    setHash: sha256(files.map((x) => `${x.file}|${x.sha256}|${x.bytes}`).join("\n"))
  };
  const encoded = encodePayload(payload);
  const signature = signPayload(key, encoded);
  const lock = { payload: encoded, signature };
  await writeFile(lockPath, `${JSON.stringify(lock)}\n`, "utf8");
  console.log(`[EVIDENCE_LOCK] UPDATED files=${files.length}`);
}

async function verifyLock(key) {
  const rawLock = await readUtf8OrNull(lockPath);
  if (!rawLock) {
    console.warn("[EVIDENCE_LOCK] NO_LOCK (skip)");
    return;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(rawLock);
  } catch {
    throw new Error("[EVIDENCE_LOCK] invalid lock format");
  }

  const encoded = String(parsed?.payload || "");
  const signature = String(parsed?.signature || "");
  if (!encoded || !signature) {
    throw new Error("[EVIDENCE_LOCK] incomplete lock");
  }

  const expectedSig = signPayload(key, encoded);
  if (expectedSig !== signature) {
    throw new Error("[EVIDENCE_LOCK] signature mismatch");
  }

  const payload = decodePayload(encoded);
  const files = Array.isArray(payload?.files) ? payload.files : [];

  for (const entry of files) {
    const rel = String(entry?.file || "");
    const expected = String(entry?.sha256 || "");
    const abs = path.join(root, ...rel.split("/"));
    const current = await readUtf8OrNull(abs);
    if (current === null) {
      throw new Error(`[EVIDENCE_LOCK] missing file: ${rel}`);
    }
    const digest = sha256(current);
    if (digest !== expected) {
      throw new Error(`[EVIDENCE_LOCK] hash mismatch: ${rel}`);
    }
  }

  console.log(`[EVIDENCE_LOCK] VERIFIED files=${files.length}`);
}

async function main() {
  const { mode } = parseArgs(process.argv.slice(2));
  const key = await ensureKey();
  if (mode === "update") {
    await writeLock(key);
    return;
  }
  await verifyLock(key);
}

await main();
