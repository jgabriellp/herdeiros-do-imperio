import { AttackState } from "./states/AttackState";
import { DodgeState } from "./states/DodgeState";
import { HitStunState } from "./states/HitStunState";
import { JumpState } from "./states/JumpState";
import { IdleState, MoveState, RunState, pickLocomotion } from "./states/LocomotionStates";
import type {
  PlayerContext,
  PlayerState,
  PlayerStateChanger,
  PlayerStateName,
  PlayerStateParams,
} from "./states/PlayerState";

/**
 * Máquina de estados do jogador: Idle, Move, Run, Jump, Attack, HitStun, Dodge.
 * Cada estado decide o movimento (MoveIntent) e as transições; a máquina só troca.
 */
export class PlayerStateMachine implements PlayerStateChanger {
  private readonly states: { [K in PlayerStateName]: PlayerState<K> };
  private _current: PlayerState;

  constructor(private readonly ctx: PlayerContext) {
    this.states = {
      Idle: new IdleState(this, ctx),
      Move: new MoveState(this, ctx),
      Run: new RunState(this, ctx),
      Jump: new JumpState(this, ctx),
      Attack: new AttackState(this, ctx),
      HitStun: new HitStunState(this, ctx),
      Dodge: new DodgeState(this, ctx),
    };
    this._current = this.states.Idle;
    this._current.enter(undefined as never);
  }

  get current(): PlayerState {
    return this._current;
  }

  get attackState(): AttackState {
    return this.states.Attack as AttackState;
  }

  change<K extends PlayerStateName>(
    name: K,
    ...params: PlayerStateParams[K] extends void ? [] : [PlayerStateParams[K]]
  ): void {
    this._current.exit();
    // O estado novo só roda no próximo quadro: não deixar a intenção do anterior vazar.
    const intent = this.ctx.intent;
    intent.directionX = intent.directionZ = intent.maxSpeed = 0;
    intent.faceYaw = null;
    intent.forcedVelocity = null;
    intent.turnSharpness = null;
    const next = this.states[name] as PlayerState<K>;
    this._current = next as PlayerState;
    next.enter(params[0] as PlayerStateParams[K]);
  }

  toLocomotion(): void {
    const { moveDir, input } = this.ctx;
    this.change(pickLocomotion(Math.hypot(moveDir.x, moveDir.z), input.isDown("run"), this.ctx.lockYaw() !== null));
  }

  tryDodge(): boolean {
    if (!this.ctx.motor.grounded) return false;
    if (!this.ctx.stats.trySpendStamina(this.ctx.combat.dodge.staminaCost)) return false;
    this.change("Dodge");
    return true;
  }

  update(dt: number): void {
    this._current.update(dt);
  }
}
