import { EnemyState } from "./EnemyState";

/** Parado até perceber o jogador por perto (ou ser alertado por um aliado lutando). */
export class EnemyIdleState extends EnemyState<"Idle"> {
  readonly name = "Idle" as const;

  update(_dt: number): void {
    this.resetIntent();
    if (!this.ctx.player.isAlive) return;
    const { ai } = this.ctx.type;
    const dist = this.toPlayer().dist;
    const alerted = dist <= ai.loseAggroRange && this.ctx.allyEngagedWithin(ai.alertRadius);
    if (dist <= ai.aggroRange || alerted) this.machine.change("Chase");
  }
}
