import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PATCH_MATRIX_REL = "patches/patch-matrix.json";
const PATCH_SCHEMA_REL = "patches/schema.json";
const PATCH_TYPES = new Set([
  "string-replace",
  "file-create",
  "file-append",
  "file-replace",
  "json-update",
  "run-command"
]);
const VERIFY_TYPES = new Set(["contains", "file-exists", "json-field", "file-checksum", "run-command"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function stableClone(value) {
  if (Array.isArray(value)) {
    return value.map(stableClone);
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = stableClone(value[key]);
    }
    return out;
  }
  return value;
}

export function stableManifestHash(manifest) {
  return hashText(JSON.stringify(stableClone(manifest)));
}

function assertNonEmptyString(value, message) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
}

function assertPatchVerifyShape(verify, label) {
  if (!isPlainObject(verify)) {
    throw new Error(`${label}.verify muss Objekt sein.`);
  }
  assertNonEmptyString(verify.type, `${label}.verify.type fehlt.`);
  if (!VERIFY_TYPES.has(verify.type)) {
    throw new Error(`${label}.verify.type ungueltig: ${verify.type}`);
  }
  assertNonEmptyString(verify.file, `${label}.verify.file fehlt.`);
  if (verify.type === "contains") {
    assertNonEmptyString(verify.text, `${label}.verify.text fehlt.`);
  }
  if (verify.type === "json-field") {
    assertNonEmptyString(verify.field, `${label}.verify.field fehlt.`);
    if (!Object.prototype.hasOwnProperty.call(verify, "expectedValue")) {
      throw new Error(`${label}.verify.expectedValue fehlt.`);
    }
  }
  if (verify.type === "file-checksum") {
    assertNonEmptyString(verify.checksum, `${label}.verify.checksum fehlt.`);
  }
  if (verify.type === "run-command") {
    assertNonEmptyString(verify.command, `${label}.verify.command fehlt.`);
  }
}

function assertPatchShape(patch, index) {
  const label = `patches[${index}]`;
  if (!isPlainObject(patch)) {
    throw new Error(`${label} muss Objekt sein.`);
  }

  assertNonEmptyString(patch.id, `${label}.id fehlt.`);
  if (!/^[A-Za-z0-9._-]+$/.test(patch.id)) {
    throw new Error(`${label}.id enthaelt ungueltige Zeichen.`);
  }
  assertNonEmptyString(patch.name, `${label}.name fehlt.`);
  assertNonEmptyString(patch.type, `${label}.type fehlt.`);
  if (!PATCH_TYPES.has(patch.type)) {
    throw new Error(`${label}.type ungueltig: ${patch.type}`);
  }
  assertNonEmptyString(patch.file, `${label}.file fehlt.`);

  if (patch.type === "string-replace") {
    assertNonEmptyString(patch.find, `${label}.find fehlt.`);
    if (typeof patch.replace !== "string") {
      throw new Error(`${label}.replace fehlt.`);
    }
  }
  if (patch.type === "file-create" || patch.type === "file-append" || patch.type === "file-replace") {
    if (typeof patch.content !== "string") {
      throw new Error(`${label}.content fehlt.`);
    }
  }
  if (patch.type === "json-update" && !isPlainObject(patch.updates)) {
    throw new Error(`${label}.updates muss Objekt sein.`);
  }
  if (patch.type === "run-command") {
    assertNonEmptyString(patch.command, `${label}.command fehlt.`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "verify")) {
    assertPatchVerifyShape(patch.verify, label);
  }
}

export function validateManifestSchema(manifest, label = "manifest") {
  if (!isPlainObject(manifest)) {
    throw new Error(`${label} muss Objekt sein.`);
  }
  if (!isPlainObject(manifest.meta)) {
    throw new Error(`${label}.meta fehlt.`);
  }
  assertNonEmptyString(manifest.meta.version, `${label}.meta.version fehlt.`);
  assertNonEmptyString(manifest.meta.description, `${label}.meta.description fehlt.`);
  assertNonEmptyString(manifest.meta.author, `${label}.meta.author fehlt.`);

  if (!Array.isArray(manifest.patches) || manifest.patches.length === 0) {
    throw new Error(`${label}.patches muss nicht-leeres Array sein.`);
  }

  const ids = new Set();
  for (let i = 0; i < manifest.patches.length; i += 1) {
    const patch = manifest.patches[i];
    assertPatchShape(patch, i);
    if (ids.has(patch.id)) {
      throw new Error(`${label}.patches enthaelt doppelte id: ${patch.id}`);
    }
    ids.add(patch.id);
  }
}

