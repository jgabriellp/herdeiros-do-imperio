import { yawFromDirection } from "../../core/mathUtils";
import { MOVE_DEADZONE } from "./LocomotionStates";
import { PlayerState, type PlayerStateParams } from "./PlayerState";

/**
 * Esquiva rápida com invulnerabilidade breve.
 * - Livre: rola na direção do input (ou para frente) e passa a olhar para lá.
 * - Travado: passo lateral/para trás mantendo o rosto no alvo; sem input = recua.
 * A stamina já foi gasta por quem pediu a esquiva (PlayerStateMachine.tryDodge).
 */
export class DodgeState extends PlayerState<"Dodge"> {
  readonly name = "Dodge" as const;
  private dirX = 0;
  private dirZ = 1;
  private readonly velocity = { x: 0, z: 0 };

  override enter(params: PlayerStateParams["Dodge"]): void {
    super.enter(params);
    const { moveDir, motor } = this.ctx;
    const locked = this.ctx.lockYaw() !== null;
    const mag = Math.hypot(moveDir.x, moveDir.z);

    if (mag > MOVE_DEADZONE) {
      this.dirX = moveDir.x / mag;
      this.dirZ = moveDir.z / mag;
    } else {
      // Sem direção: travado recua; livre rola para frente.
      const sign = locked ? -1 : 1;
      this.dirX = Math.sin(motor.facingYaw) * sign;
      this.dirZ = Math.cos(motor.facingYaw) * sign;
    }
    if (!locked) motor.snapFacing(yawFromDirection(this.dirX, this.dirZ));
  }

  update(dt: number): void {
    this.elapsed += dt;
    const cfg = this.ctx.combat.dodge;
    const progress = Math.min(1, this.elapsed / cfg.duration);

    if (progress >= 1) {
      this.machine.toLocomotion();
      return;
    }

    // Arranque forte que desacelera: sai do rolamento sem "patinar".
    const speed = cfg.speed * (1 + (cfg.speedEndFactor - 1) * progress);
    this.resetIntent();
    this.velocity.x = this.dirX * speed;
    this.velocity.z = this.dirZ * speed;
    this.ctx.intent.forcedVelocity = this.velocity;
    this.ctx.intent.faceYaw = this.ctx.lockYaw();

    // Direção no espaço local do corpo, para o visual inclinar para o lado certo.
    const f = this.ctx.motor.facingYaw;
    this.ctx.action = {
      kind: "dodge",
      progress,
      localX: this.dirX * Math.cos(f) - this.dirZ * Math.sin(f),
      localZ: this.dirX * Math.sin(f) + this.dirZ * Math.cos(f),
      invulnerable: this.isInvulnerable(),
    };
  }

  override exit(): void {
    this.ctx.action = null;
  }

  override isInvulnerable(): boolean {
    const cfg = this.ctx.combat.dodge;
    return this.elapsed >= cfg.invulnerableFrom && this.elapsed <= cfg.invulnerableUntil;
  }
}
