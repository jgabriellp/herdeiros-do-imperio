import { PlayerState } from "./PlayerState";

/**
 * Caído: sem controle. Não sai sozinho: quem decide o renascimento
 * (no último checkpoint) é o RespawnSystem.
 */
export class PlayerDeadState extends PlayerState<"Dead"> {
  readonly name = "Dead" as const;

  update(dt: number): void {
    this.elapsed += dt;
    this.resetIntent();
    this.ctx.action = { kind: "dead", elapsed: this.elapsed };
  }

  override exit(): void {
    this.ctx.action = null;
  }
}
