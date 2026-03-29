import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectReadState, getWorkspacePaths } from "./llm-read-shared.mjs";

function parseArgs(argv) {
  const out = { action: "commit", reason: "" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--action") {
      out.action = String(argv[i + 1] || "commit").toLowerCase();
      i += 1;
    } else if (argv[i] === "--reason") {
      out.reason = String(argv[i + 1] || "").trim();
      i += 1;
    }
  }
  if (!["stage", "commit", "push"].includes(out.action)) {
    out.action = "commit";
  }
  return out;
}

async function readJsonOrDefault(absPath, fallback) {
  try {
    return JSON.parse(await readFile(absPath, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const { action, reason } = parseArgs(process.argv.slice(2));
  if (!reason) {
    console.error("Usage: npm run llm:override -- --action <stage|commit|push> --reason \"<text>\"");
    process.exit(1);
  }

  const root = process.cwd();
  const { overridePath } = getWorkspacePaths(root);
  const current = await collectReadState(root);
  const state = await readJsonOrDefault(overridePath, {});
  const slot = state[action] || { confirmations: 0, reason: "", docsHash: "", updatedAt: null };

  if (slot.reason !== reason || slot.docsHash !== current.combinedHash) {
    slot.confirmations = 0;
  }

  slot.confirmations += 1;
  slot.reason = reason;
  slot.docsHash = current.combinedHash;
  slot.updatedAt = new Date().toISOString();
  state[action] = slot;

  await mkdir(path.dirname(overridePath), { recursive: true });
  await writeFile(overridePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  console.log(`[LLM_OVERRIDE] ${action} confirmation ${slot.confirmations}/3 saved.`);
  if (slot.confirmations < 3) {
    process.exitCode = 1;
  }
}

await main();
