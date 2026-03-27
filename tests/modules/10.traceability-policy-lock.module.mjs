import { execFile } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { withRepoLock } from "../../tools/runtime/repoLock.mjs";

const execFileAsync = promisify(execFile);

export const id = "10-traceability-policy-lock";

async function runPreflight(root) {
  return execFileAsync("node", [path.join(root, "tools/runtime/preflight.mjs")], { cwd: root });
}

export async function run({ assert, root }) {
  await withRepoLock(root, async () => {
    const tracePath = path.join(root, "docs/TRACEABILITY.json");
    const original = await readFile(tracePath, "utf8");

    const mutated = original.replace(
      "\"KERNEL-ENTRYPOINT\"",
      "\"KERNEL-ENTRYPOINT-BYPASS\""
    );

    assert(mutated !== original, "Testmutation fuer TRACEABILITY muss greifen");

    await writeFile(tracePath, mutated, "utf8");
    try {
      let failed = false;
      try {
        await runPreflight(root);
      } catch (error) {
        const output = `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`;
        failed = output.includes("[PREFLIGHT][TRACEABILITY_UNSYNC]");
      }

      assert(failed, "Manipulierte TRACEABILITY.json muss vom Preflight geblockt werden");
    } finally {
      await writeFile(tracePath, original, "utf8");
    }
  });

  const lockPath = path.join(root, ".seedworld-repo.lock");
  const foreignToken = `foreign-${Date.now()}`;
  await withRepoLock(root, async () => {
    await writeFile(
      lockPath,
      `${JSON.stringify({
        pid: process.pid,
        token: foreignToken,
        acquiredAt: new Date().toISOString()
      })}\n`,
      "utf8"
    );
  });

  const ownerAfterRelease = JSON.parse(await readFile(lockPath, "utf8"));
  assert(ownerAfterRelease.token === foreignToken, "Release darf fremden Lock nicht loeschen");
  await unlink(lockPath);
}
