import { mkdir } from "node:fs/promises";
import path from "node:path";
import { readJson, writeJson } from "./docs-v2-shared.mjs";
import { compareAlpha, listFilesRecursive, toPosixPath } from "./runtime-shared.mjs";

const root = process.cwd();
const evidenceRel = "runtime/evidence/governance-coverage.json";
const evidenceSchemaVersion = 2;

const scanRoots = Object.freeze([
  "app/src/kernel",
  "app/src/game",
  "dev/tools/runtime",
  "dev/scripts",
  "dev/tests/modules",
  ".githooks",
  ".github/workflows",
  ".github/rulesets"
]);

const rootFiles = Object.freeze(["package.json", "VERSION", "README.md"]);

function matchesPrefix(relPath, prefix) {
  if (prefix.endsWith("/")) {
    return relPath.startsWith(prefix);
  }
  return relPath === prefix || relPath.startsWith(`${prefix}/`);
}

function classify(relPath, owners) {
  const hits = [];
  for (const owner of owners) {
    for (const prefix of owner.prefixes || []) {
      if (matchesPrefix(relPath, prefix)) {
        hits.push({
          owner: owner.name,
          prefix,
          score: prefix.length
        });
      }
    }
  }
  if (hits.length === 0) {
    return null;
  }
  hits.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const ownerCmp = a.owner.localeCompare(b.owner, "en");
    if (ownerCmp !== 0) {
      return ownerCmp;
    }
    return a.prefix.localeCompare(b.prefix, "en");
  });
  const topScore = hits[0].score;
  const topHits = hits.filter((item) => item.score === topScore);
  const selected = topHits[0];
  return {
    owner: selected.owner,
    matched_prefix: selected.prefix,
    ambiguous_with: topHits.slice(1).map((item) => ({ owner: item.owner, prefix: item.prefix }))
  };
}

async function main() {
  const boundaries = await readJson(path.join(root, "app", "src", "sot", "repo-boundaries.json"));
  const owners = boundaries.owners || [];
  const files = [];

  for (const relRoot of scanRoots) {
    const absRoot = path.join(root, relRoot);
    let absFiles;
    try {
      absFiles = await listFilesRecursive(absRoot);
    } catch (error) {
      const code = String(error?.code || "");
      if (code === "ENOENT") {
        throw new Error(`[GOVERNANCE_COVERAGE] missing mandatory scan root: ${relRoot}`);
      }
      throw new Error(`[GOVERNANCE_COVERAGE] cannot read scan root '${relRoot}': ${String(error?.message || error)}`);
    }
    for (const absFile of absFiles) {
      files.push(toPosixPath(path.relative(root, absFile)));
    }
  }

  for (const relPath of rootFiles) {
    files.push(toPosixPath(relPath));
  }

  const uniqueFiles = [...new Set(files)].sort(compareAlpha);
  const classified = [];
  const unclassified = [];
  const ambiguous = [];

  for (const relPath of uniqueFiles) {
    const classification = classify(relPath, owners);
    if (!classification) {
      unclassified.push(relPath);
      continue;
    }
    if ((classification.ambiguous_with || []).length > 0) {
      ambiguous.push({
        path: relPath,
        resolved_owner: classification.owner,
        resolved_prefix: classification.matched_prefix,
        alternatives: classification.ambiguous_with
      });
    }
    classified.push({
      path: relPath,
      owner: classification.owner,
      matched_prefix: classification.matched_prefix
    });
  }

  const ownerSummary = owners
    .map((owner) => ({
      owner: owner.name,
      count: classified.filter((item) => item.owner === owner.name).length
    }))
    .filter((entry) => entry.count > 0);

  const evidencePath = path.join(root, evidenceRel);
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeJson(evidencePath, {
    schema_version: evidenceSchemaVersion,
    generated_at: new Date().toISOString(),
    scanned_count: uniqueFiles.length,
    scanned_files: uniqueFiles.length,
    classified_count: classified.length,
    classified_items: classified,
    owner_summary: ownerSummary,
    ambiguous_files: ambiguous,
    unclassified_files: unclassified
  });

  if (ambiguous.length > 0) {
    console.error("[GOVERNANCE_COVERAGE] BLOCK: ambiguous ownership matches in governance scope");
    for (const item of ambiguous) {
      const alternatives = item.alternatives.map((alt) => `${alt.owner}:${alt.prefix}`).join(", ");
      console.error(` - ${item.path} -> resolved=${item.resolved_owner}:${item.resolved_prefix} alternatives=${alternatives}`);
    }
    process.exit(1);
  }

  if (unclassified.length > 0) {
    console.error("[GOVERNANCE_COVERAGE] BLOCK: unclassified files in governance scope");
    for (const relPath of unclassified) {
      console.error(` - ${relPath}`);
    }
    process.exit(1);
  }

  console.log(`[GOVERNANCE_COVERAGE] OK scanned=${uniqueFiles.length} classified=${classified.length}`);
}

await main();
