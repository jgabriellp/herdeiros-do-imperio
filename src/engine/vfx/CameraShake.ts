import { Vector3 } from "@babylonjs/core";

/**
 * Tremida de câmera: produz um deslocamento que decai até zero.
 * Ruído suave (soma de senos em frequências diferentes por eixo), não aleatório por quadro,
 * para tremer sem "teletransportar" a câmera.
 */
export class CameraShake {
  readonly offset = new Vector3();
  private amplitude = 0;
  private duration = 0;
  private remaining = 0;
  private time = 0;

  trigger(amplitude: number, duration: number): void {
    // Uma tremida mais fraca não interrompe uma mais forte em andamento.
    const currentStrength = this.duration > 0 ? this.amplitude * (this.remaining / this.duration) : 0;
    if (amplitude < currentStrength) return;
    this.amplitude = amplitude;
    this.duration = this.remaining = duration;
  }

  /** Avança em tempo real (a tremida continua durante o hit stop). */
  update(dt: number): void {
    if (this.remaining <= 0) {
      this.offset.setAll(0);
      return;
    }
    this.time += dt;
    this.remaining = Math.max(0, this.remaining - dt);
    const fade = this.remaining / this.duration;
    const a = this.amplitude * fade * fade;
    const t = this.time;
    this.offset.set(
      a * (Math.sin(t * 61) * 0.6 + Math.sin(t * 37) * 0.4),
      a * (Math.sin(t * 53 + 1.3) * 0.6 + Math.sin(t * 29) * 0.4),
      a * 0.5 * Math.sin(t * 47 + 2.1),
    );
  }
}
