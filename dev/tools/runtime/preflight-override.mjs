import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const out = { reason: "" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--reason") {
      out.reason = String(argv[i + 1] || "").trim();
      i += 1;
    }
  }
  return out;
}

function currentHead(root) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    return "NO_HEAD";
  }
  return String(result.stdout || "").trim() || "NO_HEAD";
}

function reasonHash(reason) {
  return createHash("sha256").update(reason).digest("hex");
}

async function readJsonOrDefault(absPath, fallback) {
  try {
    return JSON.parse(await readFile(absPath, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const { reason } = parseArgs(process.argv.slice(2));
  if (!reason) {
    console.error("Usage: npm run preflight:override -- --reason \"<failure reason>\"");
    process.exit(1);
  }

  const root = process.cwd();
  const overridePath = path.join(root, "runtime", ".patch-manager", "preflight-override.json");
  const head = currentHead(root);
  const hash = reasonHash(reason);
  const state = await readJsonOrDefault(overridePath, {});
  const slot = state.preflight || { confirmations: 0, reason: "", reasonHash: "", head: "", updatedAt: null };

  if (slot.reasonHash !== hash || slot.head !== head) {
    slot.confirmations = 0;
  }

  slot.confirmations += 1;
  slot.reason = reason;
  slot.reasonHash = hash;
  slot.head = head;
  slot.updatedAt = new Date().toISOString();
  state.preflight = slot;

  await mkdir(path.dirname(overridePath), { recursive: true });
  await writeFile(overridePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  console.log(`[PREFLIGHT_OVERRIDE] confirmation ${slot.confirmations}/3 saved (head=${head.slice(0, 12)}).`);
  if (slot.confirmations < 3) {
    process.exitCode = 1;
  }
}

await main();
