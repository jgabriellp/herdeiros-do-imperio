import { EnemyAttackState } from "./states/AttackState";
import { ChaseState } from "./states/ChaseState";
import { EnemyDeadState } from "./states/DeadState";
import type {
  EnemyContext,
  EnemyState,
  EnemyStateChanger,
  EnemyStateName,
  EnemyStateParams,
} from "./states/EnemyState";
import { EnemyHitStunState } from "./states/HitStunState";
import { EnemyIdleState } from "./states/IdleState";
import { InvestigateState } from "./states/InvestigateState";

/** Máquina de estados do inimigo: Idle, Investigate, Chase, Attack, HitStun, Dead. */
export class EnemyStateMachine implements EnemyStateChanger {
  private readonly states: { [K in EnemyStateName]: EnemyState<K> };
  private _current: EnemyState;

  constructor(private readonly ctx: EnemyContext) {
    this.states = {
      Idle: new EnemyIdleState(this, ctx),
      Investigate: new InvestigateState(this, ctx),
      Chase: new ChaseState(this, ctx),
      Attack: new EnemyAttackState(this, ctx),
      HitStun: new EnemyHitStunState(this, ctx),
      Dead: new EnemyDeadState(this, ctx),
    };
    this._current = this.states.Idle;
    this._current.enter(undefined as never);
  }

  get current(): EnemyState {
    return this._current;
  }

  get investigateState(): InvestigateState {
    return this.states.Investigate as InvestigateState;
  }

  change<K extends EnemyStateName>(
    name: K,
    ...params: EnemyStateParams[K] extends void ? [] : [EnemyStateParams[K]]
  ): void {
    this._current.exit();
    // O estado novo só roda no próximo quadro: não deixar a intenção do anterior vazar.
    const i = this.ctx.intent;
    i.directionX = i.directionZ = i.maxSpeed = 0;
    i.faceYaw = null;
    i.forcedVelocity = null;
    i.turnSharpness = null;
    const next = this.states[name] as EnemyState<K>;
    this._current = next as EnemyState;
    next.enter(params[0] as EnemyStateParams[K]);
  }

  update(dt: number): void {
    this.ctx.attackCooldown = Math.max(0, this.ctx.attackCooldown - dt);
    this._current.update(dt);
  }
}
