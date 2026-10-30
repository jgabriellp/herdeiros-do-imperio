import type { HitInfo } from "../../combat/CombatTypes";
import { damp } from "../../core/mathUtils";
import { PlayerState, type PlayerStateParams } from "./PlayerState";

/** Quanto o "tranco" visual de um bloqueio dura (decai exponencialmente). */
const IMPACT_SHARPNESS = 8;

/**
 * Escudo erguido enquanto o botão de bloqueio estiver pressionado.
 * Anda devagar, encara o alvo travado (ou para onde a câmera olha) e segura golpes frontais.
 * A decisão de bloquear ou não um golpe fica em Player.receiveHit; aqui só a reação.
 */
export class BlockState extends PlayerState<"Block"> {
  readonly name = "Block" as const;
  private readonly pushback = { x: 0, z: 0 };
  private impact = 0;

  override enter(params: PlayerStateParams["Block"]): void {
    super.enter(params);
    this.pushback.x = this.pushback.z = 0;
    this.impact = 0;
  }

  update(dt: number): void {
    const { ctx } = this;
    const { input, motor, equipment, combat } = ctx;

    if (!motor.grounded) {
      this.machine.change("Jump", { jumped: false });
      return;
    }
    if (!input.isDown("block") || !equipment.canBlock) {
      this.machine.toLocomotion();
      return;
    }
    if (input.wasPressed("dodge") && this.machine.tryDodge()) return;
    if (input.wasPressed("attack")) {
      this.machine.change("Attack", { attack: ctx.comboStarter(), comboIndex: 0 });
      return;
    }
    if (input.wasPressed("kick")) {
      this.machine.change("Attack", { attack: combat.kick, comboIndex: 0 });
      return;
    }

    // Empurrão do golpe bloqueado perde força rapidamente.
    const keep = 1 - damp(combat.block.pushbackDrag, dt);
    this.pushback.x *= keep;
    this.pushback.z *= keep;
    this.impact *= 1 - damp(IMPACT_SHARPNESS, dt);

    if (Math.hypot(this.pushback.x, this.pushback.z) > 0.2) {
      this.resetIntent();
      ctx.intent.forcedVelocity = this.pushback;
    } else {
      this.applyLocomotionIntent(combat.block.moveSpeed);
    }
    // O escudo aponta para o alvo travado ou para onde a câmera olha.
    ctx.intent.faceYaw = ctx.lockYaw() ?? ctx.viewYaw;
    ctx.action = { kind: "block", impact: this.impact };
  }

  override exit(): void {
    this.ctx.action = null;
  }

  /** O golpe vem pela frente (dentro do ângulo coberto pelo escudo)? */
  coversHit(hit: HitInfo): boolean {
    const yaw = this.ctx.motor.facingYaw;
    // Direção do jogador para o atacante = oposta à direção do empurrão.
    const dot = -(hit.directionX * Math.sin(yaw) + hit.directionZ * Math.cos(yaw));
    return dot >= Math.cos((this.ctx.combat.block.frontalHalfAngleDeg * Math.PI) / 180);
  }

  /** Golpe segurado: só um empurrão reduzido e o tranco visual. */
  absorb(hit: HitInfo): void {
    const factor = this.ctx.combat.block.pushbackFactor;
    this.pushback.x = hit.directionX * hit.knockback * factor;
    this.pushback.z = hit.directionZ * hit.knockback * factor;
    this.impact = 1;
  }
}
