import { damp, yawFromDirection } from "../../core/mathUtils";
import { EnemyState, type EnemyStateParams } from "./EnemyState";

/** Atordoado: empurrado para trás; perde a vez de atacar. Depois volta a perseguir. */
export class EnemyHitStunState extends EnemyState<"HitStun"> {
  readonly name = "HitStun" as const;
  private duration = 0;
  private readonly velocity = { x: 0, z: 0 };

  override enter(params: EnemyStateParams["HitStun"]): void {
    super.enter(params);
    const { hit } = params;
    this.duration = hit.hitStun;
    this.velocity.x = hit.directionX * hit.knockback;
    this.velocity.z = hit.directionZ * hit.knockback;
    this.ctx.motor.snapFacing(yawFromDirection(-hit.directionX, -hit.directionZ));
    this.finishAttackTurn();
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.machine.change("Chase");
      return;
    }
    const keep = 1 - damp(this.ctx.type.knockbackDrag, dt);
    this.velocity.x *= keep;
    this.velocity.z *= keep;
    this.resetIntent();
    this.ctx.intent.forcedVelocity = this.velocity;
    this.ctx.action = { kind: "hitStun", progress: this.elapsed / this.duration };
  }

  override exit(): void {
    this.ctx.action = null;
  }
}
