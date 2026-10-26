import type { TargetLockConfig } from "./CombatConfig";
import type { CombatTarget } from "./CombatTypes";

/**
 * Mira travada estilo Zelda: escolhe o alvo mais próximo à frente da câmera,
 * mantém a trava e a solta quando o alvo morre ou se afasta demais.
 */
export class TargetLock {
  private _target: CombatTarget | null = null;

  constructor(
    private readonly config: TargetLockConfig,
    private readonly candidates: () => Iterable<CombatTarget>,
  ) {}

  get target(): CombatTarget | null {
    return this._target;
  }

  /**
   * Tenta travar a partir da posição do jogador e da direção da câmera.
   * Retorna o alvo travado ou null se nada estiver à frente.
   */
  acquire(fromX: number, fromZ: number, viewYaw: number): CombatTarget | null {
    const cfg = this.config;
    const maxAngle = (cfg.acquireHalfAngleDeg * Math.PI) / 180;
    const fx = Math.sin(viewYaw);
    const fz = Math.cos(viewYaw);

    let best: CombatTarget | null = null;
    let bestScore = Infinity;
    for (const t of this.candidates()) {
      const dx = t.feetPosition.x - fromX;
      const dz = t.feetPosition.z - fromZ;
      const dist = Math.hypot(dx, dz);
      if (dist > cfg.acquireDistance) continue;
      const angle = dist < 1e-3 ? 0 : Math.acos(Math.min(1, Math.max(-1, (dx * fx + dz * fz) / dist)));
      if (angle > maxAngle) continue;
      // Distância penalizada pelo desvio do centro da tela.
      const score = dist * (1 + cfg.anglePreference * (angle / maxAngle));
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    this._target = best;
    return best;
  }

  release(): void {
    this._target = null;
  }

  /** Solta a trava se o alvo morreu ou ficou longe demais. Retorna true se soltou. */
  validate(fromX: number, fromZ: number): boolean {
    const t = this._target;
    if (!t) return false;
    const dist = Math.hypot(t.feetPosition.x - fromX, t.feetPosition.z - fromZ);
    if (t.isAlive && dist <= this.config.breakDistance) return false;
    this._target = null;
    return true;
  }
}
