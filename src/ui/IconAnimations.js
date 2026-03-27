/**
 * IconAnimations.js
 * Re-exportiert Spielkonstanten und Tick-Logik aus der game-Domain.
 * Eigene UI-Animation-Logik kann hier ergänzt werden.
 */
export {
  TICKS_PER_SECOND,
  MS_PER_TICK,
  ORE_PER_MINER_CYCLE,
  SMELTER_INPUT_ORE,
  SMELTER_OUTPUT_IRON,
  BASE_STORAGE_CAPACITY,
  STORAGE_CAPACITY_BONUS,
  getStorageCapacity,
  advanceTickState
} from "../game/gameConstants.js";
