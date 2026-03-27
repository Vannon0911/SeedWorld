import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { withRepoLock } from "../../tools/runtime/repoLock.mjs";

const execFileAsync = promisify(execFile);

export const id = "01-redteam-failclosed-and-guard-bypass";

async function runPreflight(root) {
  const preflightPath = path.join(root, "tools/runtime/preflight.mjs");
  return execFileAsync("node", [preflightPath], { cwd: root });
}

async function expectPreflightFail(root, expectedToken) {
  let failed = false;

  try {
    await runPreflight(root);
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`;
    failed = output.includes(expectedToken);
  }

  if (!failed) {
    throw new Error(`Preflight hätte mit ${expectedToken} fehlschlagen müssen.`);
  }
}

async function withTempMutation(filePath, mutate, testFn) {
  const original = await readFile(filePath, "utf8");
  const mutated = mutate(original);

  await writeFile(filePath, mutated, "utf8");
  try {
    await testFn();
  } finally {
    await writeFile(filePath, original, "utf8");
  }
}

export async function run({ assert, root }) {
  await withRepoLock(root, async () => {
    const guards = await import(pathToFileURL(path.join(root, "src/kernel/runtimeGuards.js")));

    let evalBypassBlocked = false;
    try {
      await guards.withDeterminismGuards(() => (0, eval)("Math.random()"));
    } catch (error) {
      evalBypassBlocked = String(error.message).includes("Math.random");
    }
    assert(evalBypassBlocked, "Eval-Bypass auf Math.random muss blockiert werden");

    let functionBypassBlocked = false;
    try {
      await guards.withDeterminismGuards(() => Function("return Date.now()")());
    } catch (error) {
      functionBypassBlocked = String(error.message).includes("Date.now");
    }
    assert(functionBypassBlocked, "Function()-Bypass auf Date.now muss blockiert werden");

    let cryptoBypassBlocked = false;
    try {
      await guards.withDeterminismGuards(() => crypto.getRandomValues(new Uint8Array(4)));
    } catch (error) {
      cryptoBypassBlocked = String(error.message).includes("crypto.getRandomValues");
    }
    assert(cryptoBypassBlocked, "crypto.getRandomValues muss blockiert werden");

    let dateConstructorBypassBlocked = false;
    try {
      await guards.withDeterminismGuards(() => Date.prototype.constructor.now());
    } catch (error) {
      dateConstructorBypassBlocked = String(error.message).includes("Date.now");
    }
    assert(dateConstructorBypassBlocked, "Date.prototype.constructor.now muss blockiert werden");

    let performanceProtoBypassBlocked = true;
    if (globalThis.performance && typeof Object.getPrototypeOf(globalThis.performance)?.now === "function") {
      performanceProtoBypassBlocked = false;
      try {
        await guards.withDeterminismGuards(() => Object.getPrototypeOf(performance).now.call(performance));
      } catch (error) {
        performanceProtoBypassBlocked = String(error.message).includes("performance.now");
      }
    }
    assert(performanceProtoBypassBlocked, "performance.now auf dem Prototype muss blockiert werden");

    let cryptoProtoBypassBlocked = true;
    if (globalThis.crypto && typeof Object.getPrototypeOf(globalThis.crypto)?.getRandomValues === "function") {
      cryptoProtoBypassBlocked = false;
      try {
        await guards.withDeterminismGuards(() =>
          Object.getPrototypeOf(crypto).getRandomValues.call(crypto, new Uint8Array(4))
        );
      } catch (error) {
        cryptoProtoBypassBlocked = String(error.message).includes("crypto.getRandomValues");
      }
    }
    assert(cryptoProtoBypassBlocked, "crypto.getRandomValues auf dem Prototype muss blockiert werden");

    const runtimeGuardsPath = path.join(root, "src/kernel/runtimeGuards.js");
    await withTempMutation(
      runtimeGuardsPath,
      (content) => `${content}\n// redteam unsync probe\n`,
      async () => {
        await expectPreflightFail(root, "[PREFLIGHT][UNSYNC]");
      }
    );

    const kernelPath = path.join(root, "src/kernel/deterministicKernel.js");
    await withTempMutation(
      kernelPath,
      (content) => `${content}\n// redteam forbidden probe Math.random(\n`,
      async () => {
        await expectPreflightFail(root, "[PREFLIGHT][NON_DETERMINISTIC_API]");
      }
    );

    const preflight = await runPreflight(root);
    assert(preflight.stdout.includes("[PREFLIGHT] OK"), "Preflight muss nach Red-Team wieder OK sein");
  });
}
