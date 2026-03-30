import path from "node:path";
import { pathToFileURL } from "node:url";

function expectedSeedSignature(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function checkpointHashes(states, createMutFingerprint) {
  return Promise.all(
    states.map((state) =>
      createMutFingerprint({
        tick: state.tick,
        resources: state.resources,
        statistics: state.statistics
      })
    )
  );
}

function firstDriftIndex(a, b) {
  const max = Math.min(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : max;
}

export const id = "10-determinism-seed-proof-suite";

export async function test({ assert, root }) {
  const mkSeed = (...parts) => `suite-${id}-${parts.join("-")}`;
  const worldGen = await import(pathToFileURL(path.join(root, "app/src/game/worldGen.js")).href);
  const kernelModule = await import(pathToFileURL(path.join(root, "app/src/kernel/KernelController.js")).href);
  const deterministicKernel = await import(pathToFileURL(path.join(root, "app/src/kernel/deterministicKernel.js")).href);
  const fingerprint = await import(pathToFileURL(path.join(root, "app/src/kernel/fingerprint.js")).href);

  const { KernelController } = kernelModule;
  const { runDeterministicKernel } = deterministicKernel;
  const { createMutFingerprint, sha256Hex } = fingerprint;

  const worldScenarios = [
    { width: 16, height: 12 },
    { width: 9, height: 9 },
    { width: 6, height: 4 }
  ];
  for (let i = 0; i < worldScenarios.length; i += 1) {
    const scenario = worldScenarios[i];
    const seedA = mkSeed("world", i, "a", `${scenario.width}x${scenario.height}`);
    const seedB = mkSeed("world", i, "b", `${scenario.width}x${scenario.height}`);
    const a1 = worldGen.generateWorld({ seed: seedA, width: scenario.width, height: scenario.height });
    const a2 = worldGen.generateWorld({ seed: seedA, width: scenario.width, height: scenario.height });
    const b = worldGen.generateWorld({ seed: seedB, width: scenario.width, height: scenario.height });
    assert.equal(JSON.stringify(a1), JSON.stringify(a2), `world deterministic failed for seed=${seedA}`);
    assert.notEqual(JSON.stringify(a1), JSON.stringify(b), `world drift missing for seed=${seedA}/${seedB}`);
    worldGen.validateWorldShape(a1);
  }

  const replayScenarios = [
    { ticks: 30 },
    { ticks: 24 },
    { ticks: 18 }
  ];
  for (let i = 0; i < replayScenarios.length; i += 1) {
    const scenario = replayScenarios[i];
    const seed = mkSeed("replay", i, scenario.ticks);
    const expectedHash = await sha256Hex(seed);
    const r1 = await runDeterministicKernel(seed, scenario.ticks, { expectedSeedHash: expectedHash });
    const r2 = await runDeterministicKernel(seed, scenario.ticks, { expectedSeedHash: expectedHash });
    assert.equal(r1.seedHash, r2.seedHash);
    assert.equal(r1.mutFingerprint, r2.mutFingerprint);

    const h1 = await checkpointHashes(r1.states, createMutFingerprint);
    const h2 = await checkpointHashes(r2.states, createMutFingerprint);
    assert.deepEqual(h1, h2, `checkpoint mismatch for seed=${seed}`);
  }

  const driftSeedA = mkSeed("drift", "a");
  const driftSeedB = mkSeed("drift", "b");
  const driftA = await runDeterministicKernel(driftSeedA, 22, { expectedSeedHash: await sha256Hex(driftSeedA) });
  const driftB = await runDeterministicKernel(driftSeedB, 22, { expectedSeedHash: await sha256Hex(driftSeedB) });
  const driftHashesA = await checkpointHashes(driftA.states, createMutFingerprint);
  const driftHashesB = await checkpointHashes(driftB.states, createMutFingerprint);
  const drift = firstDriftIndex(driftHashesA, driftHashesB);
  assert.notEqual(drift, -1, "different seeds must drift on checkpoint series");

  const sameActionKernel = new KernelController({ seed: mkSeed("same-action") });
  const init = await sameActionKernel.execute({ domain: "game", action: { type: "createInitialState" } });
  const baseState = {
    ...init.result,
    clock: { ...init.result.clock, tick: 11 },
    resources: { ...init.result.resources, ore: 700 },
    structures: new Map(init.result.structures || [])
  };
  const action = { domain: "game", action: { type: "placeStructure", x: 5, y: 2, structureId: "mine", state: baseState } };
  const a = await sameActionKernel.execute(action);
  const b = await sameActionKernel.execute(action);
  assert.deepEqual(
    { tick: a.result.clock.tick, ore: a.result.resources.ore, structure: a.result.structures.get("5,2") },
    { tick: b.result.clock.tick, ore: b.result.resources.ore, structure: b.result.structures.get("5,2") }
  );

  for (const seed of [mkSeed("kernel-sig", 0), mkSeed("kernel-sig", 1), String.fromCharCode(97)]) {
    const kernel = new KernelController({ seed });
    const initState = await kernel.execute({ domain: "game", action: { type: "createInitialState" } });
    const signature = initState.result.statistics.seedSignature;
    assert.match(signature, /^[0-9a-f]{8}$/);
    const expected = expectedSeedSignature(seed);
    assert.equal(signature, expected);
  }

  const defaultKernel = new KernelController({});
  const defaultInit = await defaultKernel.execute({ domain: "game", action: { type: "createInitialState" } });
  assert.equal(defaultInit.result.statistics.seedSignature, expectedSeedSignature("default-seed"));
}

export const run = test;
