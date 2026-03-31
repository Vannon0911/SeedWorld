import { spawnSync } from "node:child_process";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    ranges: [],
    headOnly: false,
    skipConfig: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--range") {
      const range = argv[++i] || null;
      if (range) {
        args.ranges.push(range);
      }
    } else if (arg === "--head-only") {
      args.headOnly = true;
    } else if (arg === "--skip-config") {
      args.skipConfig = true;
    }
  }
  return args;
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

function readGitValue(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return "";
  }
  return String(result.stdout || "").trim();
}

function ensureHooksPath() {
  const hooksPath = readGitValue(["config", "--get", "core.hooksPath"]);
  if (hooksPath !== ".githooks") {
    throw new Error(`[GOVERNANCE_POLICY] core.hooksPath must be '.githooks' (found '${hooksPath || "<empty>"}')`);
  }
}

function ensureSafeExecHint() {
  const npmExecPath = String(process.env.npm_execpath || "").trim();
  if (!npmExecPath) {
    return;
  }

  if (!path.isAbsolute(npmExecPath) || !npmExecPath.endsWith("npm-cli.js")) {
    throw new Error(`[GOVERNANCE_POLICY] unsafe npm_execpath detected: ${npmExecPath}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const isCi = String(process.env.CI || "").toLowerCase() === "true" || !!process.env.GITHUB_ACTIONS;
  const explicitRanges = args.ranges.length > 0;
  const runtimeReadOnly = String(process.env.RUNTIME_VERIFY_READ_ONLY || "").trim() === "1";
  const signingArgs = ["dev/tools/runtime/signing-guard.mjs", "--allow-empty-range"];
  const defaultRange = "origin/main..HEAD";
  ensureSafeExecHint();
  if (isCi || args.skipConfig) {
    signingArgs.push("--skip-config");
  }
  if (args.headOnly && explicitRanges) {
    throw new Error("[GOVERNANCE_POLICY] use either --head-only or --range, not both");
  }

  if (args.headOnly && !runtimeReadOnly) {
    if (!isCi) {
      ensureHooksPath();
    }
    signingArgs.push("--head-only");
    run(process.execPath, signingArgs, `node ${signingArgs.join(" ")}`);
  } else if (explicitRanges) {
    if (!isCi) {
      ensureHooksPath();
    }
    for (const range of args.ranges) {
      signingArgs.push("--range", range);
    }
    run(process.execPath, signingArgs, `node ${signingArgs.join(" ")}`);
  } else {
    if (!isCi) {
      ensureHooksPath();
    }
    signingArgs.push("--range", defaultRange);
    run(process.execPath, signingArgs, `node ${signingArgs.join(" ")}`);
  }

  const headSubject = readGitValue(["show", "-s", "--format=%s", "HEAD"]);
  if (/^Revert\b/i.test(headSubject)) {
    console.log("[GOVERNANCE_POLICY] rollback parity enforced: revert commits use full required-gate contract");
  }
  const mode = args.headOnly && !runtimeReadOnly
    ? "head-only-contract"
    : explicitRanges
      ? "explicit-range-contract"
      : "origin-main-range-contract";
  console.log(`[GOVERNANCE_POLICY] OK mode=${mode}`);
}

main();
