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
import { Perception, type Corpse, type StealthTarget } from "./Perception";
import type { EnemyContext } from "./states/EnemyState";

export interface EnemyDeps {
  scene: Scene;
  shadows: ShadowGenerator | null;
  damage: DamageSystem;
  coordinator: AttackCoordinator;
  player: CombatTarget & StealthTarget;
  /** Pés dos outros inimigos vivos. */
  neighborsOf(enemy: Enemy): Iterable<Readonly<Vector3>>;
  /** Grito de alerta ouvido pelos aliados desprevenidos no raio. */
  shout(from: Enemy, radius: number): void;
  /** Corpos de aliados no chão (para serem encontrados). */
  corpses(): Iterable<Corpse>;
}

/** Nível de consciência sobre o jogador (para indicadores ? / !). */
export type AwarenessLevel = "unaware" | "suspicious" | "alert";

/** Estados em que o inimigo está em combate (sabe onde o jogador está). */
const COMBAT_STATES: ReadonlySet<string> = new Set(["Chase", "Attack", "HitStun"]);

/** Inimigo criado a partir do encounters.json, com IA por máquina de estados e percepção. */
export class Enemy implements CombatTarget, Corpse {
  readonly id: string;
  readonly faction = "enemy" as const;
  readonly hurtRadius: number;
  readonly hurtHeight: number;
  readonly lockOnHeight: number;
  readonly stats: EnemyStats;
  readonly hitbox = new Hitbox();
  readonly perception: Perception;

  private readonly motor: CharacterMotor;
  private readonly visual: EnemyVisual;
  private readonly ctx: EnemyContext;
  private readonly machine: EnemyStateMachine;
  private readonly corpses: () => Iterable<Corpse>;
  private health: number;
  private flashTimer = 0;
  /** Tempo desde que ficou em alerta (para o "!" aparecer só no começo). */
  private _alertAge = Infinity;

