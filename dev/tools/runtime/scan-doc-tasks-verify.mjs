import { collectChangedFiles, loadOpenTasks, taskMatchesChangeSet } from "./docs-v2-shared.mjs";

const root = process.cwd();

async function main() {
  const changedFiles = await collectChangedFiles(root);
  const openTasks = await loadOpenTasks(root);
  const violating = [];

  for (const task of openTasks) {
    const match = taskMatchesChangeSet(task, changedFiles);
    if (!match.matched) {
      continue;
    }
    violating.push({
      task_id: task.task_id,
      touched_paths: match.touched_paths
    });
  }

  if (violating.length > 0) {
    console.error("[DOCS_TASK_VERIFY] BLOCK: open task scope matched current change-set");
    for (const item of violating) {
      console.error(` - ${item.task_id}: ${item.touched_paths.join(", ")}`);
    }
    console.error("[DOCS_TASK_VERIFY] FIX: run npm run test:sync to archive/sync deterministic docs artifacts");
    process.exit(1);
  }

  console.log(`[DOCS_TASK_VERIFY] OK changed=${changedFiles.length} open_tasks=${openTasks.length}`);
}

await main();
