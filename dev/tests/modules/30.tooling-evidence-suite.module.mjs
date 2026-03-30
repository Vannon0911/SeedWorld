import path from "node:path";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { isStrictEvidence, STRICT_GATE_DECISIONS } from "../../scripts/build-evidence-bundle.mjs";

function createDigest(createHash, input) {
  return createHash("sha256").update(input).digest("hex");
}

export const id = "30-tooling-evidence-suite";

export async function test({ assert, root }) {
  const mkSeed = (...parts) => `suite-${id}-${parts.join("-")}`;
  const patchUtils = await import(pathToFileURL(path.join(root, "app/server/patchUtils.js")).href);
  const guardModule = await import(pathToFileURL(path.join(root, "dev/tools/runtime/preflight-mutation-guard.mjs")).href);
  const worldGen = await import(pathToFileURL(path.join(root, "app/src/game/worldGen.js")).href);
  const crypto = await import("node:crypto");

  const {
    parseUniversalPatch,
    snapshotFiles,
    validateAgainstLocks,
    classifyPatchRisk
  } = patchUtils;

  const single = parseUniversalPatch({ patch: { id: "p1", type: "string-replace", file: "docs/a.md" } });
  assert.equal(single.kind, "browser-patch");
  assert.deepEqual(single.affectedFiles, ["docs/a.md"]);

  const tempRoot = await mkdtemp(path.join(tmpdir(), "seedworld-patchutils-"));
  const existingRel = "docs/probe.txt";
  const existingAbs = path.join(tempRoot, existingRel);
  await mkdir(path.dirname(existingAbs), { recursive: true });
  await writeFile(existingAbs, "probe", "utf8");
  const snapshots = await snapshotFiles(tempRoot, [existingRel, "docs/missing.txt"]);
  assert.equal(snapshots.find((x) => x.file === existingRel)?.exists, true);
  assert.equal(snapshots.find((x) => x.file === "docs/missing.txt")?.exists, false);

  const lowValidation = await validateAgainstLocks({ kind: "browser-patch", patch: { file: "docs/a.md" } }, { root });
  assert.equal(lowValidation.ok, true);
  assert.equal(classifyPatchRisk(lowValidation).shouldAutoExecute, true);

  const highValidation = await validateAgainstLocks({ kind: "browser-patch", patch: { file: "../../escape.txt" } }, { root });
  assert.equal(highValidation.ok, false);
  assert.equal(classifyPatchRisk(highValidation).shouldNotifyLlm, true);

  const {
    pickTargetFile,
    injectFault,
    isFaultStillActive,
    normalizeLock,
    normalizeVault,
    validateResolutionCandidate,
    buildResolutionProof
  } = guardModule;

  const worldGenPath = path.join(root, "app/src/game/worldGen.js");
  const source = await (await import("node:fs/promises")).readFile(worldGenPath, "utf8");
  const seed = mkSeed("attestation");
  const head = `${mkSeed("head")}-v1`;
  assert.equal(pickTargetFile(seed, head), pickTargetFile(seed, head));

  const injection = injectFault("app/src/game/worldGen.js", source, { seed, head });
  assert.equal(isFaultStillActive("app/src/game/worldGen.js", injection.content), true);

  const lock = normalizeLock({
    version: 2,
    policyVersion: 2,
    head,
    targetFile: "app/src/game/worldGen.js",
    faultKind: injection.faultKind,
    preStateHash: createDigest(crypto.createHash, source),
    postInjectHash: createDigest(crypto.createHash, injection.content),
    seedRef: "seed-ref"
  });
  const vault = normalizeVault({ seed, challengeState: "armed" });
  const unresolved = validateResolutionCandidate(lock, injection.content, vault.seed);
  assert.equal(unresolved.ok, false);
  assert.equal(unresolved.code, "fault-still-active");

  const fixed = `${source.trimEnd()}\n\nconst __guardAttestationKeepAlive = true;\n`;
  const resolved = validateResolutionCandidate(lock, fixed, vault.seed);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.resolutionProof, buildResolutionProof(vault.seed, lock, resolved.currentHash));

  const sample = worldGen.generateWorld({ seed: mkSeed("sample-world"), width: 16, height: 12 });
  worldGen.validateWorldShape(sample);

  assert.equal(STRICT_GATE_DECISIONS.has("runtime_and_kernel_verified"), true);
  assert.equal(STRICT_GATE_DECISIONS.has("pass_and_deny_paths_verified"), true);
  assert.equal(
    isStrictEvidence({ status: "passed", determinism: { consistent: true }, gateDecision: "runtime_and_kernel_verified" }),
    true
  );
  assert.equal(
    isStrictEvidence({ status: "failed", determinism: { consistent: true }, gateDecision: "runtime_and_kernel_verified" }),
    false
  );
}

export const run = test;
