import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { compareAlpha, listFilesRecursive, sha256Hex, toPosixPath } from "./runtime-shared.mjs";

const root = process.cwd();
const boundariesPath = path.join(root, "app", "src", "sot", "repo-boundaries.json");
const allowlistPath = path.join(root, "app", "src", "sot", "redundancy-allowlist.json");
const evidencePath = path.join(root, "runtime", "evidence", "redundancy-report.json");
const staticRoots = ["docs", "tem"];
const trackedExtensions = new Set([".md", ".json", ".js", ".mjs", ".cjs"]);
const readOnlyVerify = process.env.RUNTIME_VERIFY_READ_ONLY === "1";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[REDUNDANCY_GUARD] ${message}`);
  }
}

function shouldTrack(rel) {
  const ext = path.extname(rel).toLowerCase();
  if (!trackedExtensions.has(ext)) return false;
  if (rel.startsWith("legacy/")) return false;
  if (rel.startsWith("runtime/")) return false;
  if (rel.startsWith(".git/")) return false;
  if (rel.includes("/node_modules/")) return false;
  if (rel.endsWith("/SCHEMA.json")) return false;
  return true;
}

async function loadAllowlist() {
  try {
    const raw = await readFile(allowlistPath, "utf8");
    const parsed = JSON.parse(raw);
    const pairs = Array.isArray(parsed?.allowedDuplicatePairs) ? parsed.allowedDuplicatePairs : [];
    const normalized = new Set();
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length !== 2) continue;
      const a = String(pair[0] || "").trim();
      const b = String(pair[1] || "").trim();
      if (!a || !b) continue;
      const key = [a, b].sort().join("||");
      normalized.add(key);
    }
    return normalized;
  } catch {
    return new Set();
  }
}

async function gatherRoots() {
  const raw = await readFile(boundariesPath, "utf8");
  const parsed = JSON.parse(raw);
  const scanRoots = Array.isArray(parsed?.scanRoots) ? parsed.scanRoots : [];
  const merged = [...new Set([...scanRoots, ...staticRoots])];
  return merged.map((rel) => ({ rel, abs: path.join(root, rel) }));
}

async function main() {
  const allowlist = await loadAllowlist();
  const roots = await gatherRoots();
  const files = [];
  const seen = new Set();

  for (const item of roots) {
    try {
      const absFiles = await listFilesRecursive(item.abs);
      for (const abs of absFiles) {
        const rel = toPosixPath(path.relative(root, abs));
        if (seen.has(rel)) continue;
        seen.add(rel);
        if (!shouldTrack(rel)) continue;
        files.push({ abs, rel });
      }
    } catch {
      // ignore missing roots
    }
  }

  const hashGroups = new Map();
  for (const file of files) {
    const bytes = await readFile(file.abs);
    const digest = sha256Hex(bytes);
    if (!hashGroups.has(digest)) hashGroups.set(digest, []);
    hashGroups.get(digest).push(file.rel);
  }

  const duplicates = [];
  for (const group of hashGroups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(compareAlpha);
    const unresolved = [];
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const key = [sorted[i], sorted[j]].sort().join("||");
        if (!allowlist.has(key)) {
          unresolved.push([sorted[i], sorted[j]]);
        }
      }
    }
    if (unresolved.length > 0) {
      duplicates.push({ files: sorted, unresolved });
    }
  }

  const expectedEvidence = {
    scanned_files: files.length,
    duplicates
  };

  if (readOnlyVerify) {
    let existing;
    try {
      existing = JSON.parse(await readFile(evidencePath, "utf8"));
    } catch (error) {
      throw new Error(`[REDUNDANCY_GUARD] evidence missing/unreadable: ${String(error?.message || error)}`);
    }
    if (!existing?.generated_at || Number.isNaN(Date.parse(existing.generated_at))) {
      throw new Error("[REDUNDANCY_GUARD] evidence missing valid generated_at");
    }
    const { generated_at: _generatedAt, ...stableExisting } = existing;
    if (!isDeepStrictEqual(stableExisting, expectedEvidence)) {
      throw new Error("[REDUNDANCY_GUARD] evidence drift: runtime/evidence/redundancy-report.json");
    }
  } else {
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(
      evidencePath,
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          ...expectedEvidence
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  assert(duplicates.length === 0, `duplicate content detected: ${duplicates.map((d) => d.files.join(", ")).join(" | ")}`);
  console.log(`[REDUNDANCY_GUARD] OK files=${files.length} duplicates=0`);
}

try {
  await main();
} catch (error) {
  console.error(String(error?.message || error));
  process.exit(1);
}
