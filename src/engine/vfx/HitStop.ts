import type { Scene } from "@babylonjs/core";

/**
 * Hit stop: congela a lógica de jogo e a física por alguns milissegundos no impacto.
 * Dá "peso" ao golpe. O GameLoop consulta `frozen` para zerar o dt da fase "update".
 */
export class HitStop {
  private remaining = 0;

  constructor(private readonly scene: Scene) {}

  get frozen(): boolean {
    return this.remaining > 0;
  }

  /** Inicia (ou estende) uma pausa; vários acertos no mesmo quadro não somam. */
  trigger(seconds: number): void {
    this.remaining = Math.max(this.remaining, seconds);
    this.scene.physicsEnabled = false;
  }

  /** Avança no tempo REAL (não afetado pela própria pausa). */
  update(realDt: number): void {
    if (this.remaining <= 0) return;
    this.remaining -= realDt;
    if (this.remaining <= 0) {
      this.remaining = 0;
      this.scene.physicsEnabled = true;
    }
  }

  dispose(): void {
    this.remaining = 0;
    if (!this.scene.isDisposed) this.scene.physicsEnabled = true;
  }
}
