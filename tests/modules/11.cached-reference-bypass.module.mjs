import path from "node:path";
import { pathToFileURL } from "node:url";

export const id = "11-cached-reference-bypass";

export async function run({ assert, root }) {
  const guards = await import(pathToFileURL(path.join(root, "src/kernel/runtimeGuards.js")));

  const cachedMathRandom = Math.random;
  const cachedDateNow = Date.now;

  let randomBypassObserved = false;
  let dateBypassObserved = false;

  await guards.withDeterminismGuards(async () => {
    const randomValue = cachedMathRandom();
    const dateValue = cachedDateNow();

    randomBypassObserved = typeof randomValue === "number";
    dateBypassObserved = Number.isFinite(dateValue);
  });

  assert(randomBypassObserved, "Gecachte Math.random-Referenz darf im aktuellen Guard-Design weiter laufen.");
  assert(dateBypassObserved, "Gecachte Date.now-Referenz darf im aktuellen Guard-Design weiter laufen.");
}
