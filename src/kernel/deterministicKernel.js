import { createMutFingerprint } from "./fingerprint.js";
import { withDeterminismGuards } from "./runtimeGuards.js";
import { assertSeedMatch } from "./seedGuard.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[KERNEL_DETERMINISM] ${message}`);
  }
}

function assertPlainObject(value, message) {
  assert(value && typeof value === "object" && !Array.isArray(value), message);

  const proto = Object.getPrototypeOf(value);
  assert(proto === Object.prototype || proto === null, message);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
  }

  return value;
}

import { KernelController } from "./KernelController.js";

export async function runDeterministicKernel(seed, ticks = 8, options = {}) {
  // @doc-anchor KERNEL-DETERMINISM
  // @doc-anchor KERNEL-GUARDS
  // @doc-anchor SEED-GUARD
  
  assert(typeof seed === "string" && seed.trim().length > 0, "seed muss eine nicht-leere Zeichenkette sein");
  assert(Number.isInteger(ticks) && ticks > 0 && ticks <= 256, "ticks ausserhalb 1..256");
  assertPlainObject(options, "options fehlen oder sind kein Plain-Object");

  const seedHash = await assertSeedMatch(seed, options.expectedSeedHash);

  // 1. Instanziierung des echten Kernels
  const kernel = new KernelController({ seed });

  // 2. Initial state creation via game domain
  const initialRes = await kernel.execute({
    domain: 'game',
    action: { type: 'createInitialState' }
  });
  
  let state = initialRes.result;
  const states = [];

  // 3. Echte Tick-Loop über den KernelRouter
  // @mut-point MUT-KERNEL-LOOP
  for (let tick = 1; tick <= ticks; tick += 1) {
    const advanceRes = await kernel.execute({
      domain: 'game',
      action: { type: 'advanceTick', state, ticks: 1 }
    });
    state = advanceRes.result;

    // Wir speichern Snapshot-Auszüge, um den Fingerprint zu erzeugen
    states.push({
      tick: state.clock.tick,
      resources: { ...state.resources },
      statistics: { ...state.statistics }
    });
  }

  const mutFingerprint = await createMutFingerprint({
    kernel: "seedworld.v2.controller",
    seedHash,
    ticks,
    states,
    auditCalls: kernel.router.callHistory.length
  });

  return deepFreeze({ seedHash, mutFingerprint, states });
}
