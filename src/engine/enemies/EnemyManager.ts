import type { EnemySpawnDef } from "../../shared/types";
import type { DamageSystem } from "../combat/DamageSystem";
import type { Enemy } from "./Enemy";
import { EnemyFactory } from "./EnemyFactory";

/** Mantém os inimigos vivos do episódio: cria, atualiza e remove os mortos. */
export class EnemyManager {
  private readonly enemies: Enemy[] = [];

  constructor(
    private readonly factory: EnemyFactory,
    private readonly damage: DamageSystem,
  ) {}

  spawnAll(spawns: readonly EnemySpawnDef[]): void {
    EnemyFactory.validateTypes(spawns);
    for (const spawn of spawns) {
      const enemy = this.factory.create(spawn);
      this.enemies.push(enemy);
      this.damage.register(enemy);
    }
  }

  get all(): readonly Enemy[] {
    return this.enemies;
  }

  get aliveCount(): number {
    return this.enemies.filter((e) => e.isAlive).length;
  }

  update(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]!;
      enemy.update(dt);
      if (enemy.removable) {
        this.damage.unregister(enemy);
        enemy.dispose();
        this.enemies.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const enemy of this.enemies) {
      this.damage.unregister(enemy);
      enemy.dispose();
    }
    this.enemies.length = 0;
  }
}
