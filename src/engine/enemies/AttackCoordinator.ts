import type { AttackCoordinatorConfig } from "./EnemyConfig";

/**
 * "Fichas de ataque": só quem tem ficha avança para bater; os outros rondam.
 * Garante no máximo N atacantes ao mesmo tempo e um intervalo entre os golpes,
 * como nos combates em grupo de Zelda.
 */
export class AttackCoordinator {
  private readonly holders = new Set<object>();
  private sinceLastGrant = Infinity;

  constructor(private readonly config: AttackCoordinatorConfig) {}

  get activeAttackers(): number {
    return this.holders.size;
  }

  holds(enemy: object): boolean {
    return this.holders.has(enemy);
  }

  /** Pede a vez de atacar. Retorna true se ganhou (ou já tinha) a ficha. */
  tryAcquire(enemy: object): boolean {
    if (this.holders.has(enemy)) return true;
    if (this.holders.size >= this.config.maxSimultaneousAttackers) return false;
    if (this.sinceLastGrant < this.config.minTimeBetweenAttacks) return false;
    this.holders.add(enemy);
    this.sinceLastGrant = 0;
    return true;
  }

  /** Devolve a ficha (fim do ataque, atordoado, morto...). */
  release(enemy: object): void {
    this.holders.delete(enemy);
  }

  update(dt: number): void {
    this.sinceLastGrant += dt;
  }
}
