import { extname, resolve } from 'node:path';
import { readFile, stat } from 'node:fs/promises';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = resolve(ROOT_DIR, 'app', 'public');
const SRC_DIR = resolve(ROOT_DIR, 'app', 'src');
const PATCHES_DIR = resolve(ROOT_DIR, 'dev', 'patches');

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
});

const PATCH_SCHEMA_PATHS = new Set([
  '/patches/patch-schema.json',
  '/patches/patch-matrix.json'
]);

/**
 * Rejects hidden path segments so static routing cannot expose dotfiles.
 */
function hasHiddenSegment(pathname) {
  return pathname.split('/').filter(Boolean).some((s) => s.startsWith('.'));
}

/**
 * Ensures a resolved static candidate stays inside an approved parent directory.
 */
function isPathInside(parentDir, candidate) {
  const parent = resolve(parentDir);
  return candidate.startsWith(`${parent}\\`) || candidate.startsWith(`${parent}/`);
}

/**
 * Maps public runtime routes to safe files on disk.
 */
export function resolveStaticPath(pathname) {
  if (pathname === '/menu') return resolve(PUBLIC_DIR, 'menu.html');
  if (pathname === '/menu.html') return resolve(PUBLIC_DIR, 'menu.html');
  if (pathname === '/')     return resolve(PUBLIC_DIR, 'index.html');
  if (pathname === '/game') return resolve(PUBLIC_DIR, 'game.html');
  if (pathname === '/game.html') return resolve(PUBLIC_DIR, 'game.html');

  if (hasHiddenSegment(pathname)) return null;

  if (pathname.startsWith('/src/')) {
    const candidate = resolve(ROOT_DIR, `./app${pathname}`);
    const ext = extname(candidate).toLowerCase();
    if (!isPathInside(SRC_DIR, candidate) || !new Set(['.js', '.mjs', '.css']).has(ext)) return null;
    return candidate;
  }

  if (PATCH_SCHEMA_PATHS.has(pathname)) return resolve(PATCHES_DIR, pathname.split('/').pop());
  return null;
}

/**
 * Streams a resolved static file with a content type derived from its extension.
 */
export async function serveFile(res, filePath) {
  const ext = extname(filePath).toLowerCase();
  const body = await readFile(filePath);
  res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' });
  res.end(body);
}

/**
 * Resolves and serves a static request, returning whether a file was handled.
 */
export async function handleStaticRequest(res, pathname) {
  const filePath = resolveStaticPath(pathname);
  if (!filePath) return false;

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return false;
    await serveFile(res, filePath);
    return true;
  } catch {
    return false;
  }
}
