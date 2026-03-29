import { readFile } from "node:fs/promises";
import { REQUIRED_READ_ORDER, collectReadState, getWorkspacePaths } from "./llm-read-shared.mjs";

function parseArgs(argv) {
  const out = { action: "commit" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--action") {
      out.action = String(argv[i + 1] || "commit").toLowerCase();
      i += 1;
    }
  }
  if (!["stage", "commit", "push"].includes(out.action)) {
    out.action = "commit";
  }
  return out;
}

function printTripleWarning(action, reason) {
  const verb = action === "push" ? "PUSHT" : action === "stage" ? "STAGEST" : "COMMITEST";
  for (let i = 1; i <= 3; i += 1) {
    console.error(`[LLM_GUARD][WARN_${i}] ACHTUNG DU ${verb} "${reason}" - das verstoesst auf basis von LLM-ENTRY/POLICY gegen deine Regeln.`);
  }
  console.error("[LLM_GUARD][FINAL] NOCHMAL FUER DUMM: Regelverstoß erkannt - sicher?");
}

async function readJsonOrNull(absPath) {
  try {
    return JSON.parse(await readFile(absPath, "utf8"));
  } catch {
    return null;
  }
}

function hasTripleOverride(overrideState, action, docsHash) {
  const data = overrideState?.[action];
  if (!data || typeof data !== "object") {
    return false;
  }
  return data.confirmations >= 3 && data.docsHash === docsHash;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const { statePath, overridePath } = getWorkspacePaths(root);
  const current = await collectReadState(root);

  const saved = await readJsonOrNull(statePath);
  const overrideState = await readJsonOrNull(overridePath);

  let reason = "";
  if (!saved) {
    reason = `fehlender ACK-Status (${statePath})`;
  } else if (saved.combinedHash !== current.combinedHash) {
    reason = "Pflichtdokumente geaendert seit letztem ACK (Hash-Mismatch)";
  } else {
    const expected = REQUIRED_READ_ORDER.join("|");
    const actual = Array.isArray(saved.requiredReadOrder) ? saved.requiredReadOrder.join("|") : "";
    if (actual !== expected) {
      reason = "Pflicht-Lesereihenfolge unvollstaendig oder ungueltig";
    }
  }

  if (reason) {
    if (hasTripleOverride(overrideState, args.action, current.combinedHash)) {
      console.warn(`[LLM_GUARD] override active for ${args.action} (3/3 confirmations).`);
      return;
    }
    printTripleWarning(args.action, reason);
    console.error(`[LLM_GUARD] FAIL: ${reason}`);
    console.error(`[LLM_GUARD] Bypass nur mit 3x expliziter Bestaetigung: npm run llm:override -- --action ${args.action} --reason "<begruendung>"`);
    process.exit(1);
  }

  console.log(`[LLM_GUARD] OK (${saved.acknowledgedAt}) action=${args.action}`);
}

await main();
