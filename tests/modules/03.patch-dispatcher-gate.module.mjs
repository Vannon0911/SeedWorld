import path from "node:path";
import { pathToFileURL } from "node:url";

export const id = "03-patch-dispatcher-gate";

export async function run({ assert, root }) {
  const kernel = await import(pathToFileURL(path.join(root, "src/kernel/interface.js")));

  let blockedFormat = false;
  try {
    await kernel.executeKernelCommand("patch.plan", {
      patched: false,
      patch: {
        patchId: "bad-format",
        target: "kernel",
        operations: [{ op: "addFunction", name: "x" }]
      }
    });
  } catch (error) {
    blockedFormat = String(error.message).includes("[PATCH_GATE][BLOCKED_FORMAT]");
  }
  assert(blockedFormat, "Falsches Format muss geblockt werden");

  const riskyPatch = {
    patched: true,
    patch: {
      patchId: "risk-1",
      target: "kernel",
      operations: [
        {
          op: "addFunction",
          name: "newPlanner",
          linksTo: ["executeKernelCommand"]
        }
      ]
    }
  };

  const plan = await kernel.executeKernelCommand("patch.plan", riskyPatch);
  assert(plan.status === "needs_confirmation", "Riskanter Patch muss Bestaetigung verlangen");
  assert(plan.analysis.directLinks.length > 0, "Direktverknuepfung muss gemeldet werden");

  let blockedApplyNoConfirm = false;
  try {
    await kernel.executeKernelCommand("patch.apply", riskyPatch);
  } catch (error) {
    blockedApplyNoConfirm = String(error.message).includes("[PATCH_GATE][CONFIRMATION_REQUIRED]");
  }
  assert(blockedApplyNoConfirm, "Apply ohne Bestaetigung muss blockieren");

  const applied = await kernel.executeKernelCommand("patch.apply", {
    ...riskyPatch,
    confirmation: {
      token: plan.confirmationToken,
      accept: true
    }
  });

  assert(applied.status === "applied", "Patch muss mit gueltiger Bestaetigung angewendet werden");

  const state = await kernel.executeKernelCommand("patch.state", {});
  assert(state.appliedPatchIds.includes("risk-1"), "Angewendeter Patch muss im State auftauchen");

  const conflictPatch = {
    patched: true,
    patch: {
      patchId: "conflict-1",
      target: "kernel",
      operations: [{ op: "addFunction", name: "newPlanner" }]
    }
  };

  const conflictPlan = await kernel.executeKernelCommand("patch.plan", conflictPatch);
  assert(conflictPlan.status === "needs_confirmation", "Konflikt-Patch muss Bestaetigung verlangen");
  assert(conflictPlan.analysis.conflicts.length > 0, "Konflikt muss gemeldet werden");
}