export async function readPatchMatrix(root) {
  const matrixPath = path.join(root, PATCH_MATRIX_REL);
  const schemaPath = path.join(root, PATCH_SCHEMA_REL);
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const matrix = JSON.parse(await readFile(matrixPath, "utf8"));

  if (!isPlainObject(schema)) {
    throw new Error("[PATCH_MATRIX] patches/schema.json ist ungueltig.");
  }
  if (!isPlainObject(matrix)) {
    throw new Error("[PATCH_MATRIX] patches/patch-matrix.json ist ungueltig.");
  }
  if (!Array.isArray(matrix.manifests) || matrix.manifests.length === 0) {
    throw new Error("[PATCH_MATRIX] manifests fehlt oder ist leer.");
  }

  return {
    schema,
    matrix,
    matrixPath,
    schemaPath
  };
}

export function assertManifestApprovedByMatrix(manifest, matrix, label = "manifest") {
  validateManifestSchema(manifest, label);

  const version = manifest.meta.version;
  const manifestHash = stableManifestHash(manifest);
  const entries = matrix.manifests.filter((entry) => isPlainObject(entry) && entry.version === version);
  if (entries.length === 0) {
    throw new Error(`[PATCH_MATRIX] Version ${version} ist nicht in patches/patch-matrix.json freigegeben.`);
  }

  const approved = entries.some((entry) => typeof entry.sha256 === "string" && entry.sha256 === manifestHash);
  if (!approved) {
    throw new Error(`[PATCH_MATRIX] Hash-Mismatch fuer Version ${version}. Manifest ist nicht kanonisch freigegeben.`);
  }

  return {
    version,
    sha256: manifestHash
  };
}

export async function validatePatchMatrix(root) {
  const { matrix } = await readPatchMatrix(root);
  const seenVersions = new Set();
  const seenHashes = new Set();

  for (let i = 0; i < matrix.manifests.length; i += 1) {
    const entry = matrix.manifests[i];
    if (!isPlainObject(entry)) {
      throw new Error(`[PATCH_MATRIX] manifests[${i}] muss Objekt sein.`);
    }
    assertNonEmptyString(entry.version, `[PATCH_MATRIX] manifests[${i}].version fehlt.`);
    assertNonEmptyString(entry.file, `[PATCH_MATRIX] manifests[${i}].file fehlt.`);
    assertNonEmptyString(entry.sha256, `[PATCH_MATRIX] manifests[${i}].sha256 fehlt.`);

    const uniqueVersionKey = `${entry.version}:${entry.sha256}`;
    if (seenVersions.has(uniqueVersionKey)) {
      throw new Error(`[PATCH_MATRIX] Doppelte Matrix-Freigabe gefunden: ${entry.version}.`);
    }
    seenVersions.add(uniqueVersionKey);

    const absManifestPath = path.join(root, entry.file);
    const manifest = JSON.parse(await readFile(absManifestPath, "utf8"));
    validateManifestSchema(manifest, entry.file);
    const computed = stableManifestHash(manifest);
    if (computed !== entry.sha256) {
      throw new Error(`[PATCH_MATRIX] Hash-Mismatch in ${entry.file}. Erwartet ${entry.sha256}, ist ${computed}.`);
    }

    const dedupeHashKey = `${entry.file}:${entry.sha256}`;
    if (seenHashes.has(dedupeHashKey)) {
      throw new Error(`[PATCH_MATRIX] Doppelte Manifest-Datei-Freigabe: ${entry.file}`);
    }
    seenHashes.add(dedupeHashKey);
  }

  return {
    count: matrix.manifests.length
  };
}
