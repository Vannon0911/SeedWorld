import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { withRepoLock } from "../../tools/runtime/repoLock.mjs";

const execFileAsync = promisify(execFile);

export const id = "12-blueprint-scope-gate";

async function runPreflight(root) {
  return execFileAsync("node", [path.join(root, "tools/runtime/preflight.mjs")], { cwd: root });
}

function parseOutput(error) {
  return `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`;
}

async function expectPreflightFailure(root, expectedToken) {
  let failed = false;
  try {
    await runPreflight(root);
  } catch (error) {
    failed = parseOutput(error).includes(expectedToken);
  }

  if (!failed) {
    throw new Error(`Preflight muss mit ${expectedToken} fehlschlagen.`);
  }
}

export async function run({ root }) {
  await withRepoLock(root, async () => {
    const policyPath = path.join(root, "docs/BLUEPRINT_SCOPES.json");
    const originalPolicy = await readFile(policyPath, "utf8");
    const baseline = JSON.parse(originalPolicy);
    try {
      const wrongCount = structuredClone(baseline);
      wrongCount.requiredBlueprintCount = 4;
      await writeFile(policyPath, `${JSON.stringify(wrongCount, null, 2)}\n`, "utf8");
      await expectPreflightFailure(root, "[BLUEPRINT_POLICY] Erwartet 4 Blueprints");

      const overlap = structuredClone(baseline);
      overlap.blueprints[1].scopes = overlap.blueprints[1].scopes.slice();
      overlap.blueprints[1].scopes[0] = overlap.blueprints[0].scopes[0];
      await writeFile(policyPath, `${JSON.stringify(overlap, null, 2)}\n`, "utf8");
      await expectPreflightFailure(root, "[BLUEPRINT_SCOPE_OVERLAP]");

      const infeasible = structuredClone(baseline);
      infeasible.blueprints[2].feasibilityCriteria = [
        ...infeasible.blueprints[2].feasibilityCriteria,
        "KRITERIUM_DAS_NICHT_EXISTIERT"
      ];
      await writeFile(policyPath, `${JSON.stringify(infeasible, null, 2)}\n`, "utf8");
      await expectPreflightFailure(root, "[BLUEPRINT_FEASIBILITY]");
    } finally {
      await writeFile(policyPath, originalPolicy, "utf8");
    }
  });
}
