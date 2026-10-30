import { yawFromDirection } from "../../core/mathUtils";
import type { AttackPhase } from "../../player/PlayerVisual";
import { EnemyState, type EnemyStateParams } from "./EnemyState";

/**
 * Golpe do inimigo: preparação COM AVISO (o visual brilha e ergue a arma),
 * janela ativa e recuperação. Na preparação ainda gira devagar para o jogador,
 * então esquivar para o lado no tempo certo funciona.
 */
export class EnemyAttackState extends EnemyState<"Attack"> {
  readonly name = "Attack" as const;
  private readonly lunge = { x: 0, z: 0 };

  override enter(params: EnemyStateParams["Attack"]): void {
    super.enter(params);
    const { dx, dz } = this.toPlayer();
    this.ctx.motor.snapFacing(yawFromDirection(dx, dz));
    this.ctx.hitbox.deactivate();
  }

  update(dt: number): void {
    this.elapsed += dt;
    const { ctx } = this;
    const a = ctx.type.attack;
    const t = this.elapsed;
    const activeStart = a.windup;
    const activeEnd = a.windup + a.active;

    if (t >= activeEnd + a.recovery) {
      this.finishAttackTurn();
      this.machine.change("Chase");
      return;
    }

    const phase: AttackPhase = t < activeStart ? "windup" : t < activeEnd ? "active" : "recovery";
    this.resetIntent();

    if (phase === "windup") {
      const { dx, dz } = this.toPlayer();
      ctx.intent.faceYaw = yawFromDirection(dx, dz);
      ctx.intent.turnSharpness = a.windupTurnSharpness;
    }

    const facing = ctx.motor.facingYaw;
    const lunging = phase === "active";
    this.lunge.x = lunging ? Math.sin(facing) * a.lungeSpeed : 0;
    this.lunge.z = lunging ? Math.cos(facing) * a.lungeSpeed : 0;
    ctx.intent.forcedVelocity = this.lunge;

    if (phase === "active") {
      if (!ctx.hitbox.isActive) ctx.hitbox.activate();
      const feet = ctx.motor.feetPosition;
      ctx.hitbox.place(feet, facing, a.hitbox);
      const events = ctx.damage.resolve(ctx.hitbox, "enemy", feet.x, feet.z, {
        damage: ctx.stats.damage,
        knockback: a.knockback,
        targetHitStun: a.targetHitStun,
        heavy: a.heavy,
      });
      // Bateu no escudo: recua desequilibrado (o golpe "quica").
      const blocked = events.find((e) => e.outcome === "blocked");
      if (blocked) {
        this.machine.change("HitStun", {
          hit: {
            damage: 0,
            directionX: -blocked.hit.directionX,
            directionZ: -blocked.hit.directionZ,
            knockback: a.blockedRecoil.knockback,
            hitStun: a.blockedRecoil.hitStun,
            heavy: false,
          },
        });
        return;
      }
    } else if (ctx.hitbox.isActive) {
      ctx.hitbox.deactivate();
    }

    const [start, length] =
      phase === "windup" ? [0, a.windup] : phase === "active" ? [activeStart, a.active] : [activeEnd, a.recovery];
    ctx.action = { kind: "attack", phase, phaseProgress: length > 0 ? Math.min(1, (t - start) / length) : 1 };
  }

  override exit(): void {
    this.ctx.hitbox.deactivate();
    this.ctx.action = null;
  }
}
