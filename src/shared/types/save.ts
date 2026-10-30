export const SAVE_FORMAT_VERSION = 2;

export type StoryFlagValue = boolean | number | string;

export interface PlayerAttributes {
  maxHealth: number;
  maxStamina: number;
}

/** Ids de itens equipados (null = slot vazio). `owned` é o inventário. */
export interface EquipmentData {
  mainHand: string | null;
  offHand: string | null;
  ranged: string | null;
  /** Todos os itens que o jogador possui. */
  owned: string[];
}

export interface SaveData {
  /** Versão do formato, usada para migrações. */
  formatVersion: typeof SAVE_FORMAT_VERSION;
  /** ISO 8601 da última alteração. */
  updatedAt: string;
  completedEpisodes: string[];
  currentEpisodeId: string | null;
  currentCheckpointId: string | null;
  /** Flags de história, ex.: { "poupou_vandalo_lider": true }. */
  storyFlags: Record<string, StoryFlagValue>;
  player: PlayerAttributes;
  equipment: EquipmentData;
  /**
   * Itens do mapa já recolhidos, como "episodeId/pickupId" (ex.: "s00e00/pedestal_espada").
   * Evita que reapareçam ao recarregar. (Adicionado na versão 2 do formato.)
   */
  collectedPickups: string[];
}

/**
 * Onde o save é guardado. Hoje: localStorage. No futuro: nuvem.
 * load() devolve o dado cru (pode ser de uma versão antiga); quem migra é o SaveManager.
 */
export interface SaveProvider {
  load(): Promise<unknown | null>;
  save(data: SaveData): Promise<void>;
  clear(): Promise<void>;
}
