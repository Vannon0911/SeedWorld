import path from "node:path";
import { pathToFileURL } from "node:url";

export const id = "06-determinism-and-patch-only-enforcement";

export async function run({ assert, root }) {
  const kernelInterface = await import(pathToFileURL(path.join(root, "src/kernel/interface.js")));
  let runMissing = false;
  try {
    await kernelInterface.executeKernelCommand("run", {});
  } catch (error) {
    runMissing = String(error.message).includes("Unbekanntes command: run");
  }
  assert(runMissing, "run-Command muss im patch-only Kernel deaktiviert sein");

  let seedHashMissing = false;
  try {
    await kernelInterface.executeKernelCommand("seed.hash", { seed: "X" });
  } catch (error) {
    seedHashMissing = String(error.message).includes("Unbekanntes command: seed.hash");
  }
  assert(seedHashMissing, "seed.hash-Command muss im patch-only Kernel deaktiviert sein");

  const plan = await kernelInterface.executeKernelCommand("patch.plan", {
    patched: true,
    patch: {
      patchId: "patch-only-06-risk",
      target: "kernel",
      operations: [{ op: "addFunction", name: "bridgeToKernel", linksTo: ["executeKernelCommand"] }]
    }
  });
  assert(plan.status === "needs_confirmation", "Riskante Links muessen weiterhin bestaetigt werden");
}
