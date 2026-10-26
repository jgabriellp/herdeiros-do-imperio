import { damp } from "../../core/mathUtils";
import { EnemyState, type EnemyStateParams } from "./EnemyState";

/** Morto: cai com o embalo do último golpe, fica um tempo no chão e some. */
export class EnemyDeadState extends EnemyState<"Dead"> {
  readonly name = "Dead" as const;
  private readonly velocity = { x: 0, z: 0 };

  override enter(params: EnemyStateParams["Dead"]): void {
    super.enter(params);
    this.velocity.x = params.hit.directionX * params.hit.knockback;
    this.velocity.z = params.hit.directionZ * params.hit.knockback;
    this.finishAttackTurn();
    this.ctx.hitbox.deactivate();
  }

  update(dt: number): void {
    this.elapsed += dt;
    const { type } = this.ctx;
    const keep = 1 - damp(type.knockbackDrag, dt);
    this.velocity.x *= keep;
    this.velocity.z *= keep;
    this.resetIntent();
    this.ctx.intent.forcedVelocity = this.velocity;
    this.ctx.action = { kind: "dead", elapsed: this.elapsed };
    if (this.elapsed >= type.deathFallDuration + type.corpseLingerTime) this.ctx.removable = true;
  }
}
