import type { CharacterMotor, MoveIntent } from "../../character/CharacterMotor";
import type { MovementConfig } from "../../character/CharacterConfig";
import type { AttackId, CombatConfig } from "../../combat/CombatConfig";
import type { HitInfo } from "../../combat/CombatTypes";
import type { DamageSystem } from "../../combat/DamageSystem";
import type { Hitbox } from "../../combat/Hitbox";
import type { TargetLock } from "../../combat/TargetLock";
import type { InputManager } from "../../core/input/InputManager";
import type { PlayerStats } from "../PlayerStats";
import type { VisualAction } from "../PlayerVisual";

export type PlayerStateName = "Idle" | "Move" | "Run" | "Jump" | "Attack" | "HitStun" | "Dodge" | "Dead";

/** Parâmetros de entrada de cada estado (void = nenhum). */
export interface PlayerStateParams {
  Idle: void;
  Move: void;
  Run: void;
  /** jumped = entrou pulando (false = caiu de uma borda). */
  Jump: { jumped: boolean };
  Attack: { attack: AttackId; comboIndex: number };
  HitStun: { hit: HitInfo };
  Dodge: void;
  Dead: void;
}

/** Tudo que os estados podem ler/escrever. Montado pelo PlayerController. */
export interface PlayerContext {
  readonly input: InputManager;
  readonly motor: CharacterMotor;
  readonly stats: PlayerStats;
  readonly combat: CombatConfig;
  readonly movement: MovementConfig;
  readonly damage: DamageSystem;
  readonly hitbox: Hitbox;
  readonly lock: TargetLock;
  /** Direção desejada no mundo (relativa à câmera, ou ao alvo se travado), comprimento 0..1. */
  readonly moveDir: { x: number; z: number };
  /** Intenção de movimento preenchida pelo estado a cada quadro. */
  readonly intent: MoveIntent;
  /** Ação em andamento para o visual (null = só locomoção). */
  action: VisualAction | null;
  /** Yaw do jogador para o alvo travado, ou null se não houver trava. */
  lockYaw(): number | null;
}

/** Contrato mínimo da máquina visto pelos estados (evita import circular). */
export interface PlayerStateChanger {
  change<K extends PlayerStateName>(name: K, ...params: PlayerStateParams[K] extends void ? [] : [PlayerStateParams[K]]): void;
  /** Volta para Idle/Move/Run conforme o input. */
  toLocomotion(): void;
  /** Tenta esquivar (consome stamina). */
  tryDodge(): boolean;
}

export abstract class PlayerState<K extends PlayerStateName = PlayerStateName> {
  abstract readonly name: K;
  /** Tempo desde a entrada no estado. */
  protected elapsed = 0;

  constructor(
    protected readonly machine: PlayerStateChanger,
    protected readonly ctx: PlayerContext,
  ) {}

  enter(_params: PlayerStateParams[K]): void {
    this.elapsed = 0;
  }

  /** Chamado a cada quadro; pode trocar de estado via this.machine. */
  abstract update(dt: number): void;

  exit(): void {}

  /** Esquiva com i-frames retorna true na janela de invulnerabilidade. */
  isInvulnerable(): boolean {
    return false;
  }

  /** Zera a intenção de movimento (cada estado preenche o que precisa). */
  protected resetIntent(): void {
    const i = this.ctx.intent;
    i.directionX = i.directionZ = i.maxSpeed = 0;
    i.faceYaw = null;
    i.forcedVelocity = null;
    i.turnSharpness = null;
  }

  /** Movimento livre conduzido pelo input (andar/correr/strafe). */
  protected applyLocomotionIntent(maxSpeed: number): void {
    const { intent, moveDir } = this.ctx;
    this.resetIntent();
    intent.directionX = moveDir.x;
    intent.directionZ = moveDir.z;
    intent.maxSpeed = maxSpeed;
    // Travado: o corpo sempre encara o alvo (strafe em volta dele).
    intent.faceYaw = this.ctx.lockYaw();
  }

  protected moveMagnitude(): number {
    return Math.hypot(this.ctx.moveDir.x, this.ctx.moveDir.z);
  }
}
