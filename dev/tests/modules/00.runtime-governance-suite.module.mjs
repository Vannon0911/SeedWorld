import path from "node:path";
import { pathToFileURL } from "node:url";
import { runScriptTest } from "../helpers/runScriptTest.mjs";

export const id = "00-runtime-governance-suite";

export async function test({ assert, root }) {
  const mkSeed = (...parts) => `suite-${id}-${parts.join("-")}`;

  await runScriptTest({ root, scriptPath: "dev/scripts/smoke-test.mjs", label: id });
  await runScriptTest({ root, scriptPath: "dev/scripts/runtime-guards-test.mjs", label: id });

  const staticHandler = await import(pathToFileURL(path.join(root, "app/server/staticHandler.mjs")).href);
  const { resolveStaticPath } = staticHandler;
  assert.equal(path.basename(resolveStaticPath("/game")), "game.html");
  assert.equal(resolveStaticPath("/patch"), null);
  assert.equal(resolveStaticPath("/src/../package.json"), null);
  assert.equal(resolveStaticPath("/src/app.json"), null);

  const kernelModule = await import(pathToFileURL(path.join(root, "app/src/kernel/KernelController.js")).href);
  const registryModule = await import(pathToFileURL(path.join(root, "app/src/kernel/ActionRegistry.js")).href);
  const { KernelController } = kernelModule;
  const { ActionRegistry } = registryModule;

  const registry = new ActionRegistry();
  assert.throws(
    () => registry.register({ domain: "game", actionType: "brokenAction", handler: () => ({ ok: true }) }),
    /requiredGate/i
  );

  const kernel = new KernelController({ seed: mkSeed("governance"), governanceMode: "enforce" });
  const known = await kernel.execute({ domain: "game", action: { type: "createInitialState" } });
  assert.equal(known.success, true);

  await assert.rejects(
    () => kernel.execute({ domain: "game", action: { type: "activateNewFeature" } }),
    (error) => error?.code === "ACTION_NOT_REGISTERED" && typeof error?.auditId === "string"
  );

  const guardModule = await import(pathToFileURL(path.join(root, "dev/tools/runtime/preflight-mutation-guard.mjs")).href);
  const { buildChallengeBlockMessage, assessHeadDrift, normalizeLock } = guardModule;

  const armedMessage = buildChallengeBlockMessage({
    phase: "armed",
    targetFile: "app/src/game/worldGen.js",
    faultKind: "lake-biome-drift"
  });
  assert.match(armedMessage, /challenge armed/i);

  const escalatedMessage = buildChallengeBlockMessage({
    phase: "unresolved",
    targetFile: "app/src/game/worldGen.js",
    faultKind: "lake-biome-drift",
    pendingFailureCount: 2
  });
  assert.match(escalatedMessage, /Eskalation aktiv/i);

  const staleLock = normalizeLock({
    targetFile: "app/server/patchUtils.js",
    head: "head-old",
    preStateHash: "a",
    postInjectHash: "b",
    faultKind: "lock-validation-freeze"
  });
  const drift = assessHeadDrift(staleLock, "ok: false,", "head-new");
  assert.equal(drift.action, "block");
}

export const run = test;
