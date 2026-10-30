import { EnemyState } from "./EnemyState";

/**
 * Desprevenido: parado até perceber o jogador por perto (ou ouvir o grito de um aliado).
 * Na Tarefa 8, a percepção passa a ser por visão em cone e audição.
 */
export class EnemyIdleState extends EnemyState<"Idle"> {
  readonly name = "Idle" as const;

  update(_dt: number): void {
    this.resetIntent();
    if (!this.ctx.player.isAlive) return;
    const { ai } = this.ctx.type;
    if (this.toPlayer().dist <= ai.aggroRange) {
      // Troca de estado ANTES de gritar: o eco dos aliados não pode alcançá-lo ainda desprevenido.
      this.machine.change("Chase");
      this.ctx.shout(ai.alertRadius);
    }
  }
}
