import type { Scene, ShadowGenerator, TransformNode, Vector3 } from "@babylonjs/core";
import type { EnemySpawnDef, EnemyStats } from "../../shared/types";
import type { MovementConfig } from "../character/CharacterConfig";
import { CharacterMotor, createMoveIntent } from "../character/CharacterMotor";
import type { CombatTarget, HitInfo, HitOutcome } from "../combat/CombatTypes";
import type { DamageSystem } from "../combat/DamageSystem";
import { Hitbox } from "../combat/Hitbox";
import { CollisionLayers } from "../core/CollisionLayers";
import { DEFAULT_MOVEMENT_CONFIG } from "../player/PlayerConfig";
import type { AttackCoordinator } from "./AttackCoordinator";
import type { EnemyTypeConfig } from "./EnemyConfig";
import { EnemyStateMachine } from "./EnemyStateMachine";
import { EnemyVisual } from "./EnemyVisual";
import type { EnemyContext } from "./states/EnemyState";

export interface EnemyDeps {
  scene: Scene;
  shadows: ShadowGenerator | null;
  damage: DamageSystem;
  coordinator: AttackCoordinator;
  player: CombatTarget;
  /** Pés dos outros inimigos vivos. */
  neighborsOf(enemy: Enemy): Iterable<Readonly<Vector3>>;
  /** Grito de alerta ouvido pelos aliados desprevenidos no raio. */
  shout(from: Enemy, radius: number): void;
}

/** Inimigo criado a partir do encounters.json, com IA por máquina de estados. */
export class Enemy implements CombatTarget {
  readonly id: string;
  readonly faction = "enemy" as const;
  readonly hurtRadius: number;
  readonly hurtHeight: number;
  readonly lockOnHeight: number;
  readonly stats: EnemyStats;
  readonly hitbox = new Hitbox();

  private readonly motor: CharacterMotor;
  private readonly visual: EnemyVisual;
  private readonly ctx: EnemyContext;
  private readonly machine: EnemyStateMachine;
  private health: number;
  private flashTimer = 0;
  private readonly spawnPoint: EnemySpawnDef["position"];

  constructor(spawn: EnemySpawnDef, private readonly type: EnemyTypeConfig, deps: EnemyDeps) {
    this.id = spawn.id;
    this.spawnPoint = { ...spawn.position };
    this.stats = { ...spawn.stats };
    this.health = spawn.stats.health;
    this.hurtRadius = type.shape.radius;
    this.hurtHeight = type.shape.height;
    this.lockOnHeight = type.shape.height * 0.7;

    const movement: MovementConfig = { ...DEFAULT_MOVEMENT_CONFIG, walkSpeed: spawn.stats.speed, runSpeed: spawn.stats.speed };
    this.motor = new CharacterMotor(deps.scene, spawn.position, type.shape, movement, CollisionLayers.ENEMY);
    this.visual = new EnemyVisual(deps.scene, `enemy_${spawn.id}`, type);
    for (const m of this.visual.shadowCasters) deps.shadows?.addShadowCaster(m);

    this.ctx = {
      token: this,
      motor: this.motor,
      type,
      stats: this.stats,
      intent: createMoveIntent(),
      hitbox: this.hitbox,
      damage: deps.damage,
      coordinator: deps.coordinator,
      player: deps.player,
      neighbors: () => deps.neighborsOf(this),
      shout: (radius) => deps.shout(this, radius),
      action: null,
      attackCooldown: 0,
      removable: false,
    };
    this.machine = new EnemyStateMachine(this.ctx);
    this.syncVisual();
  }

  get isAlive(): boolean {
    return this.machine.current.name !== "Dead";
  }

  /** Desprevenido: não sabe do jogador (vulnerável ao abate furtivo). */
  get isUnaware(): boolean {
    return this.machine.current.name === "Idle";
  }

  /** Ouviu o grito de um aliado: se estava desprevenido, entra na luta (e grita também). */
  hearShout(): void {
    if (!this.isUnaware || !this.ctx.player.isAlive) return;
    // Troca de estado antes de gritar (senão o eco voltaria para ele em loop).
    this.machine.change("Chase");
    this.ctx.shout(this.type.ai.alertRadius);
  }

  /** Lutando = percebeu o jogador (qualquer estado vivo exceto Idle). */
  get isEngaged(): boolean {
    const name = this.machine.current.name;
    return name !== "Idle" && name !== "Dead";
  }

  /** Nome do estado para depuração (ex.: "Chase (ronda)"). */
  get stateLabel(): string {
    const { name, detail } = this.machine.current;
    return detail ? `${name} (${detail})` : name;
  }

  get currentHealth(): number {
    return this.health;
  }

  get maxHealth(): number {
    return this.stats.health;
  }

  /** Nó acima da cabeça (barra de vida flutuante). */
  get headAnchor(): TransformNode {
    return this.visual.headAnchor;
  }

  /** Volta ao ponto inicial, em Idle (usado quando o jogador renasce). Mantém a vida perdida. */
  resetToSpawn(): void {
    if (!this.isAlive) return;
    this.ctx.coordinator.release(this);
    this.ctx.attackCooldown = 0;
    this.motor.teleport(this.spawnPoint);
    this.machine.change("Idle");
    this.syncVisual();
  }

  /** Morto e já caído há tempo suficiente: pode ser removido da cena. */
  get removable(): boolean {
    return this.ctx.removable;
  }

  get feetPosition(): Readonly<Vector3> {
    return this.motor.feetPosition;
  }

  receiveHit(hit: HitInfo): HitOutcome {
    if (!this.isAlive) return "ignored";
    // Abate furtivo (ex.: flecha em quem não sabe do jogador): morre na hora e em silêncio.
    if (hit.stealthKill && this.isUnaware) {
      this.health = 0;
      this.flashTimer = this.type.hitFlashDuration;
      this.machine.change("Dead", { hit });
      return "killed";
    }

    this.health = Math.max(0, this.health - hit.damage);
    this.flashTimer = this.type.hitFlashDuration;
    const killed = this.health <= 0;
    // Golpe interrompe qualquer ação (inclusive a preparação do ataque).
    if (killed) this.machine.change("Dead", { hit });
    else this.machine.change("HitStun", { hit });
    // Ferido grita (inclusive ao morrer): aliados desprevenidos próximos entram na luta.
    this.ctx.shout(this.type.ai.alertRadius);
    return killed ? "killed" : "hit";
  }

  update(dt: number): void {
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.machine.update(dt);
    this.motor.step(dt, this.ctx.intent);
    this.syncVisual();
  }

  dispose(): void {
    this.ctx.coordinator.release(this);
    this.visual.dispose();
    this.motor.dispose();
  }

  private syncVisual(): void {
    this.visual.root.position.copyFrom(this.motor.feetPosition);
    this.visual.root.rotation.y = this.motor.facingYaw;
    this.visual.update(this.ctx.action, this.flashTimer > 0);
  }
}
