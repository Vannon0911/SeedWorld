import { spawnSync } from "node:child_process";

function resolveNpmCommand(script) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && npmExecPath.endsWith("npm-cli.js")) {
    return {
      command: process.execPath,
      args: [npmExecPath, "run", script],
      rendered: `node ${npmExecPath} run ${script}`
    };
  }
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return {
    command: npmCmd,
    args: ["run", script],
    rendered: `${npmCmd} run ${script}`
  };
}

function run(command, args, rendered) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit"
  });
  if (result.error) {
    throw new Error(`[GOVERNANCE_POLICY] command failed: ${rendered} (${String(result.error?.message || result.error)})`);
  }
  if (result.status !== 0) {
    throw new Error(`[GOVERNANCE_POLICY] command failed (${result.status}): ${rendered}`);
  }
}

function main() {
  const isCi = String(process.env.CI || "").toLowerCase() === "true" || !!process.env.GITHUB_ACTIONS;
  const signingArgs = ["dev/tools/runtime/signing-guard.mjs", "--head-only", "--allow-empty-range"];
  if (isCi) {
    signingArgs.push("--skip-config");
  }
  run(process.execPath, signingArgs, `node ${signingArgs.join(" ")}`);
  const hooks = resolveNpmCommand("hooks:verify");
  run(hooks.command, hooks.args, hooks.rendered);
  console.log(`[GOVERNANCE_POLICY] OK mode=${isCi ? "ci-signature-only" : "local-signature+config"}`);
}

main();
