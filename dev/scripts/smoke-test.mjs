import { strict as assert } from 'node:assert';
import { UIPluginController } from '../../app/src/ui/UIPluginController.js';

class KernelStub {
  /**
   * Mimics the kernel tick contract used by the UI plugin controller.
   */
  getCurrentTick() {
    return 0;
  }
}

/**
 * Verifies the deterministic RNG helper stays in range and yields valid choices.
 */
function verifyDeterministicRng() {
  const controller = new UIPluginController(new KernelStub());
  controller.deterministicSeed = 'smoke-seed';

  const rng = controller.createDeterministicRNG();
  const value = rng.randint(1, 3);
  assert.equal(Number.isInteger(value), true, 'randint() must return an integer');
  assert.equal(value >= 1 && value <= 3, true, 'randint() must stay in range');

  const choice = rng.choice(['a', 'b', 'c']);
  assert.equal(['a', 'b', 'c'].includes(choice), true, 'choice() must pick from array');
}

/**
 * Confirms the app server module can be loaded without runtime side effects.
 */
async function verifyServerModulesLoad() {
  await import('../../app/server/appServer.mjs');
}

verifyDeterministicRng();
await verifyServerModulesLoad();
console.log('[smoke-test] ok');
