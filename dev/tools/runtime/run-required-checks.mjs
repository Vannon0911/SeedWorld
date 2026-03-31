import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import {
  GOVERNANCE_CLAIM_RULE,
  GOVERNANCE_PROOF_MANIFEST_PATH,
  GOVERNANCE_SOT_PROOF_FILES,
  createGovernancePipeline,
  createGovernanceReportBase
} from "../../../app/src/kernel/GovernanceEngine.js";

const root = process.cwd();
const writeSyncArtifacts = !process.argv.includes("--verify-only");
const reportPath = path.join(root, "runtime", "evidence", "required-check-report.json");

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

function gitValue(args, fallback = "unknown") {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return fallback;
  }
  const value = String(result.stdout || "").trim();
  return value || fallback;
}

function gitRequiredValue(args, field) {
  const value = gitValue(args, "unknown");
  if (!value || value === "unknown") {
    throw new Error(`[REQUIRED_CHECK] missing git metadata: ${field}`);
  }
  return value;
}

function digestText(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function sha256File(absPath) {
  const content = await readFile(absPath);
  return createHash("sha256").update(content).digest("hex");
}

async function runStep(step) {
  const npmCommand = resolveNpmCommand(step.script);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const outputChunks = [];

  return await new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(npmCommand.command, npmCommand.args, {
        cwd: root,
        stdio: ["inherit", "pipe", "pipe"]
      });
    } catch (error) {
      reject({
        ...step,
        command: npmCommand.rendered,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startedMs,
        status: "FAILED",
        exit_code: null,
        output_sha256: digestText(String(error?.message || error)),
        error: String(error?.message || error)
      });
      return;
    }

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      outputChunks.push(text);
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      outputChunks.push(text);
      process.stderr.write(chunk);
    });

    child.on("error", (error) => {
      const endedAt = new Date().toISOString();
      const outputText = outputChunks.join("");
      reject({
        ...step,
        command: npmCommand.rendered,
        started_at: startedAt,
        ended_at: endedAt,
        duration_ms: Date.now() - startedMs,
        status: "FAILED",
        exit_code: null,
        output_sha256: digestText(`${outputText}\n${String(error?.message || error)}`),
        error: String(error?.message || error)
      });
    });

    child.on("close", (code) => {
      const endedAt = new Date().toISOString();
      const outputText = outputChunks.join("");
      const gate = {
        ...step,
        command: npmCommand.rendered,
        started_at: startedAt,
        ended_at: endedAt,
        duration_ms: Date.now() - startedMs,
        status: code === 0 ? "PASSED" : "FAILED",
        exit_code: code,
        output_sha256: digestText(outputText)
      };
      if (code === 0) {
        resolve(gate);
        return;
      }
      reject(gate);
    });
  });
}

async function buildEvidenceSummary() {
  const summaryRel = "runtime/evidence/summary.json";
  const finalRel = "runtime/evidence/final/testline-summary.json";
  const summaryAbs = path.join(root, summaryRel);
  const finalAbs = path.join(root, finalRel);
  return {
    evidence_summary: {
      path: summaryRel,
      sha256: await sha256File(summaryAbs)
    },
    final_testline_summary: {
      path: finalRel,
      sha256: await sha256File(finalAbs)
    }
  };
}

async function buildContractHash({ report, pipeline }) {
  const payload = {
    policy: report.policy,
    run_mode: report.run_mode,
    step_contract: report.execution?.step_contract || "",
    sync_steps: pipeline.filter((item) => item.type === "sync").map((item) => item.id),
    verify_steps: pipeline.filter((item) => item.type === "verify").map((item) => item.id)
  };
  return digestText(JSON.stringify(payload));
}

async function buildSotHashes() {
  const hashes = [];
  for (const relPath of GOVERNANCE_SOT_PROOF_FILES) {
    const absPath = path.join(root, relPath);
    const sha256 = await sha256File(absPath);
    hashes.push({ path: relPath, sha256 });
  }
  return hashes;
}

async function writeProofManifest({ report, evidenceSummary, sotHashes }) {
  const manifestPath = path.join(root, GOVERNANCE_PROOF_MANIFEST_PATH);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  const coverageRel = "runtime/evidence/governance-coverage.json";
  const contractHash = report.contract_hash || digestText(`${report.policy}:${report.run_mode}`);
  const manifest = {
    schema_version: 1,
    policy: report.policy,
    contract_hash: contractHash,
    generated_at: new Date().toISOString(),
    run_mode: report.run_mode,
    repo: report.repo,
    gate_results: report.steps.map((step) => ({
      id: step.id,
      status: step.status,
      output_sha256: step.output_sha256
    })),
    proof: {
      evidence: evidenceSummary,
      sot: sotHashes,
      governance_coverage: {
        path: coverageRel,
        sha256: await sha256File(path.join(root, coverageRel))
      }
    },
    zero_trust: {
      all_verify_steps_passed: report.steps.every((step) => step.status === "PASSED"),
      claim_rule: GOVERNANCE_CLAIM_RULE
    }
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    path: GOVERNANCE_PROOF_MANIFEST_PATH,
    sha256: await sha256File(manifestPath)
  };
}

async function writeReport(report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function main() {
  const startedAt = new Date().toISOString();
  const runMode = writeSyncArtifacts ? "auto-sync-and-verify" : "verify-only";
  const head = gitRequiredValue(["rev-parse", "HEAD"], "head");
  const branch = gitRequiredValue(["rev-parse", "--abbrev-ref", "HEAD"], "branch");
  const report = createGovernanceReportBase({
    runMode,
    repo: {
      head,
      branch
    },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    startedAt
  });
  const pipeline = createGovernancePipeline({ verifyOnly: !writeSyncArtifacts });
  report.execution = {
    total_steps: pipeline.length,
    sync_steps: pipeline.filter((item) => item.type === "sync").map((item) => item.id),
    verify_steps: pipeline.filter((item) => item.type === "verify").map((item) => item.id),
    run_mode: writeSyncArtifacts ? "auto-sync-and-verify" : "verify-only",
    step_contract: "sync (optional) -> verify (mandatory)"
  };
  report.contract_hash = await buildContractHash({ report, pipeline });

  try {
    for (const step of pipeline) {
      const gate = await runStep(step);
      report.steps.push(gate);
    }

    const evidenceSummary = await buildEvidenceSummary();
    const sotHashes = await buildSotHashes();
    const manifestRef = await writeProofManifest({ report, evidenceSummary, sotHashes });
    report.proof = {
      ...evidenceSummary,
      sot: sotHashes,
      manifest: manifestRef
    };
    report.claim_rule = GOVERNANCE_CLAIM_RULE;
    report.overall_status = "PASSED";
    report.finished_at = new Date().toISOString();
    await writeReport(report);
    console.log(
      `[REQUIRED_CHECK] PASS mode=${report.run_mode} proof=${report.proof.final_testline_summary.sha256.slice(0, 12)}`
    );
    console.log(
      `[REQUIRED_CHECK][PROOF] manifest=${manifestRef.sha256.slice(0, 12)} evidence=${report.proof.evidence_summary.sha256.slice(0, 12)} sot=${sotHashes.length}`
    );
  } catch (failedStep) {
    report.steps.push(failedStep);
    report.failure_step = failedStep.id || failedStep.script || "unknown";
    report.finished_at = new Date().toISOString();
    await writeReport(report);
    console.error(`[REQUIRED_CHECK] BLOCK step=${report.failure_step}`);
    process.exit(1);
  }
}

await main();
