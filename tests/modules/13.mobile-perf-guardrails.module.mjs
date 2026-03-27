import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { withRepoLock } from "../../tools/runtime/repoLock.mjs";

const execFileAsync = promisify(execFile);

const DEFAULT_PREFLIGHT_BUDGET_MS = 5000;

export const id = "13-mobile-perf-guardrails";

function resolveBudget(rawValue, fallback) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`[PERF_GUARD] Ungueltiges Budget: ${rawValue}`);
  }

  return Math.floor(parsed);
}

async function runPreflight(root, maxMs) {
  return execFileAsync("node", [path.join(root, "tools/runtime/preflight.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      SEEDWORLD_PREFLIGHT_MAX_MS: String(maxMs)
    }
  });
}

export async function run({ assert, root }) {
  await withRepoLock(root, async () => {
    const preflightBudgetMs = resolveBudget(process.env.SEEDWORLD_PREFLIGHT_MAX_MS, DEFAULT_PREFLIGHT_BUDGET_MS);
    const mainPath = path.join(root, "src/main.js");

    const perfStart = process.hrtime.bigint();
    const preflight = await runPreflight(root, preflightBudgetMs);
    const perfDurationMs = Number((process.hrtime.bigint() - perfStart) / 1000000n);

    assert(preflight.stdout.includes("[PREFLIGHT][PERF]"), "Preflight muss Perf-Metrik ausgeben");
    assert(preflight.stdout.includes("[PREFLIGHT] OK"), "Preflight muss im Guardrail-Test gruen sein");
    assert(
      perfDurationMs <= preflightBudgetMs,
      `Preflight-Budget ueberschritten: duration=${perfDurationMs}ms limit=${preflightBudgetMs}ms`
    );

    const originalMain = await readFile(mainPath, "utf8");
    const injectedMain = `${originalMain}\nsetInterval(() => {}, 1000);\n`;
    await writeFile(mainPath, injectedMain, "utf8");

    try {
      let blocked = false;
      try {
        await runPreflight(root, preflightBudgetMs);
      } catch (error) {
        const output = `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`;
        blocked = output.includes("[PREFLIGHT][BACKGROUND_ACTIVITY]");
      }

      assert(blocked, "setInterval in App-Code muss vom Preflight blockiert werden");
    } finally {
      await writeFile(mainPath, originalMain, "utf8");
    }
  });
}
