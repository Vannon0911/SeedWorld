import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Generate mutation fingerprints for each checkpoint state while preserving input order.
 *
 * @param {Array<Object>} states - Checkpoint states; each must include `tick`, `resources`, and `statistics`.
 * @param {Function} createMutFingerprint - Function called with `{ tick, resources, statistics }` and returning a mutation fingerprint string or a promise that resolves to one.
 * @returns {Promise<Array<string>>} Array of mutation fingerprint strings in the same order as `states`.
 */
function buildCheckpointHashes(states, createMutFingerprint) {
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

/**
 * Finds the first index at which two arrays differ.
 * @param {Array} a - First array to compare.
 * @param {Array} b - Second array to compare.
 * @returns {number} `-1` if both arrays have identical elements and length; otherwise the zero-based index of the first differing element, or the length of the shorter array if all compared elements match but lengths differ.
 */
function findFirstDrift(a, b) {
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) {
    if (a[i] !== b[i]) {
      return i;
    }
  }

  return a.length === b.length ? -1 : limit;
}

export const id = "08-kernel-replay-determinism";

/**
 * Validate deterministic kernel replay behavior by running replays and comparing fingerprints.
 *
 * Runs three replays (two with the same seed, one with a different seed), verifies the identical-seed replays produce the same seed hash and overall mutation fingerprint, computes per-checkpoint mutation fingerprints for each replay, asserts the checkpoint-hash arrays match for the identical replays, and locates the first checkpoint index where the different-seed replay diverges.
 *
 * @param {{ assert: Object, root: string }} params - Function parameters.
 * @param {Object} params.assert - Assertion utilities (e.g., assert.equal, assert.deepEqual, assert.notEqual).
 * @param {string} params.root - Project root directory used to import the kernel and fingerprint modules.
 */
export async function test({ assert, root }) {
  const deterministicKernel = await import(
    pathToFileURL(path.join(root, "app/src/kernel/deterministicKernel.js"))
  );
  const fingerprintModule = await import(pathToFileURL(path.join(root, "app/src/kernel/fingerprint.js")));

  const { runDeterministicKernel } = deterministicKernel;
  const { createMutFingerprint, sha256Hex } = fingerprintModule;

  const sameSeed = "replay-seed-alpha";
  const expectedSeedHash = await sha256Hex(sameSeed);

  const replayA = await runDeterministicKernel(sameSeed, 30, { expectedSeedHash });
  const replayB = await runDeterministicKernel(sameSeed, 30, { expectedSeedHash });
  const replayC = await runDeterministicKernel("replay-seed-beta", 30, {
    expectedSeedHash: await sha256Hex("replay-seed-beta")
  });

  assert.equal(replayA.seedHash, replayB.seedHash, "gleicher Seed muss denselben seedHash liefern");
  assert.equal(
    replayA.mutFingerprint,
    replayB.mutFingerprint,
    "gleicher Seed plus gleiche Tickfolge muss denselben Gesamt-Fingerprint liefern"
  );

  const checkpointHashesA = await buildCheckpointHashes(replayA.states, createMutFingerprint);
  const checkpointHashesB = await buildCheckpointHashes(replayB.states, createMutFingerprint);
  const checkpointHashesC = await buildCheckpointHashes(replayC.states, createMutFingerprint);

  assert.deepEqual(
    checkpointHashesA,
    checkpointHashesB,
    "Replay-Checkpoint-Hashes muessen fuer identische Replays exakt matchen"
  );

  const firstDriftIndex = findFirstDrift(checkpointHashesA, checkpointHashesC);
  assert.notEqual(firstDriftIndex, -1, "anderer Seed muss spaetestens an einem Checkpoint driften");
  assert.equal(replayA.states[firstDriftIndex].tick, firstDriftIndex + 1, "Drift muss auf den korrekten Tick zeigen");
}

export const run = test;
