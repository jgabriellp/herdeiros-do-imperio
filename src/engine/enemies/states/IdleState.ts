import { EnemyState, type EnemyStateParams } from "./EnemyState";

/** Giro lento ao olhar em volta no posto. */
const GLANCE_TURN_SHARPNESS = 1.5;

/**
 * Desprevenido: parado no posto, olhando em volta de vez em quando.
 * Perceber o jogador (visão, passos, corpo, grito) é tratado no Enemy via Perception;
 * daqui ele só sai para Investigate ou Chase por decisão do Enemy.
 */
export class EnemyIdleState extends EnemyState<"Idle"> {
  readonly name = "Idle" as const;
  private glanceTimer = 0;
  private glanceYaw = 0;

  override enter(params: EnemyStateParams["Idle"]): void {
    super.enter(params);
    this.glanceYaw = this.ctx.home.yaw;
    this.glanceTimer = this.nextGlanceDelay();
  }

  update(dt: number): void {
    this.resetIntent();
    const { investigate } = this.ctx.type.ai;
    this.glanceTimer -= dt;
    if (this.glanceTimer <= 0) {
      // Olha para um lado (ou volta a olhar para a frente do posto).
      const spread = (investigate.idleGlanceDeg * Math.PI) / 180;
      this.glanceYaw = this.ctx.home.yaw + (Math.random() * 2 - 1) * spread;
      this.glanceTimer = this.nextGlanceDelay();
    }
    this.ctx.intent.faceYaw = this.glanceYaw;
    this.ctx.intent.turnSharpness = GLANCE_TURN_SHARPNESS;
  }

  private nextGlanceDelay(): number {
    const { idleGlanceMin, idleGlanceMax } = this.ctx.type.ai.investigate;
    return idleGlanceMin + Math.random() * (idleGlanceMax - idleGlanceMin);
  }
}
