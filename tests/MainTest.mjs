import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { assertDeadmanIntact, createDeadmanSnapshot } from "../tools/runtime/deadmanGuard.mjs";

const root = process.cwd();
const modulesDir = path.join(root, "tests/modules");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadModule(filePath) {
  const mod = await import(pathToFileURL(filePath));
  assert(typeof mod.run === "function", `Testmodul ohne run(): ${filePath}`);
  return {
    id: mod.id || path.basename(filePath),
    run: mod.run,
    filePath
  };
}

async function loadModules() {
  const files = (await readdir(modulesDir))
    .filter((name) => name.endsWith(".module.mjs"))
    .sort();

  const mandatory = "00.mandatory.module.mjs";
  assert(files.includes(mandatory), `Pflichtmodul fehlt: ${mandatory}`);

  const ordered = [mandatory, ...files.filter((name) => name !== mandatory)];
  const modules = [];

  for (const file of ordered) {
    modules.push(await loadModule(path.join(modulesDir, file)));
  }

  return modules;
}

async function run() {
  const modules = await loadModules();
  const deadmanSnapshot = await createDeadmanSnapshot(root);
  let passed = 0;

  for (const testModule of modules) {
    await assertDeadmanIntact(root, deadmanSnapshot, `before:${testModule.id}`);
    const start = Date.now();
    await testModule.run({ assert, root });
    await assertDeadmanIntact(root, deadmanSnapshot, `after:${testModule.id}`);
    const duration = Date.now() - start;
    passed += 1;
    console.log(`[MAIN_TEST][PASS] ${testModule.id} (${duration}ms)`);
  }

  console.log(`[MAIN_TEST] abgeschlossen: ${passed}/${modules.length} Module PASS`);
}

run().catch((error) => {
  console.error(`[MAIN_TEST][FAIL] ${error.message}`);
  process.exit(1);
});
