export const GOVERNANCE_REPORT_SCHEMA_VERSION = 2;
export const GOVERNANCE_POLICY_ID = "kernel-governance-engine.v2";
export const GOVERNANCE_CLAIM_RULE =
  "Claims are valid only if all verify gates passed and proof artifacts were hashed and cross-checked.";
export const GOVERNANCE_PROOF_MANIFEST_PATH = "runtime/evidence/governance-proof-manifest.json";
export const GOVERNANCE_SOT_PROOF_FILES = Object.freeze([
  "VERSION",
  "app/src/sot/source-of-truth.json",
  "app/src/sot/repo-boundaries.json",
  "app/src/sot/docs-v2.json",
  "app/src/sot/governance-engine.sot.v2.json",
  "app/src/sot/testline-integrity.json"
]);

export const GOVERNANCE_SYNC_STEPS = Object.freeze([
  Object.freeze({ id: "versioning:sync", script: "versioning:sync", type: "sync" }),
  Object.freeze({ id: "docs:v2:sync", script: "docs:v2:sync", type: "sync" }),
  Object.freeze({ id: "test:sync", script: "test:sync", type: "sync" }),
  Object.freeze({ id: "repo:hygiene:sync", script: "repo:hygiene:sync", type: "sync" })
]);

export const GOVERNANCE_VERIFY_STEPS = Object.freeze([
  Object.freeze({ id: "versioning:verify", script: "versioning:verify", type: "verify" }),
  Object.freeze({ id: "governance:policy:verify", script: "governance:policy:verify", type: "verify" }),
  Object.freeze({ id: "tests", script: "test:verify", type: "verify" }),
  Object.freeze({ id: "evidence:verify", script: "evidence:verify", type: "verify" }),
  Object.freeze({ id: "testline:verify", script: "testline:verify", type: "verify" }),
  Object.freeze({ id: "repo:hygiene:verify", script: "repo:hygiene:verify", type: "verify" }),
  Object.freeze({ id: "docs:v2:verify", script: "docs:v2:verify", type: "verify" }),
  Object.freeze({ id: "docs:v2:coverage", script: "docs:v2:coverage", type: "verify" }),
  Object.freeze({ id: "docs:tasks:verify", script: "docs:tasks:verify", type: "verify" }),
  Object.freeze({ id: "governance:coverage:verify", script: "governance:coverage:verify", type: "verify" })
]);

export function createGovernancePipeline({ verifyOnly = false } = {}) {
  if (verifyOnly) {
    return [...GOVERNANCE_VERIFY_STEPS];
  }
  return [...GOVERNANCE_SYNC_STEPS, ...GOVERNANCE_VERIFY_STEPS];
}

export function createGovernanceReportBase({ runMode, repo, environment, startedAt }) {
  return {
    schema_version: GOVERNANCE_REPORT_SCHEMA_VERSION,
    policy: GOVERNANCE_POLICY_ID,
    run_mode: runMode,
    repo,
    environment,
    started_at: startedAt,
    steps: [],
    overall_status: "FAILED",
    failure_step: null
  };
}

function normalizeMode(value) {
  return value === "shadow" ? "shadow" : "enforce";
}

export class KernelGovernanceError extends Error {
  constructor(message, { code, auditId, details } = {}) {
    super(message);
    this.name = "KernelGovernanceError";
    this.code = code || "KERNEL_GOVERNANCE_ERROR";
    this.auditId = auditId || null;
    this.details = details || null;
  }
}

export class KernelGovernanceEngine {
  constructor({ mode = "enforce", maxAuditTrail = 1024 } = {}) {
    this.mode = normalizeMode(mode);
    this.maxAuditTrail = Number.isInteger(maxAuditTrail) && maxAuditTrail > 0 ? maxAuditTrail : 1024;
    this.auditTrail = [];
    this.denyCounter = 0;
  }

  setMode(mode) {
    this.mode = normalizeMode(mode);
  }

  recordAudit(event) {
    this.auditTrail.push(event);
    if (this.auditTrail.length > this.maxAuditTrail) {
      this.auditTrail = this.auditTrail.slice(-this.maxAuditTrail);
    }
    return event;
  }

  deny({ code, reason, domain, actionType }) {
    this.denyCounter += 1;
    const assignedAuditId = `deny-${String(this.denyCounter).padStart(6, "0")}`;
    const event = {
      auditId: assignedAuditId,
      decision: this.mode === "shadow" ? "shadow_deny" : "deny",
      code,
      reason,
      domain,
      actionType
    };
    this.recordAudit(event);
    return new KernelGovernanceError(reason, { code, auditId: assignedAuditId, details: event });
  }
}
