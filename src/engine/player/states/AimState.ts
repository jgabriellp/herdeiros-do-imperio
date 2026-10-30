import { PlayerState, type PlayerStateParams } from "./PlayerState";

/** Giro rápido para o corpo acompanhar a mira. */
const AIM_TURN_SHARPNESS = 25;

/**
 * Arco empunhado, puxando e disparando.
 * - Mira (botão direito segurado): câmera no ombro; segurar o botão esquerdo puxa a corda
 *   (tensão 0..1 em `drawTime`), soltar dispara (um clique rápido sai com a tensão mínima);
 *   depois espera `nockTime` para a próxima flecha. Soltar a mira antes cancela o tiro.
 * - Tiro rápido (clique sem mirar, `hip`): puxada curta com tensão fixa e volta a andar.
 * Quem cria a flecha é o `ctx.fireArrow` (direção vem da câmera ou do alvo travado).
 */
export class AimState extends PlayerState<"Aim"> {
  readonly name = "Aim" as const;
  private hip = false;
  private charge = 0;
  private nockTimer = 0;

  /** Mirando de verdade (câmera no ombro, retícula), não o tiro rápido. */
  get aiming(): boolean {
    return !this.hip;
  }

  get currentCharge(): number {
    return this.charge;
  }

  override enter(params: PlayerStateParams["Aim"]): void {
    super.enter(params);
    this.hip = params.hip;
    this.charge = 0;
    this.nockTimer = 0;
  }

  update(dt: number): void {
    this.elapsed += dt;
    const { ctx } = this;
    const { input, motor, equipment, combat } = ctx;
    const bow = combat.bow;

    if (!motor.grounded) {
      this.machine.change("Jump", { jumped: false });
      return;
    }
    if (!equipment.bowDrawn) {
      this.machine.toLocomotion();
      return;
    }
    if (input.wasPressed("dodge") && this.machine.tryDodge()) return;

    if (this.hip) {
      if (!this.updateHipShot(dt)) return;
    } else {
      if (!input.isDown("aim")) {
        // Soltou a mira: a flecha puxada é guardada sem disparar.
        this.machine.toLocomotion();
        return;
      }
      this.nockTimer = Math.max(0, this.nockTimer - dt);
      if (this.nockTimer <= 0) {
        if (input.isDown("attack")) {
          this.charge = Math.min(1, this.charge + dt / bow.drawTime);
        } else if (this.charge > 0) {
          // Soltou o botão: sempre dispara (clique rápido = tiro fraco, com a tensão mínima).
          // Para desistir do tiro, solta-se o botão direito (mira) antes.
          ctx.fireArrow(Math.max(this.charge, bow.minCharge), true);
          this.nockTimer = bow.nockTime;
          this.charge = 0;
        }
      }
    }

    this.applyLocomotionIntent(ctx.crouched ? Math.min(bow.aimMoveSpeed, ctx.movement.crouchSpeed) : bow.aimMoveSpeed);
    // Mirando, o corpo acompanha a câmera; no tiro rápido, o alvo travado (ou a frente atual).
    ctx.intent.faceYaw = this.hip ? ctx.lockYaw() : ctx.viewYaw;
    ctx.intent.turnSharpness = AIM_TURN_SHARPNESS;
    ctx.action = { kind: "aim", charge: this.charge, raised: true };
  }

  override exit(): void {
    this.ctx.action = null;
  }

  /** Tiro rápido: puxa por `hipDrawTime`, dispara e sai após encaixar a próxima. Retorna false se trocou de estado. */
  private updateHipShot(dt: number): boolean {
    const bow = this.ctx.combat.bow;
    if (this.nockTimer > 0) {
      this.nockTimer -= dt;
      if (this.nockTimer <= 0) {
        this.machine.toLocomotion();
        return false;
      }
      return true;
    }
    this.charge = Math.min(bow.hipCharge, (this.elapsed / bow.hipDrawTime) * bow.hipCharge);
    if (this.elapsed >= bow.hipDrawTime) {
      this.ctx.fireArrow(bow.hipCharge, false);
      this.charge = 0;
      this.nockTimer = bow.nockTime;
    }
    return true;
  }
}
