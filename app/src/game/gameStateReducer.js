import { deepClone, isPlainObject } from "./gameInput.js";

function applyPatchToState(state, patch) {
  if (patch.op !== "set") {
    throw new Error(`[GAME_LOGIC] Unsupported patch operation: ${String(patch.op)}`);
  }

  const segments = patch.path.split(".");
  if (segments.length === 0) {
    throw new Error("[GAME_LOGIC] Patch path fehlt.");
  }

  let cursor = state;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index];
    if (!isPlainObject(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[segments[segments.length - 1]] = deepClone(patch.value);
}

export function reduceGameState(state = {}, patches = []) {
  const safeState = isPlainObject(state) ? state : {};
  const nextState = deepClone(safeState);

  for (const patch of patches) {
    applyPatchToState(nextState, patch);
  }

  return nextState;
}
