import process from "node:process";
import { validatePatchMatrix } from "./patchMatrix.js";

async function main() {
  const root = process.cwd();
  const result = await validatePatchMatrix(root);
  console.log(`[PATCH_MATRIX] OK manifests=${result.count}`);
}

main().catch((error) => {
  console.error(`[PATCH_MATRIX][FAIL] ${error.message}`);
  process.exit(1);
});
