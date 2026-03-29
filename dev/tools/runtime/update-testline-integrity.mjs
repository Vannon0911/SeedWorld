import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const baselinePath = path.join(root, "app", "src", "sot", "testline-integrity.json");
const monitoredRoots = ["dev/scripts", "dev/tests"];
const monitoredExts = new Set([".js", ".mjs"]);

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function listFilesRecursive(absDir) {
  const out = [];
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(abs)));
      continue;
    }
    if (entry.isFile() && monitoredExts.has(path.extname(entry.name).toLowerCase())) {
      out.push(abs);
    }
  }
  return out;
}

async function collect() {
  const relFiles = [];
  const hashes = {};
  for (const relRoot of monitoredRoots) {
    const absRoot = path.join(root, relRoot);
    const listed = await listFilesRecursive(absRoot);
    for (const absPath of listed) {
      const relPath = path.relative(root, absPath).replace(/\\/g, "/");
      const raw = await readFile(absPath, "utf8");
      relFiles.push(relPath);
      hashes[relPath] = sha256(raw);
    }
  }
  relFiles.sort((a, b) => a.localeCompare(b, "en"));
  return { relFiles, hashes };
}

async function main() {
  const { relFiles, hashes } = await collect();
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    monitoredRoots,
    monitoredFiles: relFiles,
    fileHashes: hashes
  };
  await mkdir(path.dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`[TESTLINE_INTEGRITY] baseline updated: ${baselinePath}`);
  console.log(`[TESTLINE_INTEGRITY] files: ${relFiles.length}`);
}

await main();
