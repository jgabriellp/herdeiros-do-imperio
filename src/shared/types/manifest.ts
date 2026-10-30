import type { HexColor, Vec3Data } from "./math";

export const MANIFEST_FORMAT_VERSION = 1;

/**
 * Tipos de fase suportados. "type" existe para que outros tipos
 * (ex.: "glb" para cenários modelados) entrem no futuro sem mudar o formato.
 */
export type LevelType = "procedural";

export interface LevelRef {
  type: LevelType;
  /** Caminho relativo à pasta do episódio. */
  file: string;
}

export interface CheckpointDef {
  id: string;
  /** Posição dos pés do jogador. */
  position: Vec3Data;
}

/** manifest.json de um pacote de episódio. */
export interface EpisodeManifest {
  formatVersion: typeof MANIFEST_FORMAT_VERSION;
  /** Formato "sTTeEE", ex.: "s00e00". */
  id: string;
  season: number;
  episode: number;
  title: string;
  description?: string;
  /** Versão do conteúdo do pacote (semver). */
  version: string;
  /**
   * Episódios pré-requisito. O motor apenas lê e valida;
   * quem inicia o jogo (main.ts / plataforma) decide se o episódio pode abrir.
   */
  requires?: string[];
  /** Posição dos pés do jogador ao iniciar o episódio. */
  spawnPoint: Vec3Data;
  /** Ausente = episódio ainda sem conteúdo jogável. */
  level?: LevelRef;
  /** Caminho relativo do encounters.json. */
  encounters?: string;
  checkpoints: CheckpointDef[];
}

// ---------- level.json (type "procedural") ----------

export interface BoxObstacleDef {
  shape: "box";
  /** Centro do objeto. */
  position: Vec3Data;
  size: Vec3Data;
  rotationY?: number;
  color?: HexColor;
  /** Massa > 0 torna o objeto dinâmico (cai, pode ser empurrado). 0/ausente = estático. */
  mass?: number;
}

export interface CylinderObstacleDef {
  shape: "cylinder";
  /** Centro do objeto. */
  position: Vec3Data;
  diameter: number;
  height: number;
  color?: HexColor;
  mass?: number;
}

export type ObstacleDef = BoxObstacleDef | CylinderObstacleDef;

/** Item colocado no mapa; o jogador pega passando por cima. */
export interface PickupDef {
  /** Único no episódio; usado para lembrar no save que já foi pego. */
  id: string;
  /** Id de um item conhecido pelo motor (ex.: "espada_simples"). */
  item: string;
  /** Base do item (onde ele "pousa"). */
  position: Vec3Data;
}

export interface ProceduralLevelData {
  formatVersion: 1;
  ground: { width: number; depth: number; color: HexColor };
  sky: { topColor: HexColor; horizonColor: HexColor };
  lighting: {
    /** Direção em que a luz do sol aponta. */
    sunDirection: Vec3Data;
    sunIntensity: number;
    ambientIntensity: number;
  };
  obstacles: ObstacleDef[];
  pickups?: PickupDef[];
}

// ---------- encounters.json ----------

export interface EnemyStats {
  health: number;
  damage: number;
  speed: number;
}

export interface EnemySpawnDef {
  id: string;
  /** Tipo de inimigo conhecido pelo motor (ex.: "vandalo"). */
  type: string;
  /** Posição dos pés. */
  position: Vec3Data;
  stats: EnemyStats;
}

export interface EncountersData {
  formatVersion: 1;
  enemies: EnemySpawnDef[];
}
