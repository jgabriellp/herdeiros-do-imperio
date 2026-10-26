import type { Vector3 } from "@babylonjs/core";

/** Lado no combate: golpes nunca acertam alguém da mesma facção. */
export type Faction = "player" | "enemy";

/** Um golpe que acertou. */
export interface HitInfo {
  damage: number;
  /** Direção horizontal normalizada do empurrão (do atacante para o alvo). */
  directionX: number;
  directionZ: number;
  /** Velocidade inicial do empurrão (m/s). */
  knockback: number;
  /** Quanto tempo o alvo fica atordoado. */
  hitStun: number;
  /** Golpe forte: usado para efeitos mais intensos (tremida de câmera etc.). */
  heavy: boolean;
}

/** Resultado do golpe do ponto de vista do alvo. */
export type HitOutcome = "hit" | "killed" | "ignored";

/**
 * Qualquer coisa que pode levar golpes e ser travada pela mira.
 * O "hurtbox" é uma cápsula vertical: pés + raio + altura.
 */
export interface CombatTarget {
  readonly id: string;
  readonly faction: Faction;
  readonly isAlive: boolean;
  /** Pés (referência viva; não modificar). */
  readonly feetPosition: Readonly<Vector3>;
  readonly hurtRadius: number;
  readonly hurtHeight: number;
  /** Ponto onde a mira e o marcador apontam (aprox. o peito). */
  readonly lockOnHeight: number;
  receiveHit(hit: HitInfo): HitOutcome;
}
