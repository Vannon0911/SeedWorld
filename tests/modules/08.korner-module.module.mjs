import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const id = "08-korner-module-and-string-matrix";

export async function run({ assert, root }) {
  const kernel = await import(pathToFileURL(path.join(root, "src/kernel/interface.js")));

  const manifest = await kernel.executeKernelCommand("korner.manifest", {});
  assert(manifest.moduleId === "seedworld.korner.v1", "Korner-Manifest muss geladen werden");
  assert(Array.isArray(manifest.areas.governance), "Korner-Manifest Governance fehlt");

  const matrixResult = await kernel.executeKernelCommand("korner.string-matrix", {});
  assert(Array.isArray(matrixResult.matrix), "String-Matrix muss als Matrix vorliegen");
  assert(matrixResult.matrix.length > 1, "String-Matrix darf nicht leer sein");

  const snapshot = await kernel.executeKernelCommand("korner.snapshot", {});
  assert(snapshot.manifest.moduleId === "seedworld.korner.v1", "Snapshot Manifest ungueltig");
  assert(Array.isArray(snapshot.stringMatrix), "Snapshot Matrix ungueltig");

  const docMatrix = JSON.parse(await readFile(path.join(root, "docs/STRING_MATRIX.json"), "utf8"));
  assert(JSON.stringify(docMatrix.matrix) === JSON.stringify(matrixResult.matrix), "Doku-String-Matrix muss Kernel-Matrix entsprechen");
}
