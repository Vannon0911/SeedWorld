import { spawnSync } from "node:child_process";

const REQUIRED_FINGERPRINT = "F14A6FC849CF906ED7518584D7EA78B1F7778AFD";
const REQUIRED_SHORT = REQUIRED_FINGERPRINT.slice(-16);

function parseArgs(argv) {
  const args = {
    configOnly: false,
    headOnly: false,
    ranges: [],
    allowEmptyRange: false,
    skipConfig: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config-only") args.configOnly = true;
    else if (arg === "--head-only") args.headOnly = true;
    else if (arg === "--allow-empty-range") args.allowEmptyRange = true;
    else if (arg === "--skip-config") args.skipConfig = true;
    else if (arg === "--range") {
      const range = argv[++i] || null;
      if (range) {
        args.ranges.push(range);
      }
    }
  }
  return args;
}

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.error) {
    if (allowFailure) {
      return result;
    }
    throw new Error(`${command} ${args.join(" ")} failed: ${String(result.error?.message || result.error)}`);
  }
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result;
}

function git(args, opts) {
  return run("git", args, opts);
}

function readGitConfig(key) {
  const out = git(["config", "--get", key], { allowFailure: true });
  if (out.error) {
    throw new Error(`cannot read git config '${key}': ${String(out.error?.message || out.error)}`);
  }
  return out.status === 0 ? String(out.stdout || "").trim() : "";
}

function normalizeHex(value) {
  return String(value || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

function rangeLooksExplicit(value) {
  return /(\.\.|\.{3}|\^!|\^@|\^|\~|--not)/.test(String(value || ""));
}

function resolveDefaultRange() {
  const baseRef = "origin/main";
  const baseExists = git(["rev-parse", "--verify", baseRef], { allowFailure: true });
  if (baseExists.status !== 0) {
    throw new Error(`[SIGNING_GUARD] missing required base ref '${baseRef}'`);
  }
  const headExists = git(["rev-parse", "--verify", "HEAD"], { allowFailure: true });
  if (headExists.status !== 0) {
    throw new Error("[SIGNING_GUARD] missing HEAD commit");
  }
  return `${baseRef}..HEAD`;
}

function ensureConfig() {
  const commitSign = readGitConfig("commit.gpgsign").toLowerCase();
  const tagSign = readGitConfig("tag.gpgsign").toLowerCase();
  const signingKey = readGitConfig("user.signingkey");

  if (commitSign !== "true") {
    throw new Error("commit.gpgsign must be true");
  }
  if (tagSign !== "true") {
    throw new Error("tag.gpgsign must be true");
  }

  const normalizedKey = normalizeHex(signingKey);
  if (!normalizedKey) {
    throw new Error("user.signingkey is missing");
  }
  if (!(normalizedKey === REQUIRED_FINGERPRINT || normalizedKey.endsWith(REQUIRED_SHORT))) {
    throw new Error(`user.signingkey must match ${REQUIRED_FINGERPRINT}`);
  }

}

function resolveCommits(args) {
  if (args.headOnly) {
    const head = String(git(["rev-parse", "HEAD"]).stdout || "").trim();
    return head ? [head] : [];
  }

  const resolvedRanges = args.ranges.length > 0 ? [...args.ranges] : [resolveDefaultRange()];
  if (resolvedRanges.length > 0) {
    const commits = [];
    const seen = new Set();
    for (const range of resolvedRanges) {
      const rangeCommits = rangeLooksExplicit(range)
        ? (() => {
            const list = git(["rev-list", range], { allowFailure: true });
            if (list.status !== 0) {
              throw new Error(`cannot resolve commit range: ${range}`);
            }
            return String(list.stdout || "")
              .split(/\r?\n/)
              .map((x) => x.trim())
              .filter(Boolean);
          })()
        : [String(git(["rev-parse", range], { allowFailure: true }).stdout || "").trim()].filter(Boolean);
      for (const commit of rangeCommits) {
        if (!seen.has(commit)) {
          seen.add(commit);
          commits.push(commit);
        }
      }
    }
    if (commits.length === 0 && args.allowEmptyRange) {
      return [];
    }
    return commits;
  }

  if (args.allowEmptyRange) {
    return [];
  }
  throw new Error("unable to resolve commit range");
}

function verifyCommitSignature(commit) {
  const verify = git(["verify-commit", commit], { allowFailure: true });
  const detail = git(["log", "--show-signature", "-n", "1", "--pretty=format:%H", commit], { allowFailure: true });
  const combined = `${verify.stdout || ""}\n${verify.stderr || ""}\n${detail.stdout || ""}\n${detail.stderr || ""}`;
  const hasGoodSignature = /\b(Good signature|Korrekte Signatur)\b/i.test(combined);
  const hasKnownGpgIoNoise = /\b(keyboxd|Input\/output error)\b/i.test(combined);
  if (!(verify.status === 0 || (hasGoodSignature && hasKnownGpgIoNoise))) {
    throw new Error(`commit ${commit} signature verification command failed`);
  }
  if (!hasGoodSignature) {
    throw new Error(`commit ${commit} has no verifiable GPG signature output`);
  }
  const text = normalizeHex(combined);
  if (!text.includes(REQUIRED_SHORT) && !text.includes(REQUIRED_FINGERPRINT)) {
    throw new Error(`commit ${commit} not signed with required fingerprint suffix ${REQUIRED_SHORT}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.skipConfig) {
    ensureConfig();
  }
  if (args.configOnly) {
    console.log("[SIGNING_GUARD] config OK");
    return;
  }

  const commits = resolveCommits(args);
  if (commits.length === 0) {
    if (args.allowEmptyRange) {
      console.log("[SIGNING_GUARD] no commits to verify");
      return;
    }
    throw new Error("no commits found for verification");
  }

  for (const commit of commits) {
    verifyCommitSignature(commit);
  }
  console.log(`[SIGNING_GUARD] verified ${commits.length} commit(s)`);
}

main();
