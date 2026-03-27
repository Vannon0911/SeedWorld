import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { withRepoLock } from "../../tools/runtime/repoLock.mjs";

const execFileAsync = promisify(execFile);

export const id = "04-trace-lock-sync-and-regeneration";

async function runPreflight(root) {
  return execFileAsync("node", [path.join(root, "tools/runtime/preflight.mjs")], { cwd: root });
}

async function runUpdateTraceLock(root) {
  return execFileAsync("node", [path.join(root, "tools/runtime/updateTraceLock.mjs")], { cwd: root });
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

function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

export async function run({ assert, root }) {
  await withRepoLock(root, async () => {
    const targetFile = path.join(root, "src/kernel/fingerprint.js");
    const lockPath = path.join(root, "docs/trace-lock.json");

    const originalFile = await readFile(targetFile, "utf8");
    const originalLock = await readFile(lockPath, "utf8");
    const marker = "// trace-lock sync probe";
    const mutatedFile = `${originalFile}\n${marker}\n`;

    await writeFile(targetFile, mutatedFile, "utf8");

    try {
      await expectPreflightFail(root, "[PREFLIGHT][UNSYNC]");

      const syncRun = await runUpdateTraceLock(root);
      assert(syncRun.stdout.includes("[TRACE_LOCK] geschrieben:"), "Trace-Lock-Generator muss schreiben");

      const mutatedLock = JSON.parse(await readFile(lockPath, "utf8"));
      const mutatedEntry = mutatedLock.files["src/kernel/fingerprint.js"];

      assert(Boolean(mutatedEntry), "Trace-Lock muss den Fingerprint-Trackfile enthalten");
      assert(mutatedEntry.sha256 === sha256Hex(mutatedFile), "Trace-Lock-Hash muss den mutierten Inhalt abbilden");
      assert(
        mutatedEntry.lines.some((line) => line.includes("trace-lock sync probe")),
        "Trace-Lock muss die neue Zeile sichern"
      );

      const okWhileMutated = await runPreflight(root);
      assert(okWhileMutated.stdout.includes("[PREFLIGHT] OK"), "Preflight muss nach Sync auf mutiertem File OK sein");

      await writeFile(targetFile, originalFile, "utf8");
      await expectPreflightFail(root, "[PREFLIGHT][UNSYNC]");

      const restoreRun = await runUpdateTraceLock(root);
      assert(restoreRun.stdout.includes("[TRACE_LOCK] geschrieben:"), "Trace-Lock muss nach Restore erneut geschrieben werden");

      const restored = await runPreflight(root);
      assert(restored.stdout.includes("[PREFLIGHT] OK"), "Preflight muss nach Restore und Resync OK sein");
    } finally {
      await writeFile(targetFile, originalFile, "utf8");
      await writeFile(lockPath, originalLock, "utf8");
    }
  });
}
