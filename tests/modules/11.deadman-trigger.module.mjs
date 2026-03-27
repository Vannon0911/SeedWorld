import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertDeadmanIntact, createDeadmanSnapshot } from "../../tools/runtime/deadmanGuard.mjs";

export const id = "11-deadman-trigger";

export async function run({ assert, root }) {
  const traceabilityPath = path.join(root, "docs/TRACEABILITY.json");
  const original = await readFile(traceabilityPath, "utf8");
  const snapshot = await createDeadmanSnapshot(root);

  const mutated = original.replace('"PREFLIGHT-DOC-SYNC"', '"PREFLIGHT-DOC-SYNC-X"');
  assert(mutated !== original, "Deadman-Test konnte TRACEABILITY nicht mutieren");

  await writeFile(traceabilityPath, mutated, "utf8");
  try {
    let triggered = false;
    try {
      await assertDeadmanIntact(root, snapshot, "deadman-selftest");
    } catch (error) {
      triggered = String(error.message).includes("[DEADMAN_TRIGGER]");
    }

    assert(triggered, "Deadman Trigger muss Gate-Manipulation erkennen");
  } finally {
    await writeFile(traceabilityPath, original, "utf8");
  }
}
