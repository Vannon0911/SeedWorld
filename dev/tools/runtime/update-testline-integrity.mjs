import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compareAlpha, listFilesRecursive, sha256Hex, toPosixPath } from "./runtime-shared.mjs";

const root = process.cwd();
const baselinePath = path.join(root, "app", "src", "sot", "testline-integrity.json");
const monitoredRoots = ["dev/scripts", "dev/tests"];
const monitoredExts = new Set([".js", ".mjs"]);

async function collect() {
  const relFiles = [];
  const hashes = {};
  for (const relRoot of monitoredRoots) {
    const absRoot = path.join(root, relRoot);
    const listed = await listFilesRecursive(absRoot, {
      filterFile: (_abs, entry) => monitoredExts.has(path.extname(entry.name).toLowerCase())
    });
    for (const absPath of listed) {
      const relPath = toPosixPath(path.relative(root, absPath));
      const raw = await readFile(absPath, "utf8");
      relFiles.push(relPath);
      hashes[relPath] = sha256Hex(raw);
    }
  }
  relFiles.sort(compareAlpha);
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