  constructor(spawn: EnemySpawnDef, private readonly type: EnemyTypeConfig, deps: EnemyDeps) {
    this.id = spawn.id;
    this.stats = { ...spawn.stats };
    this.health = spawn.stats.health;
    this.hurtRadius = type.shape.radius;
    this.hurtHeight = type.shape.height;
    this.lockOnHeight = type.shape.height * 0.7;
    this.corpses = deps.corpses;

    const movement: MovementConfig = { ...DEFAULT_MOVEMENT_CONFIG, walkSpeed: spawn.stats.speed, runSpeed: spawn.stats.speed };
    this.motor = new CharacterMotor(deps.scene, spawn.position, type.shape, movement, CollisionLayers.ENEMY);
    const homeYaw = ((spawn.facing ?? 0) * Math.PI) / 180;
    this.motor.snapFacing(homeYaw);
    this.visual = new EnemyVisual(deps.scene, `enemy_${spawn.id}`, type);
    for (const m of this.visual.shadowCasters) deps.shadows?.addShadowCaster(m);
    this.perception = new Perception(deps.scene, type.ai.perception, this.motor, deps.player);

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
      perception: this.perception,
      home: { position: { ...spawn.position }, yaw: homeYaw },
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

  /** Não sabe onde o jogador está (parado ou investigando): vulnerável ao abate furtivo. */
  get isUnaware(): boolean {
    const name = this.machine.current.name;
    return name === "Idle" || name === "Investigate";
  }

  /** Em combate (sabe onde o jogador está). */
  get isEngaged(): boolean {
    return COMBAT_STATES.has(this.machine.current.name);
  }

  get awareness(): AwarenessLevel {
    if (this.isEngaged) return "alert";
    const name = this.machine.current.name;
    if (name === "Investigate" && this.machine.investigateState.searching) return "suspicious";
    return "unaware";
  }

  get alertAge(): number {
    return this._alertAge;
  }

  /** Ouviu o grito de um aliado: se não estava em combate, entra na luta (e grita também). */
  hearShout(): void {
    if (!this.isAlive || !this.isUnaware || !this.ctx.player.isAlive) return;
    this.perception.becomeCertain(this.ctx.player.feetPosition);
    this.becomeAlert();
  }

  /** Ouviu um barulho (ex.: flecha batendo no cenário): desconfia e vai ver. */
  hearNoise(at: Readonly<Vector3>): void {
    if (!this.isAlive || !this.isUnaware) return;
    this.perception.hearNoise(at);
  }

  /** Nome do estado para depuração (ex.: "Chase (ronda)"). */
  get stateLabel(): string {
    const { name, detail } = this.machine.current;
    const meter = this.isUnaware ? ` [${(this.perception.meter * 100).toFixed(0)}%]` : "";
    return (detail ? `${name} (${detail})` : name) + meter;
  }

  get currentHealth(): number {
    return this.health;
  }

  get maxHealth(): number {
    return this.stats.health;
  }

  /** Nó acima da cabeça (barra de vida e indicador ? / !). */
  get headAnchor(): TransformNode {
    return this.visual.headAnchor;
  }

  /** Volta ao posto, desprevenido (usado quando o jogador renasce). Mantém a vida perdida. */
  resetToSpawn(): void {
    if (!this.isAlive) return;
    this.ctx.coordinator.release(this);
    this.ctx.attackCooldown = 0;
    this.motor.teleport(this.ctx.home.position);
    this.motor.snapFacing(this.ctx.home.yaw);
    this.perception.reset();
    this._alertAge = Infinity;
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
    // Abate furtivo (ex.: flecha em quem não sabe onde o jogador está): morre na hora, em silêncio.
    if (hit.stealthKill && this.isUnaware) {
      this.health = 0;
      this.flashTimer = this.type.hitFlashDuration;
      this.machine.change("Dead", { hit });
      return "killed";
    }

    this.health = Math.max(0, this.health - hit.damage);
    this.flashTimer = this.type.hitFlashDuration;
    const killed = this.health <= 0;
    const wasUnaware = this.isUnaware;
    // Golpe interrompe qualquer ação (inclusive a preparação do ataque).
    if (killed) this.machine.change("Dead", { hit });
    else this.machine.change("HitStun", { hit });
    if (!killed) {
      this.perception.becomeCertain(this.ctx.player.feetPosition);
      if (wasUnaware) this._alertAge = 0;
    }
    // Ferido grita (inclusive ao morrer): aliados desprevenidos próximos entram na luta.
    this.ctx.shout(this.type.ai.alertRadius);
    return killed ? "killed" : "hit";
  }

  update(dt: number): void {
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this._alertAge += dt;
    if (this.isAlive) {
      this.perception.update(dt, this.isEngaged, this.corpses());
      this.react();
    }
    this.machine.update(dt);
    this.motor.step(dt, this.ctx.intent);
    this.syncVisual();
  }

  dispose(): void {
    this.ctx.coordinator.release(this);
    this.visual.dispose();
    this.motor.dispose();
  }

  /** Decide, a partir da percepção, se fica desconfiado (investiga) ou entra em alerta. */
  private react(): void {
    if (!this.isUnaware || !this.ctx.player.isAlive) return;
    if (this.perception.certain) {
      this.becomeAlert();
      return;
    }
    const stimulus = this.perception.takeStimulus();
    if (!stimulus || !this.perception.suspicious) return;
    if (this.machine.current.name === "Investigate") this.machine.investigateState.retarget(stimulus);
    else this.machine.change("Investigate", { point: stimulus });
  }

  private becomeAlert(): void {
    this._alertAge = 0;
    // Troca de estado ANTES de gritar: o eco dos aliados não pode alcançá-lo ainda desprevenido.
    this.machine.change("Chase");
    this.ctx.shout(this.type.ai.alertRadius);
  }

  private syncVisual(): void {
    this.visual.root.position.copyFrom(this.motor.feetPosition);
    this.visual.root.rotation.y = this.motor.facingYaw;
    this.visual.update(this.ctx.action, this.flashTimer > 0);
  }
}
