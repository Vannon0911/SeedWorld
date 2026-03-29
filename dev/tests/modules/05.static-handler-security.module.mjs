import path from "node:path";
import { pathToFileURL } from "node:url";

export const id = "05-static-handler-security";

/**
 * Verifies the static resolver only exposes approved runtime files.
 */
export async function test({ assert, root }) {
  const mod = await import(pathToFileURL(path.join(root, "app/server/staticHandler.mjs")).href);
  const { resolveStaticPath } = mod;

  const gamePath = resolveStaticPath("/game");
  assert.equal(typeof gamePath, "string");
  assert.equal(path.basename(gamePath), "game.html");

  const removedPatchUi = resolveStaticPath("/patch");
  assert.equal(removedPatchUi, null);

  const stylePath = resolveStaticPath("/src/styles.css");
  assert.equal(typeof stylePath, "string");
  assert.equal(path.basename(stylePath), "styles.css");

  const hiddenDotGit = resolveStaticPath("/.git/config");
  assert.equal(hiddenDotGit, null);

  const hiddenSegment = resolveStaticPath("/src/.secrets/keys.js");
  assert.equal(hiddenSegment, null);

  const disallowedExt = resolveStaticPath("/src/app.json");
  assert.equal(disallowedExt, null);

  const traversalAttempt = resolveStaticPath("/src/../package.json");
  assert.equal(traversalAttempt, null);
}

export const run = test;
