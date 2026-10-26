import { SAVE_FORMAT_VERSION, type SaveData } from "../../shared/types";

/** Save de um jogo novo. */
export function createDefaultSave(): SaveData {
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    updatedAt: new Date().toISOString(),
    completedEpisodes: [],
    currentEpisodeId: null,
    currentCheckpointId: null,
    storyFlags: {},
    player: { maxHealth: 100, maxStamina: 100 },
    equipment: { mainHand: null, offHand: null, ranged: null, owned: [] },
  };
}
