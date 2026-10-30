import type { Vector3 } from "@babylonjs/core";
import type { CombatTarget, Faction, HitInfo, HitOutcome } from "./CombatTypes";
import type { Hitbox } from "./Hitbox";

/** O que um golpe precisa informar para ser resolvido (golpes do jogador e de inimigos). */
export interface HitSpec {
  damage: number;
  knockback: number;
  targetHitStun: number;
  heavy: boolean;
}

export interface HitEvent {
  target: CombatTarget;
  attackerFaction: Faction;
  hit: HitInfo;
  outcome: HitOutcome;
  /** Onde o golpe acertou (centro da hitbox). Válido só durante o callback. */
  point: Readonly<Vector3>;
}

type HitListener = (event: HitEvent) => void;

/**
 * Registro de quem pode levar golpes e resolução de acertos.
 * Efeitos (partículas, tremida, hit stop) se inscrevem em onHit, sem acoplar ao golpe.
 */
export class DamageSystem {
  private readonly targets = new Set<CombatTarget>();
  private readonly listeners = new Set<HitListener>();

  register(target: CombatTarget): void {
    this.targets.add(target);
  }

  unregister(target: CombatTarget): void {
    this.targets.delete(target);
  }

  /** Alvos vivos de uma facção (ex.: candidatos para a mira travada). */
  *aliveTargets(faction: Faction): Iterable<CombatTarget> {
    for (const t of this.targets) if (t.faction === faction && t.isAlive) yield t;
  }

  onHit(listener: HitListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Aplica o golpe a todos os alvos inimigos tocados pela hitbox (uma vez cada). */
  resolve(hitbox: Hitbox, attackerFaction: Faction, attackerX: number, attackerZ: number, attack: HitSpec): HitEvent[] {
    const events: HitEvent[] = [];
    for (const target of this.targets) {
      if (target.faction === attackerFaction || !target.isAlive) continue;
      if (!hitbox.tryHit(target)) continue;

      // Empurra para longe do atacante (ou para frente da hitbox, se estiverem sobrepostos).
      let dx = target.feetPosition.x - attackerX;
      let dz = target.feetPosition.z - attackerZ;
      let len = Math.hypot(dx, dz);
      if (len < 1e-3) {
        dx = hitbox.center.x - attackerX;
        dz = hitbox.center.z - attackerZ;
        len = Math.hypot(dx, dz) || 1;
      }
      const hit: HitInfo = {
        damage: attack.damage,
        directionX: dx / len,
        directionZ: dz / len,
        knockback: attack.knockback,
        hitStun: attack.targetHitStun,
        heavy: attack.heavy,
      };
      const outcome = target.receiveHit(hit);
      if (outcome === "ignored") continue;
      const event: HitEvent = { target, attackerFaction, hit, outcome, point: hitbox.center };
      events.push(event);
      for (const listener of this.listeners) listener(event);
    }
    return events;
  }

  /**
   * Aplica um golpe já calculado a um alvo específico (projéteis: o acerto foi decidido
   * por quem disparou). Respeita facção e notifica `onHit` como os golpes corpo a corpo.
   */
  applyDirect(target: CombatTarget, attackerFaction: Faction, hit: HitInfo, point: Readonly<Vector3>): HitOutcome {
    if (target.faction === attackerFaction || !target.isAlive) return "ignored";
    const outcome = target.receiveHit(hit);
    if (outcome === "ignored") return outcome;
    const event: HitEvent = { target, attackerFaction, hit, outcome, point };
    for (const listener of this.listeners) listener(event);
    return outcome;
  }

  dispose(): void {
    this.targets.clear();
    this.listeners.clear();
  }
}
