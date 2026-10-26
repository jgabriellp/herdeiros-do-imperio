import type { Vec3Data } from "../../shared/types";

export interface RespawnHooks {
  /** Mostrar a tela de morte. */
  onDeath(): void;
  /** Onde renascer (último checkpoint salvo). */
  respawnPoint(): Vec3Data;
  /** Trazer o jogador de volta (e reposicionar o que for preciso). */
  respawn(point: Vec3Data): void;
}

/** Morte → espera → renascimento no último checkpoint. */
export class RespawnSystem {
  private timer = -1;

  constructor(
    private readonly respawnDelay: number,
    private readonly hooks: RespawnHooks,
  ) {}

  get pending(): boolean {
    return this.timer >= 0;
  }

  playerDied(): void {
    if (this.pending) return;
    this.timer = this.respawnDelay;
    this.hooks.onDeath();
  }

  update(dt: number): void {
    if (!this.pending) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = -1;
    this.hooks.respawn(this.hooks.respawnPoint());
  }
}
