import type { Scene, ShadowGenerator, Vector3 } from "@babylonjs/core";
import type { EnemySpawnDef, EnemyStats } from "../../shared/types";
import type { MovementConfig } from "../character/CharacterConfig";
import { CharacterMotor, createMoveIntent } from "../character/CharacterMotor";
import type { CombatTarget, HitInfo, HitOutcome } from "../combat/CombatTypes";
import { CollisionLayers } from "../core/CollisionLayers";
import { damp, yawFromDirection } from "../core/mathUtils";
import { DEFAULT_MOVEMENT_CONFIG } from "../player/PlayerConfig";
import type { EnemyTypeConfig } from "./EnemyConfig";
import { EnemyVisual } from "./EnemyVisual";

export type EnemyStateName = "Idle" | "HitStun" | "Dead";

/** Inclinação ao ser atingido, para o golpe "pegar" visualmente. */
const HIT_TILT = 0.3;

/**
 * Inimigo criado a partir do encounters.json.
 * Por enquanto PASSIVO (sem IA): recebe golpes, é empurrado, pisca e morre.
 * Perseguir/atacar e a coordenação de grupo chegam na Tarefa 4.
 */
export class Enemy implements CombatTarget {
  readonly id: string;
  readonly faction = "enemy" as const;
  readonly hurtRadius: number;
  readonly hurtHeight: number;
  readonly lockOnHeight: number;
  readonly stats: EnemyStats;

  private readonly motor: CharacterMotor;
  private readonly visual: EnemyVisual;
  private readonly intent = createMoveIntent();
  private readonly knockback = { x: 0, z: 0 };
  private _state: EnemyStateName = "Idle";
  private health: number;
  private stateTime = 0;
  private stunDuration = 0;
  private flashTimer = 0;
  private _removable = false;

  constructor(
    scene: Scene,
    spawn: EnemySpawnDef,
    private readonly type: EnemyTypeConfig,
    shadows: ShadowGenerator | null,
  ) {
    this.id = spawn.id;
    this.stats = { ...spawn.stats };
    this.health = spawn.stats.health;
    this.hurtRadius = type.shape.radius;
    this.hurtHeight = type.shape.height;
    this.lockOnHeight = type.shape.height * 0.7;

    const movement: MovementConfig = { ...DEFAULT_MOVEMENT_CONFIG, walkSpeed: spawn.stats.speed, runSpeed: spawn.stats.speed };
    this.motor = new CharacterMotor(scene, spawn.position, type.shape, movement, CollisionLayers.ENEMY);
    this.visual = new EnemyVisual(scene, `enemy_${spawn.id}`, type);
    for (const m of this.visual.shadowCasters) shadows?.addShadowCaster(m);
    this.syncVisual();
  }

  get state(): EnemyStateName {
    return this._state;
  }

  get isAlive(): boolean {
    return this._state !== "Dead";
  }

  get currentHealth(): number {
    return this.health;
  }

  /** Morto e já caído há tempo suficiente: pode ser removido da cena. */
  get removable(): boolean {
    return this._removable;
  }

  get feetPosition(): Readonly<Vector3> {
    return this.motor.feetPosition;
  }

  receiveHit(hit: HitInfo): HitOutcome {
    if (!this.isAlive) return "ignored";
    this.health = Math.max(0, this.health - hit.damage);
    this.knockback.x = hit.directionX * hit.knockback;
    this.knockback.z = hit.directionZ * hit.knockback;
    this.flashTimer = this.type.hitFlashDuration;
    // Vira para quem bateu.
    this.motor.snapFacing(yawFromDirection(-hit.directionX, -hit.directionZ));

    if (this.health <= 0) {
      this.enter("Dead");
      return "killed";
    }
    this.stunDuration = hit.hitStun;
    this.enter("HitStun");
    return "hit";
  }

  update(dt: number): void {
    this.stateTime += dt;
    this.flashTimer = Math.max(0, this.flashTimer - dt);

    // Empurrão perde força exponencialmente (vale para atordoado e para o corpo caindo).
    const keep = 1 - damp(this.type.knockbackDrag, dt);
    this.knockback.x *= keep;
    this.knockback.z *= keep;
    this.intent.forcedVelocity = this.knockback;

    if (this._state === "HitStun" && this.stateTime >= this.stunDuration) this.enter("Idle");
    if (this._state === "Dead" && this.stateTime >= this.type.deathFallDuration + this.type.corpseLingerTime) {
      this._removable = true;
    }

    this.motor.step(dt, this.intent);
    this.syncVisual();
  }

  dispose(): void {
    this.visual.dispose();
    this.motor.dispose();
  }

  private enter(state: EnemyStateName): void {
    this._state = state;
    this.stateTime = 0;
  }

  private syncVisual(): void {
    this.visual.root.position.copyFrom(this.motor.feetPosition);
    this.visual.root.rotation.y = this.motor.facingYaw;
    this.visual.setFlash(this.flashTimer > 0);

    if (this._state === "HitStun") {
      this.visual.setTilt(HIT_TILT * Math.max(0, 1 - this.stateTime / this.stunDuration));
    } else if (this._state === "Dead") {
      const fall = Math.min(1, this.stateTime / this.type.deathFallDuration);
      this.visual.setTilt((Math.PI / 2) * fall * fall);
      const fadeStart = this.type.deathFallDuration + this.type.corpseLingerTime * 0.5;
      const fade = (this.stateTime - fadeStart) / (this.type.corpseLingerTime * 0.5);
      this.visual.setVisibility(1 - Math.min(1, Math.max(0, fade)));
    } else {
      this.visual.setTilt(0);
    }
  }
}
