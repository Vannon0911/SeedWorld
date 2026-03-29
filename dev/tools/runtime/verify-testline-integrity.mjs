import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

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

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
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

async function collectMonitoredFiles() {
  const files = [];
  for (const relRoot of monitoredRoots) {
    const absRoot = path.join(root, relRoot);
    const listed = await listFilesRecursive(absRoot);
    for (const abs of listed) {
      files.push(path.relative(root, abs).replace(/\\/g, "/"));
    }
  }
  return files.sort((a, b) => a.localeCompare(b, "en"));
}

async function loadBaseline() {
  const raw = await readFile(baselinePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const baseline = await loadBaseline();
  const monitored = await collectMonitoredFiles();
  const baselineFiles = Array.isArray(baseline.monitoredFiles) ? [...baseline.monitoredFiles].sort((a, b) => a.localeCompare(b, "en")) : [];

  const missingInBaseline = monitored.filter((f) => !baselineFiles.includes(f));
  const missingInRepo = baselineFiles.filter((f) => !monitored.includes(f));
  const hashMismatches = [];
  const scanViolations = [];

  for (const relPath of monitored) {
    const absPath = path.join(root, ...relPath.split("/"));
    const raw = await readFile(absPath, "utf8");
    const digest = sha256(raw);
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
