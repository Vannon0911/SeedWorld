import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { listFilesRecursive, toPosixPath } from "./runtime-shared.mjs";

const root = process.cwd();
const hygieneMapPath = path.join(root, "app", "src", "sot", "REPO_HYGIENE_MAP.json");
const outputPath = path.join(root, "tem", "testline-missing-systems.md");
const writeMode = process.argv.includes("--write");

const testEntrypoints = [
  "dev/tests/MainTest.mjs",
  "dev/scripts/smoke-test.mjs",
  "dev/scripts/runtime-guards-test.mjs",
  "dev/scripts/test-runner.mjs",
  "dev/scripts/playwright-tiles-full.mjs",
  "dev/scripts/verify-evidence.mjs",
  "dev/scripts/build-evidence-bundle.mjs"
];

function compareAlpha(a, b) {
  return String(a || "").localeCompare(String(b || ""), "en");
}

function isSystemFile(file) {
  return file.startsWith("app/src/") || file.startsWith("app/server/");
}

function isCode(file) {
  return /\.(js|mjs|cjs)$/.test(file);
}

function isTestInfrastructure(file) {
  return file.startsWith("dev/tests/") || file.startsWith("dev/scripts/");
}

function extractSystemRefsFromText(text) {
  const refs = new Set();
  const rx = /["'`](app\/(?:src|server)\/[^"'`]+?\.(?:js|mjs|cjs))["'`]/g;
  let m = null;
  while ((m = rx.exec(text)) !== null) {
    refs.add(m[1]);
  }
  return refs;
}

async function collectExplicitSystemRefs() {
  const roots = ["dev/tests/modules", "dev/scripts"];
  const refs = new Set();
  for (const relRoot of roots) {
    const absRoot = path.join(root, relRoot);
    let files = [];
    try {
      files = await listFilesRecursive(absRoot, {
        filterFile: (_abs, entry) => /\.(js|mjs|cjs)$/.test(entry.name)
      });
    } catch {
      files = [];
    }
    for (const absFile of files) {
      const rel = toPosixPath(path.relative(root, absFile));
      const raw = await readFile(absFile, "utf8");
      for (const ref of extractSystemRefsFromText(raw)) {
        refs.add(ref);
      }
      if (rel === "dev/scripts/smoke-test.mjs") {
        refs.add("app/server/appServer.mjs");
      }
    }
  }
  return refs;
}

function collectReachable(graph, starts) {
  const seen = new Set();
  const stack = [...starts];
  while (stack.length > 0) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of graph.get(current) || []) {
      if (!seen.has(next)) {
        stack.push(next);
      }
    }
  }
  return seen;
}

function renderReport({ testedSystems, untestedSystems, totalSystemFiles }) {
  const lines = [
    "# Testline Missing Systems Report",
    "",
    "Automatisch erzeugt aus `app/src/sot/REPO_HYGIENE_MAP.json`.",
    "",
    "## Summary",
    `- System-Codefiles gesamt: ${totalSystemFiles}`,
    `- Direkt/indirekt durch Testline erreichbar: ${testedSystems.length}`,
    `- Ohne Testline-Bezug: ${untestedSystems.length}`,
    ""
  ];

  lines.push("## Untested Systems");
  if (untestedSystems.length === 0) {
    lines.push("- none");
  } else {
    for (const item of untestedSystems) {
      lines.push(`- ${item}`);
    }
  }
  lines.push("");

  lines.push("## Tested Systems");
  if (testedSystems.length === 0) {
    lines.push("- none");
  } else {
    for (const item of testedSystems) {
      lines.push(`- ${item}`);
    }
  }
  lines.push("");

  lines.push("## Rule");
  lines.push("- Zielzustand: `Untested Systems = 0` oder begruendete Ausnahme in `tem/slices/` dokumentiert.");
  lines.push("");

  return `${lines.join("\n")}`;
}

function normalizeEol(text) {
  return String(text || "").replace(/\r\n/g, "\n");
}

async function main() {
  const parsed = JSON.parse(await readFile(hygieneMapPath, "utf8"));
  const importsObj = parsed?.imports || {};
  const allFiles = Object.keys(importsObj).sort(compareAlpha);
  const graph = new Map();
  for (const file of allFiles) {
    const deps = Array.isArray(importsObj[file]) ? [...importsObj[file]].sort(compareAlpha) : [];
    graph.set(file, deps);
  }

  const starts = testEntrypoints.filter((x) => graph.has(x));
  const reachable = collectReachable(graph, starts);
  const explicitRefs = await collectExplicitSystemRefs();
  const systemFiles = allFiles.filter((f) => isCode(f) && isSystemFile(f)).sort(compareAlpha);

  const testedSystems = systemFiles.filter((f) => reachable.has(f) || explicitRefs.has(f)).sort(compareAlpha);
  const untestedSystems = systemFiles.filter((f) => !reachable.has(f) && !explicitRefs.has(f)).sort(compareAlpha);

  const report = renderReport({
    testedSystems,
    untestedSystems,
    totalSystemFiles: systemFiles.length
  });

  if (writeMode) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, report, "utf8");
  } else {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (normalizeEol(current) !== normalizeEol(report)) {
      throw new Error("[TESTLINE_COVERAGE] Drift detected. Run: npm run testline:coverage:update");
    }
  }

  const untestedNonInfra = untestedSystems.filter((f) => !isTestInfrastructure(f));
  if (untestedNonInfra.length > 0) {
    console.warn(`[TESTLINE_COVERAGE] WARN untested_systems=${untestedNonInfra.length}`);
  }
  console.log(
    `[TESTLINE_COVERAGE] ${writeMode ? "UPDATED" : "VERIFIED"} tested=${testedSystems.length} untested=${untestedSystems.length}`
  );
}

try {
  await main();
} catch (error) {
  console.error(String(error?.message || error));
  process.exit(1);
}
