import path from "node:path";
import { pathToFileURL } from "node:url";

export const id = "00-runtime-governance-suite";
export const seed = "suite-00-runtime-governance-seed";
export const seedSource = "test-vector";
export const authority = {
  kernelPaths: [
    "app/src/kernel/ActionRegistry.js",
    "app/src/kernel/KernelController.js",
    "app/src/kernel/KernelRouter.js"
  ],
  contentPaths: [
    "app/src/game/worldGen.js",
    "app/src/sot/source-of-truth.json"
  ]
};

export async function runEvidence({ root, assert, seed: explicitSeed }) {
  const registryModule = await import(pathToFileURL(path.join(root, "app/src/kernel/ActionRegistry.js")).href);
  const kernelModule = await import(pathToFileURL(path.join(root, "app/src/kernel/KernelController.js")).href);

  const { ActionRegistry } = registryModule;
  const { KernelController } = kernelModule;

  const registry = new ActionRegistry();
  assert.throws(
    () => registry.register({ domain: "game", actionType: "brokenAction", handler: () => ({ ok: true }) }),
    /requiredGate/i
  );

  const kernel = new KernelController({ seed: explicitSeed, governanceMode: "enforce" });
  const initial = await kernel.execute({ domain: "game", action: { type: "createInitialState" } });
  const status = await kernel.execute({ domain: "kernel", action: { type: "status" } });
  const gateMetrics = kernel.kernelGates.getGateStatus("game.action");

  assert.equal(gateMetrics?.metrics.executions, 1);

  await assert.rejects(
    () => kernel.execute({ domain: "game", action: { type: "activateNewFeature" } }),
    (error) => error?.code === "ACTION_NOT_REGISTERED" && typeof error?.auditId === "string"
  );
  await assert.rejects(
    () => kernel.execute({ domain: "ui", action: { type: "render" } }),
    (error) => error?.code === "ACTION_NOT_REGISTERED"
  );

  return {
    seedSignature: initial.result.statistics.seedSignature,
    worldVersion: initial.result.world.meta.version,
    kernelStatus: status.result.status,
    registeredActions: kernel.actionRegistry
      .list()
      .map((entry) => `${entry.domain}.${entry.actionType}`)
      .sort((a, b) => a.localeCompare(b, "en")),
    routerHistory: kernel.router.callHistory.map((entry) => `${entry.to}:${entry.actionType}`),
    gateHistory: kernel.kernelGates.gateHistory.map((entry) => `${entry.gateName}:${entry.decision}`)
  };
}
