import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFunctionSot } from "./function-sot-shared.mjs";

const root = process.cwd();
const targetPath = path.join(root, "app", "src", "sot", "FUNCTION_SOT.json");
const writeMode = process.argv.includes("--write");

async function main() {
  const sot = await buildFunctionSot(root);
  const expected = `${JSON.stringify(sot, null, 2)}\n`;
  const current = await readFile(targetPath, "utf8").catch(() => "");
  const drift = current !== expected;

  if (writeMode && drift) {
    await writeFile(targetPath, expected, "utf8");
  }

  if (!writeMode && drift) {
    console.error("[FUNCTION_SOT] DRIFT: app/src/sot/FUNCTION_SOT.json ist nicht synchron.");
    console.error("[FUNCTION_SOT] FIX: npm run sot:apply");
    process.exit(1);
    return;
  }

  console.log(`[FUNCTION_SOT] OK (${sot.functions.length} functions, mode=${writeMode ? "write" : "check"})`);
}

await main();
