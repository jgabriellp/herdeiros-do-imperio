import { yawFromDirection } from "../../core/mathUtils";
import { EnemyState, type EnemyStateParams } from "./EnemyState";

/**
 * Perseguir. Duas formas, decididas pelo AttackCoordinator:
 * - com a vez de atacar: vai direto ao jogador e ataca ao chegar no alcance;
 * - sem a vez: RONDA o jogador a uma distância segura, andando de lado,
 *   esperando sua vez (combate em grupo justo e legível).
 */
export class ChaseState extends EnemyState<"Chase"> {
  readonly name = "Chase" as const;
  private circleSign = 1;
  private switchTimer = 0;
  private approachTimer = 0;
  private hadTurn = false;

  override enter(params: EnemyStateParams["Chase"]): void {
    super.enter(params);
    this.circleSign = Math.random() < 0.5 ? -1 : 1;
    this.switchTimer = this.randomSwitchTime();
    this.approachTimer = 0;
    this.hadTurn = false;
  }

  override get detail(): string {
    return this.ctx.coordinator.holds(this.ctx.token) ? "avançando" : "ronda";
  }

  update(dt: number): void {
    const { ctx } = this;
    const { ai, attack } = ctx.type;
    const { dx, dz, dist } = this.toPlayer();

    if (!ctx.player.isAlive || dist > ai.loseAggroRange) {
      this.finishAttackTurn();
      this.machine.change("Idle");
      return;
    }

    // Pede a vez quando a espera entre ataques acabou.
    const hasTurn = ctx.attackCooldown <= 0 && ctx.coordinator.tryAcquire(ctx.token);
    if (hasTurn && !this.hadTurn) this.approachTimer = 0;
    this.hadTurn = hasTurn;

    if (hasTurn && dist <= attack.range) {
      this.machine.change("Attack");
      return;
    }

    const nx = dist > 1e-3 ? dx / dist : 0;
    const nz = dist > 1e-3 ? dz / dist : 0;
    let dirX: number;
    let dirZ: number;
    let speed = ctx.stats.speed;

    if (hasTurn) {
      // Não consegue alcançar (jogador fugindo): devolve a vez para outro tentar.
      this.approachTimer += dt;
      if (this.approachTimer > ai.approachTimeout) this.finishAttackTurn();
      dirX = nx;
      dirZ = nz;
    } else {
      this.switchTimer -= dt;
      if (this.switchTimer <= 0) {
        this.circleSign *= -1;
        this.switchTimer = this.randomSwitchTime();
      }
      // Tangente (anda de lado em volta do jogador) + correção radial para manter o raio.
      const radial = Math.max(-1, Math.min(1, (dist - ai.circleRadius) / 1.5));
      dirX = -nz * this.circleSign + nx * radial;
      dirZ = nx * this.circleSign + nz * radial;
      speed *= ai.circleSpeedFactor;
    }

    // Afasta-se de outros inimigos próximos.
    const me = ctx.motor.feetPosition;
    for (const other of ctx.neighbors()) {
      const ox = me.x - other.x;
      const oz = me.z - other.z;
      const d = Math.hypot(ox, oz);
      if (d > 1e-3 && d < ai.separationRadius) {
        const push = 1 - d / ai.separationRadius;
        dirX += (ox / d) * push * 1.5;
        dirZ += (oz / d) * push * 1.5;
      }
    }

    const len = Math.hypot(dirX, dirZ);
    this.resetIntent();
    if (len > 1e-3) {
      ctx.intent.directionX = dirX / Math.max(1, len);
      ctx.intent.directionZ = dirZ / Math.max(1, len);
    }
    ctx.intent.maxSpeed = speed;
    ctx.intent.faceYaw = yawFromDirection(dx, dz);
    ctx.intent.turnSharpness = ai.turnSharpness;
  }

  private randomSwitchTime(): number {
    return this.ctx.type.ai.circleSwitchTime * (0.6 + Math.random() * 0.8);
  }
}
