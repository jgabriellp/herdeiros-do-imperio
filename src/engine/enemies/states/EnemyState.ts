import type { Vector3 } from "@babylonjs/core";
import type { EnemyStats } from "../../../shared/types";
import type { CharacterMotor, MoveIntent } from "../../character/CharacterMotor";
import type { CombatTarget, HitInfo } from "../../combat/CombatTypes";
import type { DamageSystem } from "../../combat/DamageSystem";
import type { Hitbox } from "../../combat/Hitbox";
import type { AttackPhase } from "../../player/PlayerVisual";
import type { AttackCoordinator } from "../AttackCoordinator";
import type { EnemyTypeConfig } from "../EnemyConfig";

export type EnemyStateName = "Idle" | "Chase" | "Attack" | "HitStun" | "Dead";

export interface EnemyStateParams {
  Idle: void;
  Chase: void;
  Attack: void;
  HitStun: { hit: HitInfo };
  Dead: { hit: HitInfo };
}

/** Ação em andamento para o visual do inimigo. */
export type EnemyVisualAction =
  | { kind: "attack"; phase: AttackPhase; phaseProgress: number }
  | { kind: "hitStun"; progress: number }
  | { kind: "dead"; elapsed: number };

/** Tudo que os estados do inimigo podem ler/escrever. */
export interface EnemyContext {
  /** Identidade usada nas fichas de ataque. */
  readonly token: object;
  readonly motor: CharacterMotor;
  readonly type: EnemyTypeConfig;
  readonly stats: EnemyStats;
  readonly intent: MoveIntent;
  readonly hitbox: Hitbox;
  readonly damage: DamageSystem;
  readonly coordinator: AttackCoordinator;
  readonly player: CombatTarget;
  /** Pés dos outros inimigos vivos (para não se amontoarem). */
  neighbors(): Iterable<Readonly<Vector3>>;
  /** Algum aliado a até `radius` metros já está lutando? */
  allyEngagedWithin(radius: number): boolean;
  action: EnemyVisualAction | null;
  /** Tempo até poder pedir a vez de atacar de novo. */
  attackCooldown: number;
  /** Morto e já caído há tempo suficiente: pode sair da cena. */
  removable: boolean;
}

export interface EnemyStateChanger {
  change<K extends EnemyStateName>(name: K, ...params: EnemyStateParams[K] extends void ? [] : [EnemyStateParams[K]]): void;
}

export abstract class EnemyState<K extends EnemyStateName = EnemyStateName> {
  abstract readonly name: K;
  protected elapsed = 0;

  constructor(
    protected readonly machine: EnemyStateChanger,
    protected readonly ctx: EnemyContext,
  ) {}

  enter(_params: EnemyStateParams[K]): void {
    this.elapsed = 0;
  }

  abstract update(dt: number): void;

  exit(): void {}

  /** Texto extra para o painel de dev (ex.: "ronda"). */
  get detail(): string {
    return "";
  }

  protected resetIntent(): void {
    const i = this.ctx.intent;
    i.directionX = i.directionZ = i.maxSpeed = 0;
    i.faceYaw = null;
    i.forcedVelocity = null;
    i.turnSharpness = null;
  }

  /** Vetor horizontal até o jogador e a distância. */
  protected toPlayer(): { dx: number; dz: number; dist: number } {
    const me = this.ctx.motor.feetPosition;
    const p = this.ctx.player.feetPosition;
    const dx = p.x - me.x;
    const dz = p.z - me.z;
    return { dx, dz, dist: Math.hypot(dx, dz) };
  }

  /** Devolve a vez de atacar e começa a espera até o próximo ataque. */
  protected finishAttackTurn(): void {
    const { coordinator, token, type } = this.ctx;
    if (!coordinator.holds(token)) return;
    coordinator.release(token);
    const { cooldownMin, cooldownMax } = type.attack;
    this.ctx.attackCooldown = cooldownMin + Math.random() * (cooldownMax - cooldownMin);
  }
}
