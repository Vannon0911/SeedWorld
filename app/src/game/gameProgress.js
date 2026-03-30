import { PROGRESSION_LEVELS, REWARD_DEFINITIONS } from "./gameConfig.js";

function readCount(state, root, key) {
  const branch = state[root];
  if (!branch || typeof branch !== "object") {
    return 0;
  }

  const value = branch[key];
  return Number.isFinite(value) ? value : 0;
}

export function buildProgressSnapshot(state) {
  const resources = {
    ore: readCount(state, "resources", "ore"),
    copper: readCount(state, "resources", "copper"),
    iron: readCount(state, "resources", "iron"),
    gears: readCount(state, "resources", "gears")
  };
  const machines = {
    miners: readCount(state, "machines", "miners"),
    conveyors: readCount(state, "machines", "conveyors"),
    assemblers: readCount(state, "machines", "assemblers")
  };
  const logistics = {
    storageA: readCount(state, "logistics", "storageA"),
    storageB: readCount(state, "logistics", "storageB")
  };

  const resourceTotal = Object.values(resources).reduce((sum, value) => sum + value, 0);
  const machineTotal = Object.values(machines).reduce((sum, value) => sum + value, 0);
  const logisticsTotal = Object.values(logistics).reduce((sum, value) => sum + value, 0);
  const score = resourceTotal + machineTotal * 12 + logisticsTotal * 4;

  let levelIndex = 0;
  for (let i = 0; i < PROGRESSION_LEVELS.length; i += 1) {
    if (score >= PROGRESSION_LEVELS[i].threshold) {
      levelIndex = i;
    }
  }

  const level = PROGRESSION_LEVELS[levelIndex];
  const nextLevel = PROGRESSION_LEVELS[levelIndex + 1] || null;
  const progressToNext = nextLevel
    ? Math.max(0, Math.min(1, (score - level.threshold) / (nextLevel.threshold - level.threshold)))
    : 1;

  const earnedRewards = REWARD_DEFINITIONS.filter((reward) => reward.when({ resources, machines, logistics }));
  const focus =
    machines.assemblers > 0
      ? "Grow throughput with more logistics."
      : machines.conveyors > 0
        ? "Connect output into assembler readiness."
        : machines.miners > 0
          ? "Bridge mining into transport."
          : "Start with the first production node.";

  return {
    score,
    level: {
      id: level.id,
      title: level.title,
      threshold: level.threshold
    },
    nextLevel: nextLevel
      ? {
          id: nextLevel.id,
          title: nextLevel.title,
          threshold: nextLevel.threshold
        }
      : null,
    progressToNext,
    resourceTotal,
    machineTotal,
    logisticsTotal,
    resources,
    machines,
    logistics,
    earnedRewards: earnedRewards.map((reward) => ({
      id: reward.id,
      title: reward.title,
      description: reward.description
    })),
    focus
  };
}

export function buildRewardFeedback(beforeState, afterState, summary = null) {
  const beforeSnapshot = buildProgressSnapshot(beforeState);
  const afterSnapshot = buildProgressSnapshot(afterState);
  const scoreDelta = afterSnapshot.score - beforeSnapshot.score;
  const levelDelta =
    PROGRESSION_LEVELS.findIndex((entry) => entry.id === afterSnapshot.level.id) -
    PROGRESSION_LEVELS.findIndex((entry) => entry.id === beforeSnapshot.level.id);

  const newlyEarnedRewards = afterSnapshot.earnedRewards.filter(
    (reward) => !beforeSnapshot.earnedRewards.some((entry) => entry.id === reward.id)
  );

  const headline =
    levelDelta > 0
      ? `Milestone unlocked: ${afterSnapshot.level.title}`
      : scoreDelta > 0
        ? `Progress +${scoreDelta}`
        : "No new reward";

  const details = [];
  if (summary?.action) {
    details.push(`Action: ${summary.action}`);
  }
  details.push(`Level: ${beforeSnapshot.level.title} -> ${afterSnapshot.level.title}`);
  details.push(`Score: ${beforeSnapshot.score} -> ${afterSnapshot.score}`);
  if (newlyEarnedRewards.length > 0) {
    details.push(`Unlocked: ${newlyEarnedRewards.map((reward) => reward.title).join(", ")}`);
  }
  details.push(`Focus: ${afterSnapshot.focus}`);

  return {
    headline,
    details,
    scoreDelta,
    levelDelta,
    level: afterSnapshot.level,
    nextLevel: afterSnapshot.nextLevel,
    progressToNext: afterSnapshot.progressToNext,
    earnedRewards: afterSnapshot.earnedRewards,
    newlyEarnedRewards,
    focus: afterSnapshot.focus,
    summary
  };
}
