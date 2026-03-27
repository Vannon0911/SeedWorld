import { extname } from 'node:path';
import JSZip from 'jszip';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const FORBIDDEN_RUNTIME_PATTERNS = [
  'Math.random', 'Date.now', 'performance.now',
  'crypto.getRandomValues', 'fetch(', 'indexedDB',
  'Worker(', 'SharedWorker('
];

async function collectBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Request too large'), { code: 'REQUEST_TOO_LARGE' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipart(buffer, boundary) {
  const marker = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(marker);
  while (start !== -1) {
    const next = buffer.indexOf(marker, start + marker.length);
    if (next === -1) break;
    const part = buffer.subarray(start + marker.length + 2, next - 2);
    if (part.length > 0) parts.push(part);
    start = next;
  }
  const fields = {}, files = {};
  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;
    const headerText = part.subarray(0, headerEnd).toString('utf8');
    const body = part.subarray(headerEnd + 4);
    const disposition = headerText.split('\r\n').find((l) => l.toLowerCase().startsWith('content-disposition'));
    if (!disposition) continue;
    const nameMatch = disposition.match(/name="([^"]+)"/i);
    const fileMatch = disposition.match(/filename="([^"]*)"/i);
    if (!nameMatch) continue;
    if (fileMatch?.[1]) {
      files[nameMatch[1]] = { filename: fileMatch[1], content: body };
    } else {
      fields[nameMatch[1]] = body.toString('utf8');
    }
  }
  return { fields, files };
}

function parseJsonFromBuffer(buffer, name = 'input.json') {
  try {
    return { ok: true, manifest: JSON.parse(buffer.toString('utf8')), source: name, files: [name] };
  } catch (err) {
    return { ok: false, error: { code: 'RUNTIME_JSON_INVALID', message: 'JSON konnte nicht geparst werden.', details: String(err?.message || err) } };
  }
}

async function parseRuntimeManifest(inputFile) {
  const name = inputFile.filename || 'input';
  const ext = extname(name).toLowerCase();
  if (ext === '.json') return parseJsonFromBuffer(inputFile.content, name);
  if (ext !== '.zip') return { ok: false, error: { code: 'RUNTIME_INPUT_UNSUPPORTED', message: 'Nur .zip oder .json werden unterstuetzt.', details: `Datei: ${name}` } };

  let zip;
  try { zip = await JSZip.loadAsync(inputFile.content); }
  catch (err) { return { ok: false, error: { code: 'RUNTIME_ZIP_INVALID', message: 'ZIP konnte nicht gelesen werden.', details: String(err?.message || err) } }; }

  const files = Object.keys(zip.files).filter((f) => !zip.files[f].dir);
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith('.json'));
  const preferred = jsonFiles.filter((f) => /^patches.*\.json$/i.test(f.split('/').pop() || ''));

  let selected = null;
  if (preferred.length === 1) selected = preferred[0];
  else if (preferred.length > 1) return { ok: false, error: { code: 'RUNTIME_MANIFEST_AMBIGUOUS', message: 'Mehrere patches*.json Dateien gefunden.', details: preferred, fileList: files } };
  else if (jsonFiles.length === 1) selected = jsonFiles[0];
  else return { ok: false, error: { code: 'RUNTIME_MANIFEST_NOT_FOUND', message: 'Kein eindeutiges Manifest in ZIP gefunden.', details: jsonFiles, fileList: files } };

  const content = await zip.file(selected).async('string');
  try {
    return { ok: true, manifest: JSON.parse(content), source: selected, files };
  } catch (err) {
    return { ok: false, error: { code: 'RUNTIME_MANIFEST_INVALID', message: 'Manifest-JSON in ZIP ist ungueltig.', details: String(err?.message || err), source: selected } };
  }
}

export function normalizePatches(manifest) {
  if (manifest && Array.isArray(manifest.patches)) return manifest.patches;
  if (manifest && typeof manifest === 'object') return [manifest];
  return [];
}

export function validateRuntimePatchSet(manifest) {
  const patches = normalizePatches(manifest);
  const debug = [], problems = [];
  let denied = false;

  if (!patches.length) {
    return { ok: false, llmGate: { decision: 'deny', reasons: ['Manifest enthaelt keine Patches.'], policyVersion: 'runtime-v1' }, debug: ['Leeres Manifest.'], summary: 'Runtime-Check fehlgeschlagen: keine Patches.' };
  }

  patches.forEach((patch, index) => {
    const patchId = patch?.id || `patch-${index + 1}`;
    if (patch?.kind === 'file') { denied = true; problems.push(`Patch ${patchId}: file-Patches sind gesperrt.`); return; }
    if (!patch?.hooks || typeof patch.hooks !== 'object') { denied = true; problems.push(`Patch ${patchId}: hooks fehlen.`); return; }

    for (const [hookName, hookConfig] of Object.entries(patch.hooks)) {
      const code = typeof hookConfig?.code === 'string' ? hookConfig.code : '';
      if (!code.trim()) { denied = true; problems.push(`Patch ${patchId}, Hook ${hookName}: code fehlt.`); continue; }
      for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
        if (code.includes(pattern)) { denied = true; problems.push(`Patch ${patchId}, Hook ${hookName}: verbotene API ${pattern}.`); }
      }
      try { new Function('state', 'kernel', 'rng', code); }
      catch (err) { denied = true; problems.push(`Patch ${patchId}, Hook ${hookName}: Syntaxfehler (${String(err?.message || err)}).`); }
    }
    debug.push(`Patch ${patchId}: ${Object.keys(patch.hooks).length} Hook(s) geprueft.`);
  });

  if (denied) return { ok: false, llmGate: { decision: 'deny', reasons: problems, policyVersion: 'runtime-v1' }, debug, summary: 'Runtime-Check: abgelehnt.' };
  return { ok: true, llmGate: { decision: 'pass', reasons: ['Alle Patches entsprechen runtime-v1 Regeln.'], policyVersion: 'runtime-v1' }, debug, summary: `Runtime-Check bestanden: ${patches.length} Patch(es).` };
}

export async function handleRuntimePatchCheck(req, res, json) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) { json(res, 400, { error: 'multipart/form-data with boundary required' }); return; }

  const rawBody = await collectBody(req);
  const { files } = parseMultipart(rawBody, boundaryMatch[1]);
  const inputFile = files.input;
  if (!inputFile) { json(res, 400, { error: 'input file is required' }); return; }

  const parsed = await parseRuntimeManifest(inputFile);
  if (!parsed.ok) {
    json(res, 422, { ok: false, error: parsed.error, llmGate: { decision: 'deny', reasons: [parsed.error.message], policyVersion: 'runtime-v1' } });
    return;
  }

  const validation = validateRuntimePatchSet(parsed.manifest);
  const checkId = `runtime-${(++handleRuntimePatchCheck._seq).toString(36)}`;
  const result = { checkId, ok: validation.ok, mode: 'runtime-only', source: parsed.source, files: parsed.files, llmGate: validation.llmGate, debug: validation.debug, summary: validation.summary, patches: validation.ok ? normalizePatches(parsed.manifest) : [] };
  json(res, validation.ok ? 200 : 422, result);
}
handleRuntimePatchCheck._seq = 0;
