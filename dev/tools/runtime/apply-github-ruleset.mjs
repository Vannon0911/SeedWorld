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

/**
 * Resolve the current GitHub repository identifier in owner/name format.
 * @returns {string} The repository identifier in 'owner/name' format.
 * @throws {Error} If the `gh` CLI does not return a non-empty `nameWithOwner` value containing '/'.
 */
function getRepoPath() {
  const out = gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  const repo = String(out.stdout || "").trim();
  if (!repo || !repo.includes("/")) {
    throw new Error("cannot resolve current GitHub repository (nameWithOwner)");
  }
  return repo;
}

/**
 * Validate and parse the ruleset JSON read from RULESET_PATH.
 *
 * Attempts to parse the provided JSON string and ensures the result is a non-null object.
 * @param {string} rawJson - The raw JSON string read from RULESET_PATH.
 * @returns {Object} The parsed ruleset payload object.
 * @throws {Error} If JSON parsing fails (error message includes RULESET_PATH and original error as `cause`).
 * @throws {Error} If the parsed value is null or not an object.
 */
function validatePayload(rawJson) {
  let payload;
  try {
    payload = JSON.parse(rawJson);
  } catch (error) {
    throw new Error(`Failed to parse ${RULESET_PATH}: ${String(error?.message || error)}`, { cause: error });
  }
  if (!payload || typeof payload !== "object") {
    throw new Error(`invalid ruleset payload in ${RULESET_PATH}`);
  }
  return payload;
}

/**
 * Apply branch protection and require signed commits on the repository's main branch.
 *
 * Reads and validates the ruleset JSON at RULESET_PATH, updates branch protection for TARGET_BRANCH
 * via the GitHub API using that ruleset, enables required commit signatures, and logs the result.
 */
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
