import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);

export const id = "00-mandatory-kernel-and-preflight";

export async function run({ assert, root }) {
  const preflightPath = path.join(root, "tools/runtime/preflight.mjs");

  const preflight = await execFileAsync("node", [preflightPath], { cwd: root });
  assert(preflight.stdout.includes("[PREFLIGHT] OK"), "Preflight muss OK sein");

  const kernel = await import(pathToFileURL(path.join(root, "src/kernel/interface.js")));
  const guards = await import(pathToFileURL(path.join(root, "src/kernel/runtimeGuards.js")));

  const deterministicInput = {
    domain: "kernelMeta",
    state: { kernelMeta: { revision: 1, note: "baseline" } },
    action: { type: "PATCH_REVIEW", payload: { requestedBy: "test" } },
    actionSchema: { PATCH_REVIEW: { required: ["requestedBy"] } },
    mutationMatrix: { kernelMeta: ["kernelMeta.revision", "kernelMeta.note"] },
    patches: [{ op: "set", path: "kernelMeta.revision", value: 2, domain: "kernelMeta" }]
  };

  const a = await kernel.executeKernelCommand("governance.llm-chain", deterministicInput);
  const b = await kernel.executeKernelCommand("governance.llm-chain", deterministicInput);
  assert(JSON.stringify(a.previewState) === JSON.stringify(b.previewState), "Gleicher Input muss gleichen Output liefern");

  let blockedDateNow = false;
  try {
    await guards.withDeterminismGuards(() => Date.now());
  } catch (error) {
    blockedDateNow = String(error.message).includes("Date.now");
  }
  assert(blockedDateNow, "Date.now muss im Guard blockiert werden");

  let blockedMathRandom = false;
  try {
    await guards.withDeterminismGuards(() => Math.random());
  } catch (error) {
    blockedMathRandom = String(error.message).includes("Math.random");
  }
  assert(blockedMathRandom, "Math.random muss im Guard blockiert werden");

  let blockedPerformanceNow = false;
  try {
    await guards.withDeterminismGuards(() => globalThis.performance.now());
  } catch (error) {
    blockedPerformanceNow = String(error.message).includes("performance.now");
  }
  assert(blockedPerformanceNow, "performance.now muss im Guard blockiert werden");

  let blockedCryptoRandom = false;
  try {
    await guards.withDeterminismGuards(() => globalThis.crypto.getRandomValues(new Uint8Array(4)));
  } catch (error) {
    blockedCryptoRandom = String(error.message).includes("crypto.getRandomValues");
  }
  assert(blockedCryptoRandom, "crypto.getRandomValues muss im Guard blockiert werden");
}
