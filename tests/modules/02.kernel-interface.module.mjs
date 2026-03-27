import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { withRepoLock } from "../../tools/runtime/repoLock.mjs";

const execFileAsync = promisify(execFile);

export const id = "02-kernel-single-interface-enforcement";

async function runPreflight(root) {
  return execFileAsync("node", [path.join(root, "tools/runtime/preflight.mjs")], { cwd: root });
}

export async function run({ assert, root }) {
  await withRepoLock(root, async () => {
    const mainPath = path.join(root, "src/main.js");
    const original = await readFile(mainPath, "utf8");

    assert(original.includes("./kernel/interface.js"), "App muss die Kernel-Schnittstelle verwenden");

    const injected = original.replace("./kernel/interface.js", "./kernel/deterministicKernel.js");
    await writeFile(mainPath, injected, "utf8");

    let blocked = false;
    try {
      await runPreflight(root);
    } catch (error) {
      const output = `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`;
      blocked = output.includes("[PREFLIGHT][KERNEL_INTERFACE_BREACH]");
    } finally {
      await writeFile(mainPath, original, "utf8");
    }

    assert(blocked, "Direkter Kernel-Import muss vom Preflight geblockt werden");

    const sneaky = `${original}\nconst sneakyKernelPath = "./kernel/" + "deterministicKernel.js";\n`;
    await writeFile(mainPath, sneaky, "utf8");

    let sneakyBlocked = false;
    try {
      await runPreflight(root);
    } catch (error) {
      const output = `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`;
      sneakyBlocked = output.includes("[PREFLIGHT][KERNEL_INTERFACE_BREACH]");
    } finally {
      await writeFile(mainPath, original, "utf8");
    }

    assert(sneakyBlocked, "Zusammengesetzter Kernel-Import muss vom Preflight geblockt werden");

    const ok = await runPreflight(root);
    assert(ok.stdout.includes("[PREFLIGHT] OK"), "Preflight muss nach Restore wieder OK sein");
  });
}
