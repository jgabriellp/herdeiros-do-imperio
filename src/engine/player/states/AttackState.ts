import type { AttackConfig, AttackId } from "../../combat/CombatConfig";
import { yawFromDirection } from "../../core/mathUtils";
import type { AttackPhase } from "../PlayerVisual";
import { MOVE_DEADZONE } from "./LocomotionStates";
import { PlayerState, type PlayerStateParams } from "./PlayerState";

/**
 * Um golpe: preparação → janela ativa (hitbox ligada) → recuperação.
 * Combo: apertar ataque de novo até `chainInputWindow` após a janela ativa
 * encadeia o próximo golpe assim que `chainCancelAfter` da recuperação passar.
 */
export class AttackState extends PlayerState<"Attack"> {
  readonly name = "Attack" as const;
  private attackId: AttackId = "punch1";
  private attack!: AttackConfig;
  private comboIndex = 0;
  private nextQueued = false;
  private readonly lunge = { x: 0, z: 0 };

  override enter(params: PlayerStateParams["Attack"]): void {
    super.enter(params);
    this.attackId = params.attack;
    this.attack = this.ctx.combat.attacks[params.attack];
    this.comboIndex = params.comboIndex;
    this.nextQueued = false;
    this.ctx.hitbox.deactivate();

    // Mira o golpe: alvo travado > direção do input > frente atual.
    const { moveDir, motor } = this.ctx;
    const lockYaw = this.ctx.lockYaw();
    if (lockYaw !== null) motor.snapFacing(lockYaw);
    else if (Math.hypot(moveDir.x, moveDir.z) > MOVE_DEADZONE) motor.snapFacing(yawFromDirection(moveDir.x, moveDir.z));
  }

  update(dt: number): void {
    this.elapsed += dt;
    const a = this.attack;
    const t = this.elapsed;
    const activeStart = a.windup;
    const activeEnd = a.windup + a.active;
    const total = activeEnd + a.recovery;
    const { input, hitbox, motor } = this.ctx;

    // --- entradas durante o golpe ---
    if (a.next && input.wasPressed("attack") && t <= activeEnd + a.chainInputWindow) this.nextQueued = true;
    if (t >= activeEnd + a.dodgeCancelAfter && input.wasPressed("dodge") && this.machine.tryDodge()) return;
    if (this.nextQueued && a.next && t >= activeEnd + a.chainCancelAfter) {
      this.machine.change("Attack", { attack: a.next, comboIndex: this.comboIndex + 1 });
      return;
    }
    if (t >= total) {
      this.machine.toLocomotion();
      return;
    }

    // --- movimento: avança na preparação/ativa, planta os pés na recuperação ---
    this.resetIntent();
    const lunging = t < activeEnd;
    this.lunge.x = lunging ? Math.sin(motor.facingYaw) * a.lungeSpeed : 0;
    this.lunge.z = lunging ? Math.cos(motor.facingYaw) * a.lungeSpeed : 0;
    this.ctx.intent.forcedVelocity = this.lunge;
    // Travado: continua encarando o alvo enquanto prepara o golpe.
    this.ctx.intent.faceYaw = t < activeStart ? this.ctx.lockYaw() : null;

    // --- hitbox ---
    const phase: AttackPhase = t < activeStart ? "windup" : t < activeEnd ? "active" : "recovery";
    if (phase === "active") {
      if (!hitbox.isActive) hitbox.activate();
      const feet = motor.feetPosition;
      hitbox.place(feet, motor.facingYaw, a.hitbox);
      this.ctx.damage.resolve(hitbox, "player", feet.x, feet.z, a);
    } else if (hitbox.isActive) {
      hitbox.deactivate();
    }

    const [start, length] =
      phase === "windup" ? [0, a.windup] : phase === "active" ? [activeStart, a.active] : [activeEnd, a.recovery];
    this.ctx.action = {
      kind: a.kind,
      comboIndex: this.comboIndex,
      phase,
      phaseProgress: length > 0 ? Math.min(1, (t - start) / length) : 1,
    };
  }

  override exit(): void {
    this.ctx.hitbox.deactivate();
    this.ctx.action = null;
  }

  /** Para o painel de dev. */
  get currentAttack(): AttackId {
    return this.attackId;
  }
}
