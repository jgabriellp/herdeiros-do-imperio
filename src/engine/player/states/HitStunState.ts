import { damp, yawFromDirection } from "../../core/mathUtils";
import { PlayerState, type PlayerStateParams } from "./PlayerState";

/** Atordoado após levar um golpe: empurrado para trás, sem controle até o fim. */
export class HitStunState extends PlayerState<"HitStun"> {
  readonly name = "HitStun" as const;
  private duration = 0;
  private readonly velocity = { x: 0, z: 0 };

  override enter(params: PlayerStateParams["HitStun"]): void {
    super.enter(params);
    const { hit } = params;
    this.duration = hit.hitStun;
    this.velocity.x = hit.directionX * hit.knockback;
    this.velocity.z = hit.directionZ * hit.knockback;
    // Vira para quem bateu (o empurrão vem da frente).
    this.ctx.motor.snapFacing(yawFromDirection(-hit.directionX, -hit.directionZ));
    this.ctx.hitbox.deactivate();
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.machine.toLocomotion();
      return;
    }
    // Empurrão perde força exponencialmente (independente de FPS).
    const keep = 1 - damp(this.ctx.combat.playerHitReaction.knockbackDrag, dt);
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
