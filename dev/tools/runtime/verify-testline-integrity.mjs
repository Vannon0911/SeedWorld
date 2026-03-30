import { readFile } from "node:fs/promises";
import path from "node:path";
import { compareAlpha, listFilesRecursive, sha256Hex, toPosixPath } from "./runtime-shared.mjs";

const root = process.cwd();
const baselinePath = path.join(root, "app", "src", "sot", "testline-integrity.json");

const monitoredRoots = ["dev/scripts", "dev/tests"];
const monitoredExts = new Set([".js", ".mjs"]);

const allowDeterminismApiIn = new Set([
  "dev/scripts/runtime-guards-test.mjs"
]);

const rawForbidden = [
  /(?:^|[\s;(])eval\s*\(/i,
  /(?:^|[^A-Za-z0-9_])Function\s*\(/i,
  /setTimeout\s*\(\s*["'`]/i,
  /setInterval\s*\(\s*["'`]/i
];

const normForbiddenTokens = [
  "mathrandom",
  "globalthismathrandom",
  "performancenow",
  "cryptogetrandomvalues",
  "cryptorandomuuid",
  "constructorconstructor"
];

function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function collectMonitoredFiles() {
  const files = [];
  for (const relRoot of monitoredRoots) {
    const absRoot = path.join(root, relRoot);
    const listed = await listFilesRecursive(absRoot, {
      filterFile: (_abs, entry) => monitoredExts.has(path.extname(entry.name).toLowerCase())
    });
    for (const abs of listed) {
      files.push(toPosixPath(path.relative(root, abs)));
    }
  }
  return files.sort(compareAlpha);
}

async function loadBaseline() {
  const raw = await readFile(baselinePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const baseline = await loadBaseline();
  const monitored = await collectMonitoredFiles();
  const baselineFiles = Array.isArray(baseline.monitoredFiles) ? [...baseline.monitoredFiles].sort(compareAlpha) : [];

  const missingInBaseline = monitored.filter((f) => !baselineFiles.includes(f));
  const missingInRepo = baselineFiles.filter((f) => !monitored.includes(f));
  const hashMismatches = [];
  const scanViolations = [];

  for (const relPath of monitored) {
    const absPath = path.join(root, ...relPath.split("/"));
    const raw = await readFile(absPath, "utf8");
    const digest = sha256Hex(raw);
    const expected = baseline.fileHashes?.[relPath];
    if (expected && expected !== digest) {
      hashMismatches.push({ relPath, expected, actual: digest });
    }
    if (!expected) {
      hashMismatches.push({ relPath, expected: "(missing in baseline)", actual: digest });
    }

    for (const rx of rawForbidden) {
      if (rx.test(raw)) {
        scanViolations.push(`${relPath}: suspicious injection surface (${rx})`);
      }
    }

    const norm = normalizeText(raw);
    if (!allowDeterminismApiIn.has(relPath)) {
      for (const token of normForbiddenTokens) {
        if (norm.includes(token)) {
          scanViolations.push(`${relPath}: anti-determinism/bypass token detected (${token})`);
        }
      }
    }
  }

  const problems = [];
  if (missingInBaseline.length > 0) {
    problems.push(`baseline missing files: ${missingInBaseline.join(", ")}`);
  }
  if (missingInRepo.length > 0) {
    problems.push(`baseline references removed files: ${missingInRepo.join(", ")}`);
  }
  if (hashMismatches.length > 0) {
    problems.push(`hash mismatch in ${hashMismatches.length} files`);
    for (const item of hashMismatches) {
      problems.push(`  - ${item.relPath}`);
    }
  }
  if (scanViolations.length > 0) {
    problems.push(`integrity scan violations in ${scanViolations.length} places`);
    for (const issue of scanViolations) {
      problems.push(`  - ${issue}`);
    }
  }

  if (problems.length > 0) {
    console.error("[TESTLINE_INTEGRITY] BLOCK");
    console.error("[TESTLINE_INTEGRITY] Das eigentliche Problem: Testline ist nicht nachweislich unveraendert/manipulationsfrei.");
    for (const line of problems) {
      console.error(`[TESTLINE_INTEGRITY] ${line}`);
    }
    console.error("[TESTLINE_INTEGRITY] Ruecksprache halten und nur mit begruendetem Update fortfahren.");
    process.exit(1);
  }

  console.log(`[TESTLINE_INTEGRITY] OK (${monitored.length} test scripts verified)`);
}

await main();
