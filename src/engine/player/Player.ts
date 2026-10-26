import type { Scene, ShadowGenerator, Vector3 } from "@babylonjs/core";
import type { PlayerAttributes, Vec3Data } from "../../shared/types";
import { CharacterMotor, createMoveIntent } from "../character/CharacterMotor";
import type { CombatConfig } from "../combat/CombatConfig";
import type { CombatTarget, HitInfo, HitOutcome } from "../combat/CombatTypes";
import type { DamageSystem } from "../combat/DamageSystem";
import { Hitbox } from "../combat/Hitbox";
import { TargetLock } from "../combat/TargetLock";
import { CollisionLayers } from "../core/CollisionLayers";
import type { InputManager } from "../core/input/InputManager";
import { CapsuleVisual } from "./CapsuleVisual";
import { DEFAULT_CAPSULE_CONFIG, DEFAULT_MOVEMENT_CONFIG } from "./PlayerConfig";
import { PlayerController, yawTowards, type PlayerControllerEvents } from "./PlayerController";
import { PlayerStateMachine } from "./PlayerStateMachine";
import { PlayerStats } from "./PlayerStats";
import type { PlayerVisual } from "./PlayerVisual";
import type { PlayerContext } from "./states/PlayerState";

export interface PlayerDeps {
  scene: Scene;
  input: InputManager;
  damage: DamageSystem;
  combat: CombatConfig;
  attributes: PlayerAttributes;
  spawn: Vec3Data;
  shadows: ShadowGenerator | null;
  events: PlayerControllerEvents;
  /** Chamado uma vez quando a vida chega a zero. */
  onDied(): void;
}

/**
 * Monta o jogador (corpo físico, visual, atributos, máquina de estados, mira)
 * e o representa no combate como alvo da facção "player".
 */
export class Player implements CombatTarget {
  readonly id = "player";
  readonly faction = "player" as const;
  readonly hurtRadius = DEFAULT_CAPSULE_CONFIG.radius;
  readonly hurtHeight = DEFAULT_CAPSULE_CONFIG.height;
  readonly lockOnHeight = DEFAULT_CAPSULE_CONFIG.height * 0.7;

  readonly motor: CharacterMotor;
  readonly visual: PlayerVisual;
  readonly stats: PlayerStats;
  readonly lock: TargetLock;
  readonly hitbox = new Hitbox();
  readonly machine: PlayerStateMachine;
  readonly controller: PlayerController;
  private readonly damage: DamageSystem;
  private readonly combat: CombatConfig;
  private postHitTimer = 0;
  private readonly onDied: () => void;

  constructor(deps: PlayerDeps) {
    const shape = DEFAULT_CAPSULE_CONFIG;
    this.damage = deps.damage;
    this.combat = deps.combat;
    this.onDied = deps.onDied;
    this.motor = new CharacterMotor(deps.scene, deps.spawn, shape, DEFAULT_MOVEMENT_CONFIG, CollisionLayers.PLAYER);
    // Trocar por um visual .glb (Mixamo) = trocar só esta linha.
    this.visual = new CapsuleVisual(deps.scene, shape.height, shape.radius);
    this.stats = new PlayerStats(deps.attributes.maxHealth, deps.attributes.maxStamina, deps.combat.stamina);
    this.lock = new TargetLock(deps.combat.lock, () => deps.damage.aliveTargets("enemy"));

    const motor = this.motor;
    const lock = this.lock;
    const ctx: PlayerContext = {
      input: deps.input,
      motor,
      stats: this.stats,
      combat: deps.combat,
      movement: DEFAULT_MOVEMENT_CONFIG,
      damage: deps.damage,
      hitbox: this.hitbox,
      lock,
      moveDir: { x: 0, z: 0 },
      intent: createMoveIntent(),
      action: null,
      lockYaw() {
        const t = lock.target;
        if (!t) return null;
        const feet = motor.feetPosition;
        return yawTowards(feet.x, feet.z, t.feetPosition.x, t.feetPosition.z);
      },
    };
    this.machine = new PlayerStateMachine(ctx);
    this.controller = new PlayerController(
      ctx,
      this.machine,
      this.motor,
      this.stats,
      this.lock,
      deps.input,
      this.visual,
      DEFAULT_MOVEMENT_CONFIG,
      deps.events,
      deps.spawn,
    );

    for (const mesh of this.visual.shadowCasters) deps.shadows?.addShadowCaster(mesh);
    deps.damage.register(this);
  }

  get isAlive(): boolean {
    return this.stats.isAlive;
  }

  get feetPosition(): Readonly<Vector3> {
    return this.motor.feetPosition;
  }

  /** Esquivando (i-frames) ou recém-atingido. */
  get isInvulnerable(): boolean {
    return this.postHitTimer > 0 || this.machine.current.isInvulnerable();
  }

  update(dt: number, cameraYaw: number): void {
    this.postHitTimer = Math.max(0, this.postHitTimer - dt);
    this.controller.update(dt, cameraYaw);
  }

  receiveHit(hit: HitInfo): HitOutcome {
    if (!this.isAlive || this.isInvulnerable) return "ignored";
    this.stats.takeDamage(hit.damage);
    if (!this.stats.isAlive) {
      this.lock.release();
      this.machine.change("Dead");
      this.onDied();
      return "killed";
    }
    this.postHitTimer = this.combat.playerHitReaction.postHitInvulnerability;
    this.machine.change("HitStun", { hit });
    return "hit";
  }

  /** Volta à vida em `feet` com vida e stamina cheias e invulnerabilidade breve. */
  respawn(feet: Vec3Data): void {
    this.motor.teleport(feet);
    this.stats.health = this.stats.maxHealth;
    this.stats.stamina = this.stats.maxStamina;
    this.postHitTimer = this.combat.death.respawnInvulnerability;
    this.lock.release();
    this.machine.change("Idle");
  }

  /** Deixa o personagem transparente quando a câmera chega perto demais. */
  fadeForCamera(distance: number, fadeStart: number, fadeEnd: number): void {
    const t = (distance - fadeEnd) / (fadeStart - fadeEnd);
    this.visual.setVisibility(Math.min(1, Math.max(0, t)));
  }

  dispose(): void {
    this.damage.unregister(this);
    this.visual.dispose();
    this.motor.dispose();
  }
}
