export function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function deepClone(value) {
  return structuredClone(value);
}

export function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
  }

  return value;
}

export function coercePositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`[GAME_LOGIC] ${label} muss eine positive ganze Zahl sein.`);
  }

  return number;
}

export function coerceString(value, label) {
  if (typeof value !== "string") {
    throw new Error(`[GAME_LOGIC] ${label} muss String sein.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`[GAME_LOGIC] ${label} darf nicht leer sein.`);
  }

  return trimmed;
}

export function coerceInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new Error(`[GAME_LOGIC] ${label} muss eine ganze Zahl sein.`);
  }

  return number;
}

export function normalizeKernelApi(kernelApi) {
  if (!kernelApi || typeof kernelApi !== "object") {
    throw new Error("[GAME_LOGIC] kernelApi fehlt.");
  }

  const planPatch =
    typeof kernelApi.planPatch === "function"
      ? kernelApi.planPatch.bind(kernelApi)
      : typeof kernelApi.plan === "function"
        ? kernelApi.plan.bind(kernelApi)
        : typeof kernelApi.execute === "function"
          ? kernelApi.execute.bind(kernelApi)
          : null;

  const applyPatch =
    typeof kernelApi.applyPatch === "function"
      ? kernelApi.applyPatch.bind(kernelApi)
      : typeof kernelApi.apply === "function"
        ? kernelApi.apply.bind(kernelApi)
        : typeof kernelApi.execute === "function"
          ? kernelApi.execute.bind(kernelApi)
          : null;

  if (!planPatch || !applyPatch) {
    throw new Error("[GAME_LOGIC] kernelApi braucht planPatch/applyPatch.");
  }

  return {
    planPatch,
    applyPatch
  };
}

export function readAction(action) {
  if (!isPlainObject(action)) {
    throw new Error("[GAME_LOGIC] action muss Plain-Object sein.");
  }

  const type = coerceString(action.type, "action.type");
  const payload = action.payload === undefined ? {} : action.payload;
  if (!isPlainObject(payload)) {
    throw new Error("[GAME_LOGIC] action.payload muss Plain-Object sein.");
  }

  return { type, payload };
}

export function readState(state) {
  if (!isPlainObject(state)) {
    throw new Error("[GAME_LOGIC] state muss Plain-Object sein.");
  }

  return state;
}
