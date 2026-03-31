import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { compareAlpha } from "./runtime-shared.mjs";

const root = process.cwd();

function isWithin(relPath, prefixes = []) {
  return prefixes.some((prefix) => relPath === prefix || relPath.startsWith(prefix));
}

function toSortedSet(values = []) {
  return new Set(values.map((value) => String(value || "").trim()).filter(Boolean).sort(compareAlpha));
}

async function readJson(relPath) {
  return JSON.parse(await readFile(path.join(root, relPath), "utf8"));
}

async function runNodeScript(scriptPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: root,
      stdio: "inherit"
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${scriptPath} failed with exit code ${code}`));
    });
  });
}

function collectUnexpected(items, allowed, authoritativeRoots) {
  return items
    .filter((item) => isWithin(item, authoritativeRoots) && !allowed.has(item))
    .sort(compareAlpha);
}

function collectSuspiciousDuplicates(groups = [], authoritativeRoots, allowlist) {
  const blocked = [];
  for (const group of groups) {
    const authoritativeFiles = (group.files || []).filter((file) => isWithin(file, authoritativeRoots)).sort(compareAlpha);
    if (authoritativeFiles.length < 2) {
      continue;
    }
    const unresolved = [];
    for (let i = 0; i < authoritativeFiles.length; i += 1) {
      for (let j = i + 1; j < authoritativeFiles.length; j += 1) {
        const key = [authoritativeFiles[i], authoritativeFiles[j]].sort(compareAlpha).join("||");
        if (!allowlist.has(key)) {
          unresolved.push([authoritativeFiles[i], authoritativeFiles[j]]);
        }
      }
    }
    if (unresolved.length > 0) {
      blocked.push({
        files: authoritativeFiles,
        unresolved
      });
    }
  }
  return blocked;
}

function assertNoFindings(findings, label) {
  if (findings.length === 0) {
    return;
  }
  const message = findings
    .map((entry) => (Array.isArray(entry) ? entry.join(", ") : typeof entry === "string" ? entry : entry.files.join(", ")))
    .join(" | ");
  throw new Error(`[REPO_HYGIENE] ${label}: ${message}`);
}

async function main() {
  await runNodeScript("dev/tools/runtime/repo-hygiene-map.mjs");
  await runNodeScript("dev/tools/runtime/check-global-redundancy.mjs");
  await runNodeScript("dev/tools/runtime/sync-string-matrix.mjs");

  const boundaries = await readJson("app/src/sot/repo-boundaries.json");
  const hygieneMap = await readJson("app/src/sot/REPO_HYGIENE_MAP.json");
  const redundancy = await readJson("runtime/evidence/redundancy-report.json").catch(() => ({ duplicates: [] }));

  const authoritativeRoots = (boundaries.pathClasses?.authoritative || []).slice().sort(compareAlpha);
  const policy = boundaries.hygienePolicy || {};
  const authoritativeEntrypoints = toSortedSet(policy.authoritativeEntrypoints);
  const allowedUnreachable = toSortedSet(policy.allowedUnreachableFiles);
  const allowedZeroInbound = toSortedSet(policy.allowedZeroInboundFiles);
  const duplicateAllowlist = toSortedSet(
    (policy.allowedDuplicatePairs || []).map((pair) => [pair[0], pair[1]].sort(compareAlpha).join("||"))
  );

  const unexpectedUnowned = collectUnexpected(hygieneMap.unownedFiles || [], new Set(), authoritativeRoots);
  const strandedAuthoritative = (hygieneMap.unreachableCode || []).filter((item) =>
    (hygieneMap.zeroInboundNonEntrypoints || []).includes(item) && !authoritativeEntrypoints.has(item)
  );
  const unexpectedUnreachable = collectUnexpected(strandedAuthoritative, allowedUnreachable, authoritativeRoots);
  const unexpectedZeroInbound = collectUnexpected(
    (hygieneMap.zeroInboundNonEntrypoints || []).filter((item) => !authoritativeEntrypoints.has(item)),
    allowedZeroInbound,
    authoritativeRoots
  );
  const suspiciousDuplicates = collectSuspiciousDuplicates(redundancy.duplicates || [], authoritativeRoots, duplicateAllowlist);

  assertNoFindings(unexpectedUnowned, "unowned authoritative files");
  assertNoFindings(unexpectedUnreachable, "unexpected unreachable authoritative files");
  assertNoFindings(unexpectedZeroInbound, "unexpected zero-inbound authoritative files");
  assertNoFindings(suspiciousDuplicates, "duplicate authoritative content");

  console.log(
    `[REPO_HYGIENE] OK authoritativeRoots=${authoritativeRoots.length} allowUnreachable=${allowedUnreachable.size} allowZeroInbound=${allowedZeroInbound.size}`
  );
}

try {
  await main();
} catch (error) {
  console.error(String(error?.message || error));
  process.exit(1);
}
