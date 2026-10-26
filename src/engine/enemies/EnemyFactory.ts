import type { Scene, ShadowGenerator } from "@babylonjs/core";
import type { EnemySpawnDef } from "../../shared/types";
import { GameError } from "../core/GameError";
import { ENEMY_TYPES } from "./EnemyConfig";
import { Enemy } from "./Enemy";

/** Cria inimigos a partir das entradas do encounters.json. */
export class EnemyFactory {
  constructor(
    private readonly scene: Scene,
    private readonly shadows: ShadowGenerator | null,
  ) {}

  /** Confere os tipos antes de criar qualquer coisa, para falhar com mensagem clara. */
  static validateTypes(spawns: readonly EnemySpawnDef[]): void {
    const known = Object.keys(ENEMY_TYPES);
    const problems = spawns
      .filter((s) => !(s.type in ENEMY_TYPES))
      .map((s) => `encounters.json: inimigo "${s.id}" tem tipo desconhecido "${s.type}" (tipos conhecidos: ${known.join(", ")})`);
    if (problems.length > 0) throw new GameError("INVALID_EPISODE", problems.join("\n"));
  }

  create(spawn: EnemySpawnDef): Enemy {
    const type = ENEMY_TYPES[spawn.type];
    if (!type) throw new GameError("INVALID_EPISODE", `Tipo de inimigo desconhecido: "${spawn.type}"`);
    return new Enemy(this.scene, spawn, type, this.shadows);
  }
}
