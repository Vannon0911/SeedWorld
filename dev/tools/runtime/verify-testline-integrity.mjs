import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  REQUIRED_TEST_IDS,
  finalSummaryPath,
  summaryPath,
  validatePairEvidence,
  validateRunEvidence,
  validateSummaryEvidence
} from "../../scripts/evidence-shared.mjs";
import { buildTestlineHashes, collectTestlineFiles } from "./testline-integrity-shared.mjs";

async function readJson(absPath) {
  return JSON.parse(await readFile(absPath, "utf8"));
}

async function newestMtime(root, relPaths = []) {
  let newest = 0;
  for (const relPath of relPaths) {
    const info = await stat(path.join(root, relPath));
    newest = Math.max(newest, info.mtimeMs);
  }
  return newest;
}

async function main() {
  const root = process.cwd();
  const baseline = await readJson(path.join(root, "app", "src", "sot", "testline-integrity.json"));
  const actualMonitoredFiles = await collectTestlineFiles(root);
  const actualHashes = await buildTestlineHashes(root, actualMonitoredFiles);

  const baselineRequired = [...(baseline.requiredTests || [])].sort((a, b) => a.localeCompare(b, "en"));
  const runtimeRequired = [...REQUIRED_TEST_IDS].sort((a, b) => a.localeCompare(b, "en"));
  if (JSON.stringify(baselineRequired) !== JSON.stringify(runtimeRequired)) {
    throw new Error("testline baseline drift: requiredTests mismatch. Run node dev/tools/runtime/update-testline-integrity.mjs");
  }

  const baselineFiles = [...(baseline.monitoredFiles || [])].sort((a, b) => a.localeCompare(b, "en"));
  const actualFiles = [...actualMonitoredFiles].sort((a, b) => a.localeCompare(b, "en"));
  if (JSON.stringify(baselineFiles) !== JSON.stringify(actualFiles)) {
    throw new Error("testline baseline drift: monitoredFiles mismatch. Run node dev/tools/runtime/update-testline-integrity.mjs");
  }

  for (const relPath of actualFiles) {
    const expectedHash = String((baseline.fileHashes || {})[relPath] || "");
    const actualHash = String(actualHashes[relPath] || "");
    if (!expectedHash || expectedHash !== actualHash) {
      throw new Error(`testline baseline drift: hash mismatch (${relPath}). Run node dev/tools/runtime/update-testline-integrity.mjs`);
    }
  }

  const summary = await readJson(summaryPath(root));
  validateSummaryEvidence(summary);

  const summaryIds = summary.tests.map((entry) => entry.test_id).sort((a, b) => a.localeCompare(b, "en"));
  const requiredIds = [...REQUIRED_TEST_IDS].sort((a, b) => a.localeCompare(b, "en"));
  if (JSON.stringify(summaryIds) !== JSON.stringify(requiredIds)) {
    throw new Error(`required testline mismatch: expected ${requiredIds.join(", ")} got ${summaryIds.join(", ")}`);
  }

  for (const entry of summary.tests) {
    const runAPath = path.join(root, entry.run_a_ref);
    const runBPath = path.join(root, entry.run_b_ref);
    const pairPath = path.join(root, entry.pair_ref);
    const runA = await readJson(runAPath);
    const runB = await readJson(runBPath);
    const pair = await readJson(pairPath);

    validateRunEvidence(runA);
    validateRunEvidence(runB);
    validatePairEvidence(pair);

    if (pair.comparator_result !== "PASS_REPRODUCED") {
      throw new Error(`pair failed reproduction: ${entry.test_id} -> ${pair.comparator_result}`);
    }
    if (runA.seed !== runB.seed || runA.seed_source !== runB.seed_source) {
      throw new Error(`seed proof mismatch in ${entry.test_id}`);
    }

    const evidenceNewest = await newestMtime(root, [entry.run_a_ref, entry.run_b_ref, entry.pair_ref]);
    const sourceNewest = await newestMtime(root, [
      ...runA.kernel_revision.files.map((item) => item.path),
      ...runA.content_revision.files.map((item) => item.path)
    ]);
    if (sourceNewest > evidenceNewest) {
      throw new Error(`stale evidence detected for ${entry.test_id}`);
    }
  }

  const finalSummary = {
    generated_at: new Date().toISOString(),
    required_tests: REQUIRED_TEST_IDS,
    checked_pairs: summary.tests.length,
    overall_status: "PASS_REPRODUCED"
  };
  await writeFile(finalSummaryPath(root), `${JSON.stringify(finalSummary, null, 2)}\n`, "utf8");
  console.log(`[TESTLINE] PASS_REPRODUCED (${summary.tests.length} pairs)`);
}

await main();
