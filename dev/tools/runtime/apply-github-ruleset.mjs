import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// This payload uses the classic branch protection REST API even though the JSON
// is stored under .github/rulesets for repo governance discoverability.
const RULESET_PATH = ".github/rulesets/main-protection.json";
const TARGET_BRANCH = "main";

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`.trim());
  }
  return result;
}

function gh(args, opts) {
  return run("gh", args, opts);
}

function getRepoPath() {
  const out = gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  const repo = String(out.stdout || "").trim();
  if (!repo || !repo.includes("/")) {
    throw new Error("cannot resolve current GitHub repository (nameWithOwner)");
  }
  return repo;
}

function validatePayload(rawJson) {
  const payload = JSON.parse(rawJson);
  if (!payload || typeof payload !== "object") {
    throw new Error(`invalid ruleset payload in ${RULESET_PATH}`);
  }
  return payload;
}

function main() {
  const repo = getRepoPath();
  validatePayload(readFileSync(RULESET_PATH, "utf8"));

  gh([
    "api",
    "--method",
    "PUT",
    `repos/${repo}/branches/${TARGET_BRANCH}/protection`,
    "-H",
    "Accept: application/vnd.github+json",
    "--input",
    RULESET_PATH
  ]);

  gh([
    "api",
    "--method",
    "POST",
    `repos/${repo}/branches/${TARGET_BRANCH}/protection/required_signatures`,
    "-H",
    "Accept: application/vnd.github+json"
  ]);

  console.log(`[GITHUB_PROTECTION] applied branch=${TARGET_BRANCH} repo=${repo} signed_commits=required`);
}

main();
