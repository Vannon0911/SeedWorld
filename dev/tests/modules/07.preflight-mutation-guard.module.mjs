import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const id = "07-preflight-mutation-guard-attestation";

/**
 * Runs an integration test that verifies the preflight mutation guard's attestation workflow and related messaging.
 *
 * The test covers deterministic target selection, fault injection and detection, lock/vault normalization,
 * unresolved candidate validation, challenge message generation for armed and escalated phases,
 * HEAD-drift assessment for stale active faults and cleared locks, deterministic resolution proof generation,
 * and a minimal smoke check of the world generator module.
 *
 * @param {object} params - Test context.
 * @param {object} params.assert - Assertion helpers used by the test harness.
 * @param {string} params.root - Absolute path to the repository root used to locate test fixtures and modules.
 */
export async function test({ assert, root }) {
  const guardModule = await import(pathToFileURL(path.join(root, "dev/tools/runtime/preflight-mutation-guard.mjs")).href);
  const worldGenPath = path.join(root, "app/src/game/worldGen.js");
  const worldGenModule = await import(pathToFileURL(worldGenPath).href);
  const fs = await import("node:fs/promises");

  const {
    assessHeadDrift,
    buildChallengeBlockMessage,
    pickTargetFile,
    injectFault,
    isFaultStillActive,
    normalizeLock,
    normalizeVault,
    validateResolutionCandidate,
    buildResolutionProof
  } = guardModule;

  const source = await fs.readFile(worldGenPath, "utf8");
  const seed = "attestation-seed";
  const head = "head-1234567890";

  assert.equal(
    pickTargetFile(seed, head),
    pickTargetFile(seed, head),
    "target selection must stay deterministic for identical seed/head"
  );

  const injection = injectFault("app/src/game/worldGen.js", source, { seed, head });
  assert.equal(injection.faultKind, "lake-biome-drift", "worldGen must use the configured hidden fault kind");
  assert.equal(isFaultStillActive("app/src/game/worldGen.js", injection.content), true, "injected fault must be detectable");

  const lock = normalizeLock({
    version: 2,
    policyVersion: 2,
    head,
    targetFile: "app/src/game/worldGen.js",
    faultKind: injection.faultKind,
    preStateHash: createDigest(source),
    postInjectHash: createDigest(injection.content),
    seedRef: "seed-ref"
  });
  const vault = normalizeVault({ seed });

  const unresolved = validateResolutionCandidate(lock, injection.content, vault.seed);
  assert.equal(unresolved.ok, false, "unchanged injected state must stay blocked");
  assert.equal(unresolved.code, "fault-still-active", "active hidden fault must report the correct block code");

  const armedMessage = buildChallengeBlockMessage({
    phase: "armed",
    targetFile: "app/src/game/worldGen.js",
    faultKind: injection.faultKind
  });
  assert.match(armedMessage, /challenge armed/i, "first challenge block must be terse but explicit");

  const staleBlocked = assessHeadDrift(lock, injection.content, "head-9999999999");
  assert.equal(staleBlocked.action, "block", "active stale fault must stay blocked on HEAD drift");
  assert.equal(staleBlocked.code, "stale-head-active-fault", "stale fault block code must stay explicit");

  const reverted = validateResolutionCandidate(lock, source, vault.seed);
  assert.equal(reverted.ok, false, "simple revert to prestate must stay blocked");
  assert.equal(reverted.code, "reverted-to-prestate", "prestate revert must not resolve the attestation");

  const fixed = `${source.trimEnd()}\n\nconst __guardAttestationKeepAlive = true;\n`;
  const staleCleared = assessHeadDrift(lock, fixed, "head-9999999999");
  assert.equal(staleCleared.action, "clear-stale-lock", "resolved stale lock must be auto-clearable on HEAD drift");
  assert.equal(staleCleared.code, "stale-head-resolved", "stale lock clear code must stay explicit");
  const resolved = validateResolutionCandidate(lock, fixed, vault.seed);
  assert.equal(resolved.ok, true, "a changed post-state without the active fault must resolve");
  assert.equal(
    resolved.resolutionProof,
    buildResolutionProof(vault.seed, lock, resolved.currentHash),
    "resolution proof must be derived deterministically from the vault seed and state hashes"
  );

  const escalatedMessage = buildChallengeBlockMessage({
    phase: "unresolved",
    targetFile: "app/src/game/worldGen.js",
    faultKind: injection.faultKind,
    pendingFailureCount: 2
  });
  assert.match(escalatedMessage, /Eskalation aktiv/i, "repeated failure must escalate with explicit manual-fix language");

  const sample = worldGenModule.generateWorld({ seed: "alpha", width: 16, height: 12 });
  worldGenModule.validateWorldShape(sample);
}

function createDigest(input) {
  return createHash("sha256").update(input).digest("hex");
}

export const run = test;
