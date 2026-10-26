import type { Scene, ShadowGenerator, Vector3 } from "@babylonjs/core";
import type { EnemySpawnDef } from "../../shared/types";
import type { CombatTarget } from "../combat/CombatTypes";
import type { DamageSystem } from "../combat/DamageSystem";
import { AttackCoordinator } from "./AttackCoordinator";
import type { Enemy } from "./Enemy";
import { DEFAULT_ATTACK_COORDINATOR_CONFIG } from "./EnemyConfig";
import { EnemyFactory } from "./EnemyFactory";

export interface EnemyManagerDeps {
  scene: Scene;
  shadows: ShadowGenerator | null;
  damage: DamageSystem;
  player: CombatTarget;
}

/** Mantém os inimigos do episódio: cria, coordena os ataques, atualiza e remove os mortos. */
export class EnemyManager {
  readonly coordinator = new AttackCoordinator(DEFAULT_ATTACK_COORDINATOR_CONFIG);
  private readonly enemies: Enemy[] = [];
  private spawned = 0;
  private readonly factory: EnemyFactory;
  private readonly damage: DamageSystem;

  constructor(deps: EnemyManagerDeps) {
    this.damage = deps.damage;
    this.factory = new EnemyFactory({
      scene: deps.scene,
      shadows: deps.shadows,
      damage: deps.damage,
      coordinator: this.coordinator,
      player: deps.player,
      neighborsOf: (enemy) => this.neighborsOf(enemy),
      allyEngagedWithin: (enemy, radius) => this.allyEngagedWithin(enemy, radius),
    });
  }

  spawnAll(spawns: readonly EnemySpawnDef[]): void {
    EnemyFactory.validateTypes(spawns);
    for (const spawn of spawns) {
      const enemy = this.factory.create(spawn);
      this.enemies.push(enemy);
      this.damage.register(enemy);
    }
    this.spawned += spawns.length;
  }

  /** Quantos inimigos o episódio criou no total (vivos ou não). */
  get spawnedCount(): number {
    return this.spawned;
  }

  /** Inimigos vivos voltam ao ponto inicial (renascimento do jogador). */
  resetAliveToSpawn(): void {
    for (const e of this.enemies) e.resetToSpawn();
  }

  get all(): readonly Enemy[] {
    return this.enemies;
  }

  get aliveCount(): number {
    return this.enemies.filter((e) => e.isAlive).length;
  }

  update(dt: number): void {
    this.coordinator.update(dt);
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

  private allyEngagedWithin(self: Enemy, radius: number): boolean {
    const me = self.feetPosition;
    return this.enemies.some(
      (e) => e !== self && e.isEngaged && Math.hypot(e.feetPosition.x - me.x, e.feetPosition.z - me.z) <= radius,
    );
  }

  private *neighborsOf(self: Enemy): Iterable<Readonly<Vector3>> {
    for (const e of this.enemies) if (e !== self && e.isAlive) yield e.feetPosition;
  }
}
