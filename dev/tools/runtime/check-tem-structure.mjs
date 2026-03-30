import { readFile } from "node:fs/promises";
import path from "node:path";
import { compareAlpha, listFilesRecursive, toPosixPath } from "./runtime-shared.mjs";

const root = process.cwd();
const temRoot = path.join(root, "tem");
const requiredRootFiles = ["TODO.md", "WORKFLOW.md", "SCHEMA.json"];
const forbiddenNamePatterns = [
  /\.(todo|konflikte|check)\.md$/i,
  /^_TODO\.md$/i,
  /^_KONFLIKTE\.md$/i,
  /^_CHECK\.md$/i,
  /^THEMA_3_LISTEN\.md$/i,
  /^INDEX_SORTIERT\.md$/i,
  /^WORKBOARD\.md$/i,
  /^TODO_TMP_SUMMARY\.md$/i
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[TEM_GUARD] ${message}`);
  }
}

function isTrackedFile(file) {
  const lower = file.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".json");
}

async function main() {
  const allFiles = await listFilesRecursive(temRoot);
  const trackedFiles = allFiles.filter((abs) => isTrackedFile(abs));
  const relTracked = trackedFiles.map((abs) => toPosixPath(path.relative(root, abs))).sort(compareAlpha);

  for (const rel of relTracked) {
    const name = path.basename(rel);
    for (const pattern of forbiddenNamePatterns) {
      assert(!pattern.test(name), `forbidden tem artifact detected: ${rel}`);
    }
  }

  for (const fileName of requiredRootFiles) {
    const rel = `tem/${fileName}`;
    assert(relTracked.includes(rel), `missing required file: ${rel}`);
  }

  const todoPath = path.join(temRoot, "TODO.md");
  const workflowPath = path.join(temRoot, "WORKFLOW.md");
  const schemaPath = path.join(temRoot, "SCHEMA.json");
  const todoText = await readFile(todoPath, "utf8");
  const workflowText = await readFile(workflowPath, "utf8");
  const schemaText = await readFile(schemaPath, "utf8");

  for (const heading of ["## Prioritaet", "## Artefaktpflege Nach Kategorie"]) {
    assert(todoText.includes(heading), `TODO.md missing section: ${heading}`);
  }

  for (const heading of ["## Sequenz", "## Guardrails", "## Betriebsregel"]) {
    assert(workflowText.includes(heading), `WORKFLOW.md missing section: ${heading}`);
  }

  let parsedSchema = null;
  try {
    parsedSchema = JSON.parse(schemaText);
  } catch {
    throw new Error("[TEM_GUARD] SCHEMA.json is not valid JSON");
  }
  assert(typeof parsedSchema?.schemaVersion === "string", "SCHEMA.json missing schemaVersion");
  assert(Array.isArray(parsedSchema?.artifacts), "SCHEMA.json missing artifacts[]");

  console.log(`[TEM_GUARD] OK files=${relTracked.length}`);
}

try {
  await main();
} catch (error) {
  console.error(String(error?.message || error));
  process.exit(1);
}
