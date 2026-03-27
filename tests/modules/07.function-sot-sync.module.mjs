import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { withRepoLock } from "../../tools/runtime/repoLock.mjs";

const execFileAsync = promisify(execFile);

export const id = "07-function-sot-sync-gate";

async function runPreflight(root) {
  return execFileAsync("node", [path.join(root, "tools/runtime/preflight.mjs")], { cwd: root });
}

async function runSyncDocs(root) {
  return execFileAsync("node", [path.join(root, "tools/runtime/syncDocs.mjs")], { cwd: root });
}

export async function run({ assert, root }) {
  await withRepoLock(root, async () => {
    const targetFile = path.join(root, "src/kernel/seedGuard.js");
    const sotFile = path.join(root, "docs/FUNCTION_SOT.json");
    const lockFile = path.join(root, "docs/trace-lock.json");

    const originalTarget = await readFile(targetFile, "utf8");
    const originalSot = await readFile(sotFile, "utf8");
    const originalLock = await readFile(lockFile, "utf8");

    const markerFunction = "function __functionSotProbe__() { return 'probe'; }";
    const mutatedTarget = `${originalTarget}\n${markerFunction}\n`;
    await writeFile(targetFile, mutatedTarget, "utf8");

    try {
      let unsyncBlocked = false;
      try {
        await runPreflight(root);
      } catch (error) {
        const output = `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`;
        unsyncBlocked = output.includes("[PREFLIGHT][FUNCTION_SOT_UNSYNC]");
      }
      assert(unsyncBlocked, "Preflight muss unsynchrones FUNCTION_SOT blockieren");

      const syncRun = await runSyncDocs(root);
      assert(syncRun.stdout.includes("[FUNCTION_SOT] geschrieben:"), "sync:docs muss FUNCTION_SOT schreiben");

      const afterSyncPreflight = await runPreflight(root);
      assert(afterSyncPreflight.stdout.includes("[PREFLIGHT] OK"), "Preflight muss nach FUNCTION_SOT sync OK sein");
    } finally {
      await writeFile(targetFile, originalTarget, "utf8");
      await writeFile(sotFile, originalSot, "utf8");
      await writeFile(lockFile, originalLock, "utf8");
    }
  });
}
