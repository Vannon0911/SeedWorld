import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";

export function toPosixPath(input) {
  return String(input || "").split(path.sep).join("/");
}

export function compareAlpha(a, b) {
  return String(a || "").localeCompare(String(b || ""), "en");
}

export function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

export async function listFilesRecursive(absDir, options = {}) {
  const { filterFile } = options;
  const out = [];
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(abs, options)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (typeof filterFile === "function" && !filterFile(abs, entry)) continue;
    out.push(abs);
  }
  return out;
}

