import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { compareAlpha, listFilesRecursive, sha256Hex, toPosixPath } from "./runtime-shared.mjs";

export const TASK_SCHEMA_VERSION = "2.0.0";

export function docsV2Root(root) {
  return path.join(root, "docs", "V2");
}

export function openTasksRoot(root) {
  return path.join(root, "tem", "tasks", "open");
}

export function archiveTasksRoot(root) {
  return path.join(root, "tem", "tasks", "archive");
}

export function docsV2EvidencePath(root) {
  return path.join(root, "runtime", "evidence", "docs-v2-scan.json");
}

export async function readJson(absPath) {
  return JSON.parse(await readFile(absPath, "utf8"));
}

export async function writeJson(absPath, value) {
  await writeFile(absPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function validateTask(task, relPath = "task") {
  if (!task || typeof task !== "object") {
    throw new Error(`[DOCS_V2] invalid task object in ${relPath}`);
  }
  if (task.schema_version !== TASK_SCHEMA_VERSION) {
    throw new Error(`[DOCS_V2] unsupported schema_version in ${relPath}: ${task.schema_version}`);
  }
  if (!/^[A-Z0-9-]+$/.test(String(task.task_id || ""))) {
    throw new Error(`[DOCS_V2] invalid task_id in ${relPath}`);
  }
  if (!["open", "archived"].includes(String(task.status || ""))) {
    throw new Error(`[DOCS_V2] invalid status in ${relPath}: ${task.status}`);
  }
  if (!Array.isArray(task.scope_paths) || task.scope_paths.length === 0) {
    throw new Error(`[DOCS_V2] missing scope_paths in ${relPath}`);
  }
  if (!["all_scope_paths_touched", "any_scope_path_touched"].includes(String(task.match_policy || ""))) {
    throw new Error(`[DOCS_V2] invalid match_policy in ${relPath}: ${task.match_policy}`);
  }
  if (!Array.isArray(task.source_docs) || task.source_docs.length === 0) {
    throw new Error(`[DOCS_V2] missing source_docs in ${relPath}`);
  }
}

async function loadTaskDir(root, absDir, expectedStatus) {
  const entries = await readdir(absDir, { withFileTypes: true });
  const tasks = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const absPath = path.join(absDir, entry.name);
    const relPath = toPosixPath(path.relative(root, absPath));
    const task = await readJson(absPath);
    validateTask(task, relPath);
    if (task.status !== expectedStatus) {
      throw new Error(`[DOCS_V2] status mismatch in ${relPath}: expected ${expectedStatus} got ${task.status}`);
    }
    tasks.push({
      ...task,
      file_path: relPath
    });
  }
  tasks.sort((a, b) => compareAlpha(a.task_id, b.task_id));
  return tasks;
}

export async function loadOpenTasks(root) {
  return loadTaskDir(root, openTasksRoot(root), "open");
}

export async function loadArchivedTasks(root) {
  return loadTaskDir(root, archiveTasksRoot(root), "archived");
}

function parsePorcelainPath(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  if (trimmed.includes(" -> ")) {
    return trimmed.split(" -> ").pop() || null;
  }
  return trimmed;
}

export async function collectChangedFiles(root) {
  const output = await runGit(root, ["status", "--porcelain"]);
  const changed = new Set();
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2);
    if (status.includes("D")) {
      continue;
    }
    const candidate = parsePorcelainPath(line.slice(3));
    if (!candidate) {
      continue;
    }
    const relCandidate = toPosixPath(candidate);
    const absCandidate = path.join(root, relCandidate);
    if (relCandidate.endsWith("/")) {
      try {
        const nested = await listFilesRecursive(absCandidate);
        for (const absFile of nested) {
          const nestedRel = toPosixPath(path.relative(root, absFile));
          if (!nestedRel.startsWith("runtime/")) {
            changed.add(nestedRel);
          }
        }
        continue;
      } catch {
        changed.add(relCandidate);
        continue;
      }
    }
    if (relCandidate.startsWith("runtime/")) {
      continue;
    }
    changed.add(relCandidate);
  }
  return [...changed].sort(compareAlpha);
}

async function runGit(root, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr.trim() || `git ${args.join(" ")} failed with code ${code}`));
    });
  });
}

export function taskMatchesChangeSet(task, changedFiles) {
  const touched = task.scope_paths.filter((relPath) => changedFiles.includes(relPath));
  const matched =
    task.match_policy === "all_scope_paths_touched"
      ? touched.length === task.scope_paths.length
      : touched.length > 0;
  return {
    matched,
    touched_paths: touched.sort(compareAlpha)
  };
}

export async function archiveTask(root, task, archiveMeta) {
  const fromPath = path.join(root, task.file_path);
  const archiveName = `${task.task_id}.json`;
  const toPath = path.join(archiveTasksRoot(root), archiveName);
  const archivedTask = {
    ...task,
    status: "archived",
    file_path: toPosixPath(path.relative(root, toPath)),
    archived_at: archiveMeta.archived_at,
    archive_reason: archiveMeta.archive_reason,
    archive_changed_files: archiveMeta.archive_changed_files,
    archived_from: task.file_path
  };
  validateTask(archivedTask, task.file_path);
  await writeJson(fromPath, archivedTask);
  await rename(fromPath, toPath);
  return {
    ...archivedTask,
    file_path: toPosixPath(path.relative(root, toPath))
  };
}

export function renderTaskBullet(task) {
  return `- \`${task.task_id}\` ${task.title}`;
}

export function taskDigest(tasks) {
  return sha256Hex(tasks.map((task) => `${task.task_id}:${task.status}:${task.file_path}`).join("|"));
}
