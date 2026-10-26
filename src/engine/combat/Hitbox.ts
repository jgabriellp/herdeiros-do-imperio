import { Vector3 } from "@babylonjs/core";
import type { HitboxShape } from "./CombatConfig";
import type { CombatTarget } from "./CombatTypes";

/**
 * Esfera de ataque presa à frente do atacante.
 * Guarda quem já foi atingido nesta ativação: cada golpe acerta o mesmo alvo uma única vez.
 */
export class Hitbox {
  readonly center = new Vector3();
  radius = 0;
  private active = false;
  private readonly alreadyHit = new Set<CombatTarget>();

  get isActive(): boolean {
    return this.active;
  }

  /** Começa uma nova ativação (novo golpe): zera a lista de atingidos. */
  activate(): void {
    this.active = true;
    this.alreadyHit.clear();
  }

  deactivate(): void {
    this.active = false;
  }

  /** Posiciona a esfera a partir dos pés e do yaw do atacante. */
  place(feet: Readonly<Vector3>, facingYaw: number, shape: HitboxShape): void {
    this.radius = shape.radius;
    this.center.set(
      feet.x + Math.sin(facingYaw) * shape.reach,
      feet.y + shape.height,
      feet.z + Math.cos(facingYaw) * shape.reach,
    );
  }

  /** Verdadeiro se acerta o alvo agora e ele ainda não foi atingido nesta ativação. */
  tryHit(target: CombatTarget): boolean {
    if (!this.active || this.alreadyHit.has(target)) return false;
    if (!this.overlaps(target)) return false;
    this.alreadyHit.add(target);
    return true;
  }

  /** Esfera × cápsula vertical: distância da esfera ao eixo da cápsula. */
  private overlaps(target: CombatTarget): boolean {
    const feet = target.feetPosition;
    const r = target.hurtRadius;
    const bottom = feet.y + r;
    const top = feet.y + Math.max(r, target.hurtHeight - r);
    const y = Math.min(Math.max(this.center.y, bottom), top);
    const dx = this.center.x - feet.x;
    const dy = this.center.y - y;
    const dz = this.center.z - feet.z;
    const reach = this.radius + r;
    return dx * dx + dy * dy + dz * dz <= reach * reach;
  }
}
