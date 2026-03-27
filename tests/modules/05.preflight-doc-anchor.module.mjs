import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { withRepoLock } from "../../tools/runtime/repoLock.mjs";

const execFileAsync = promisify(execFile);

export const id = "05-preflight-doc-anchor-gate";

async function runPreflight(root) {
  return execFileAsync("node", [path.join(root, "tools/runtime/preflight.mjs")], { cwd: root });
}

export async function run({ assert, root }) {
  await withRepoLock(root, async () => {
    const specPath = path.join(root, "docs/KERNEL_SPEC.md");
    const original = await readFile(specPath, "utf8");

    const mutated = original.replace(
      "### ANCHOR: KERNEL-GUARDS",
      "### ANCHOR: KERNEL_GUARDS_REMOVED"
    );

    assert(mutated !== original, "Testmutation fuer Dokumentations-Anchor muss greifen");

    await writeFile(specPath, mutated, "utf8");
    try {
      let failed = false;
      try {
        await runPreflight(root);
      } catch (error) {
        const output = `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`;
        failed = output.includes("[PREFLIGHT][DOC_MISSING]");
      }

      assert(failed, "Fehlender Doc-Anchor muss vom Preflight geblockt werden");
    } finally {
      await writeFile(specPath, original, "utf8");
    }
  });
}
