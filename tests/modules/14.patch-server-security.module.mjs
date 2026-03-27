import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { withRepoLock } from "../../tools/runtime/repoLock.mjs";

export const id = "14-patch-server-control-plane-and-security";

function startPatchServer(root, port) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["patchServer.mjs"], {
      cwd: root,
      env: { ...process.env, PATCH_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Patch server startup timeout. stderr=${stderr}`));
    }, 10_000);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      if (text.includes("[PATCH_SERVER] listening")) {
        clearTimeout(timeout);
        resolve(child);
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Patch server exited before ready. code=${code} stderr=${stderr}`));
    });
  });
}

async function stopPatchServer(child) {
  if (!child) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    child.on("close", () => resolve());
    setTimeout(resolve, 2500);
  });
}

async function apiFetch(port, endpoint, method = "GET", body = null) {
  const res = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function waitSession(port, sessionId) {
  for (let i = 0; i < 120; i += 1) {
    const res = await apiFetch(port, `/api/status?sessionId=${encodeURIComponent(sessionId)}`);
    const status = String(res.json.status || "");
    if (status && status !== "running" && status !== "unknown" && status !== "idle") {
      return res.json;
    }
    await sleep(100);
  }
  throw new Error(`Session timeout: ${sessionId}`);
}

function makeManifest(patches) {
  return {
    meta: {
      version: "security-test",
      gates: { deadmanSeconds: 60 }
    },
    patches
  };
}

export async function run({ assert, root }) {
  await withRepoLock(root, async () => {
    const port = 32000 + (process.pid % 1000);
    let server = null;

    try {
      server = await startPatchServer(root, port);

      const traversalManifest = makeManifest([
        {
          id: "trav-1",
          name: "Traversal attempt",
          type: "file-create",
          file: "../../../tmp/seedworld-breach.txt",
          content: "x"
        }
      ]);

      const traversalStart = await apiFetch(port, "/api/start-session", "POST", {
        inputType: "manifest",
        fileName: "traversal.json",
        manifestText: JSON.stringify(traversalManifest)
      });
      assert(traversalStart.status === 200, "Traversal test session should start.");

      const traversalFinal = await waitSession(port, traversalStart.json.sessionId);
      assert(traversalFinal.status === "failed", "Traversal session must fail.");
      assert(
        String(traversalFinal.error?.message || "").toLowerCase().includes("invalid file path"),
        "Traversal must fail with invalid file path error."
      );

      const commandManifest = makeManifest([
        {
          id: "cmd-1",
          name: "Command injection",
          type: "run-command",
          command: "npm test; rm -rf /tmp/seedworld-x"
        }
      ]);

      const commandStart = await apiFetch(port, "/api/start-session", "POST", {
        inputType: "manifest",
        fileName: "command.json",
        manifestText: JSON.stringify(commandManifest)
      });
      assert(commandStart.status === 200, "Command test session should start.");

      const commandFinal = await waitSession(port, commandStart.json.sessionId);
      assert(commandFinal.status === "failed", "Command injection session must fail.");
      assert(
        String(commandFinal.error?.message || "").toLowerCase().includes("forbidden shell characters"),
        "run-command must block forbidden shell characters."
      );

      const legacyExecute = await apiFetch(port, "/api/execute", "POST", { any: "payload" });
      assert(legacyExecute.status === 404, "Legacy execute endpoint must be removed.");

      const legacyApprove = await apiFetch(port, "/api/execute/approve", "POST", { any: "payload" });
      assert(legacyApprove.status === 404, "Legacy approve endpoint must be removed.");
    } finally {
      await stopPatchServer(server);
    }
  });
}
