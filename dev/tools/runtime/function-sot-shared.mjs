import { readFile } from "node:fs/promises";
import path from "node:path";
import { compareAlpha, listFilesRecursive, toPosixPath } from "./runtime-shared.mjs";

function categoryForFile(relPath) {
  if (relPath.startsWith("app/src/kernel/")) {
    return "kernel-core";
  }
  if (relPath.startsWith("app/src/game/")) {
    return "app";
  }
  if (relPath.startsWith("app/src/ui/") || relPath.startsWith("app/src/plugins/")) {
    return "ui";
  }
  if (relPath.startsWith("app/server/")) {
    return "server";
  }
  if (relPath.startsWith("dev/tools/runtime/")) {
    return "runtime-tooling";
  }
  if (relPath.startsWith("dev/tools/patch/")) {
    return "patch-tooling";
  }
  if (relPath.startsWith("dev/scripts/") || relPath.startsWith("dev/tests/")) {
    return "testing";
  }
  return "other";
}

function lineForIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function parseFunctionsInFile(relPath, code) {
  const out = [];
  const seen = new Set();
  const category = categoryForFile(relPath);

  const patterns = [
    { kind: "function", rx: /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g },
    { kind: "arrow", rx: /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g },
    { kind: "method", rx: /(?:^|\n)\s*(?:static\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g }
  ];

  for (const pattern of patterns) {
    let match = null;
    while ((match = pattern.rx.exec(code)) !== null) {
      const name = String(match[1] || "").trim();
      if (!name) {
        continue;
      }
      if (["if", "for", "while", "switch", "catch", "constructor"].includes(name)) {
        continue;
      }
      const line = lineForIndex(code, match.index);
      const id = `${relPath}#${name}@${line}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      out.push({
        id,
        name,
        file: relPath,
        line,
        kind: pattern.kind,
        category
      });
    }
  }

  return out;
}

function isTargetFile(relPath) {
  return /\.(js|mjs|cjs)$/.test(relPath);
}

export async function buildFunctionSot(rootDir = process.cwd()) {
  const scanRoots = ["app/src", "app/server", "dev/tools", "dev/scripts", "dev/tests"];
  const functions = [];
  const seenFiles = new Set();

  for (const relRoot of scanRoots) {
    const absRoot = path.join(rootDir, relRoot);
    let files = [];
    try {
      files = await listFilesRecursive(absRoot);
    } catch {
      files = [];
    }
    for (const absFile of files) {
      const relPath = toPosixPath(path.relative(rootDir, absFile));
      if (!isTargetFile(relPath) || seenFiles.has(relPath)) {
        continue;
      }
      seenFiles.add(relPath);
      const code = await readFile(absFile, "utf8");
      functions.push(...parseFunctionsInFile(relPath, code));
    }
  }

  functions.sort((a, b) => compareAlpha(a.id, b.id));
  return {
    version: "function-sot.v2",
    generatedFrom: ["app/src", "app/server", "dev/tools", "dev/scripts", "dev/tests"],
    functions
  };
}
