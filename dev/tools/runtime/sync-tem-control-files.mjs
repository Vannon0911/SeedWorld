import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compareAlpha, listFilesRecursive, sha256Hex, toPosixPath } from "./runtime-shared.mjs";

const root = process.cwd();
const temRoot = path.join(root, "tem");
const controlFiles = new Set(["TODO.md", "WORKFLOW.md", "SCHEMA.json"]);
const writeMode = process.argv.includes("--write");

function classify(relPath) {
  if (relPath.startsWith("tem/slices/")) return "implementierungs-slices";
  if (relPath.startsWith("tem/rebuttals/")) return "rebuttals";
  if (relPath.startsWith("tem/check-justification/")) return "check-justification";
  if (/tem\/(beide-plaene|cf-001-architektur-notiz|t01-legacy-wrapper-inventur)\.md$/.test(relPath)) return "planung";
  if (/tem\/(reported-bugs|langfristiger-bug-plan|nitpick-check-report|repair-check-cf002|sot-doc-validity-report|test-evidence-report|traceability-map)\.md$/.test(relPath)) return "reports-findings";
  if (/tem\/(gpg-signing-runbook|md-worklog)\.md$/.test(relPath)) return "operativ";
  return "sonstiges";
}

function renderTodo(categoryMap, allArtifacts) {
  const lines = [
    "# TEM TODO",
    "",
    "Diese Datei wird automatisch aus `tem/` erzeugt. Keine manuelle Pflege.",
    "",
    "## Prioritaet",
    "- [ ] CF-001 und CF-002 final auf CHECK bringen (evidenzbasiert).",
    "- [ ] T01 und T02 final auf CHECK bringen (evidenzbasiert).",
    "- [ ] CF-003+ und T04+ in kleinen Slices mit Gegenpruefung weiterziehen.",
    "- [ ] evidence:bundle strict stabil bei >=10 halten.",
    "",
    "## Artefaktpflege Nach Kategorie"
  ];

  for (const category of Object.keys(categoryMap).sort(compareAlpha)) {
    lines.push(`### ${category}`);
    for (const rel of categoryMap[category].sort(compareAlpha)) {
      lines.push(`- [ ] ${rel}`);
    }
    lines.push("");
  }

  lines.push("## Umfang");
  lines.push(`- Gesamtartefakte: ${allArtifacts.length}`);
  return `${lines.join("\n")}\n`;
}

function renderWorkflow() {
  const lines = [
    "# TEM WORKFLOW",
    "",
    "Diese Datei wird automatisch gepflegt und definiert den verbindlichen Ablauf.",
    "TEM ist die einzige aktuelle TODO-Betriebsflaeche fuer operative Plan-/Statusarbeit.",
    "",
    "## Sequenz",
    "1. Implementierung eines klar abgegrenzten Slices.",
    "2. Technische Validierung (`npm test`, bei Bedarf weitere Gates).",
    "3. Befund-/Risiko-Pruefung gegen bestehende Reports/Rebuttals.",
    "4. Dokumente in `tem/` aktualisieren, dann `npm run tem:sync`.",
    "5. `npm run tem:verify` muss sauber durchlaufen.",
    "",
    "## Guardrails",
    "- Keine Sidecar-Dateien (`*.todo.md`, `*.konflikte.md`, `*.check.md`, `_TODO.md`, `_KONFLIKTE.md`, `_CHECK.md`).",
    "- Nur diese 3 Steuerdateien sind kanonisch: `tem/TODO.md`, `tem/WORKFLOW.md`, `tem/SCHEMA.json`.",
    "- Drift der 3 Steuerdateien blockt `check:required`.",
    "- Globale Dateiredundanz (hash-identischer Inhalt in den gescannten Roots) muss 0 sein.",
    "",
    "## Betriebsregel",
    "- Nach jeder inhaltlichen Aenderung unter `tem/`: zuerst `npm run tem:sync`, danach `npm run tem:verify`.",
    "- Vor Merge: `npm run check:required` muss ohne Drift laufen."
  ];
  return `${lines.join("\n")}\n`;
}

function renderSchema(records) {
  const digestSeed = records.map((r) => `${r.path}:${r.sha256}`).join("|");
  const snapshotId = sha256Hex(digestSeed);
  const grouped = {};
  for (const row of records) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row.path);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort(compareAlpha);
  }

  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      snapshotId,
      controlFiles: [...controlFiles],
      artifactCount: records.length,
      categories: grouped,
      artifacts: records.map((r) => ({ path: r.path, category: r.category, sha256: r.sha256 }))
    },
    null,
    2
  )}\n`;
}

async function loadArtifacts() {
  const absFiles = await listFilesRecursive(temRoot);
  const records = [];
  for (const abs of absFiles) {
    const rel = toPosixPath(path.relative(root, abs));
    const base = path.basename(abs);
    if (rel.startsWith("tem/") === false) continue;
    if (controlFiles.has(base)) continue;
    if (!rel.toLowerCase().endsWith(".md")) continue;
    const content = await readFile(abs, "utf8");
    records.push({
      path: rel,
      category: classify(rel),
      sha256: sha256Hex(content)
    });
  }
  records.sort((a, b) => compareAlpha(a.path, b.path));
  return records;
}

async function syncOrVerifyFile(absPath, expected) {
  let current = "";
  try {
    current = await readFile(absPath, "utf8");
  } catch {
    current = "";
  }

  if (writeMode) {
    await writeFile(absPath, expected, "utf8");
    return;
  }

  if (current !== expected) {
    throw new Error(`[TEM_SYNC] Drift detected for ${toPosixPath(path.relative(root, absPath))}. Run: npm run tem:sync`);
  }
}

async function main() {
  const records = await loadArtifacts();
  const categoryMap = {};
  for (const rec of records) {
    if (!categoryMap[rec.category]) categoryMap[rec.category] = [];
    categoryMap[rec.category].push(rec.path);
  }

  const todo = renderTodo(categoryMap, records);
  const workflow = renderWorkflow();
  const schema = renderSchema(records);

  await syncOrVerifyFile(path.join(temRoot, "TODO.md"), todo);
  await syncOrVerifyFile(path.join(temRoot, "WORKFLOW.md"), workflow);
  await syncOrVerifyFile(path.join(temRoot, "SCHEMA.json"), schema);

  console.log(`[TEM_SYNC] ${writeMode ? "WRITTEN" : "VERIFIED"} artifacts=${records.length}`);
}

try {
  await main();
} catch (error) {
  console.error(String(error?.message || error));
  process.exit(1);
}
