/**
 * Todos os números do combate. Nenhum tempo/dano/alcance fica fixo na lógica.
 * Tempos em segundos, distâncias em metros, velocidades em m/s.
 */

export type AttackId = "punch1" | "punch2" | "punch3" | "kick";
export type AttackKind = "punch" | "kick";

export interface HitboxShape {
  radius: number;
  /** Distância à frente dos pés do atacante. */
  reach: number;
  /** Altura acima dos pés. */
  height: number;
}

export interface AttackConfig {
  kind: AttackKind;
  /** Preparação: o golpe já começou, mas ainda não acerta. */
  windup: number;
  /** Janela ativa: hitbox ligada. */
  active: number;
  /** Recuperação: golpe acabou, personagem vulnerável e ainda preso na animação. */
  recovery: number;
  damage: number;
  knockback: number;
  /** Atordoamento causado no alvo. */
  targetHitStun: number;
  /** Avanço do atacante durante preparação + janela ativa. */
  lungeSpeed: number;
  hitbox: HitboxShape;
  heavy: boolean;
  /** Próximo golpe do combo (null = finalizador). */
  next: AttackId | null;
  /** Até quanto tempo após o fim da janela ativa o próximo golpe pode ser pedido. */
  chainInputWindow: number;
  /** Quanto da recuperação precisa passar antes do próximo golpe (já pedido) começar. */
  chainCancelAfter: number;
  /** A partir de quanto da recuperação a esquiva pode cancelar o golpe. */
  dodgeCancelAfter: number;
}

export interface DodgeConfig {
  duration: number;
  /** Velocidade no início; cai até speedEndFactor×speed no fim (desacelera ao sair do rolamento). */
  speed: number;
  speedEndFactor: number;
  /** Janela de invulnerabilidade (segundos desde o início). */
  invulnerableFrom: number;
  invulnerableUntil: number;
  staminaCost: number;
}

export interface StaminaConfig {
  regenPerSecond: number;
  /** Espera após gastar stamina antes de começar a regenerar. */
  regenDelay: number;
}

export interface PlayerHitReactionConfig {
  /** Atrito do empurrão sofrido (maior = para mais rápido). */
  knockbackDrag: number;
  /** Invulnerabilidade após levar um golpe, para não ser "travado" por um grupo. */
  postHitInvulnerability: number;
}

export interface TargetLockConfig {
  /** Distância máxima para travar. */
  acquireDistance: number;
  /** Ângulo máximo (graus) entre a frente da câmera e o alvo para travar. */
  acquireHalfAngleDeg: number;
  /** Peso do ângulo na escolha (maior = prefere o que está mais ao centro). */
  anglePreference: number;
  /** Acima desta distância a trava solta sozinha. */
  breakDistance: number;
  /** Velocidade máxima de deslocamento travado (strafe). */
  lockedMoveSpeed: number;
}

export interface CombatConfig {
  attacks: Record<AttackId, AttackConfig>;
  comboStarter: AttackId;
  kick: AttackId;
  dodge: DodgeConfig;
  stamina: StaminaConfig;
  playerHitReaction: PlayerHitReactionConfig;
  lock: TargetLockConfig;
}

const PUNCH_HITBOX: HitboxShape = { radius: 0.45, reach: 0.75, height: 1.25 };

export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  attacks: {
    punch1: {
      kind: "punch",
      windup: 0.08,
      active: 0.08,
      recovery: 0.3,
      damage: 8,
      knockback: 1.5,
      targetHitStun: 0.3,
      lungeSpeed: 2.5,
      hitbox: PUNCH_HITBOX,
      heavy: false,
      next: "punch2",
      chainInputWindow: 0.3,
      chainCancelAfter: 0.06,
      dodgeCancelAfter: 0.05,
    },
    punch2: {
      kind: "punch",
      windup: 0.07,
      active: 0.08,
      recovery: 0.3,
      damage: 9,
      knockback: 1.5,
      targetHitStun: 0.3,
      lungeSpeed: 2.5,
      hitbox: PUNCH_HITBOX,
      heavy: false,
      next: "punch3",
      chainInputWindow: 0.3,
      chainCancelAfter: 0.06,
      dodgeCancelAfter: 0.05,
    },
    punch3: {
      kind: "punch",
      windup: 0.15,
      active: 0.1,
      recovery: 0.45,
      damage: 15,
      knockback: 4.5,
      targetHitStun: 0.45,
      lungeSpeed: 3.5,
      hitbox: { radius: 0.5, reach: 0.8, height: 1.35 },
      heavy: true,
      next: null,
      chainInputWindow: 0,
      chainCancelAfter: 0,
      dodgeCancelAfter: 0.15,
    },
    kick: {
      kind: "kick",
      windup: 0.22,
      active: 0.12,
      recovery: 0.45,
      damage: 20,
      knockback: 12,
      targetHitStun: 0.6,
      lungeSpeed: 1.5,
      hitbox: { radius: 0.55, reach: 0.9, height: 0.7 },
      heavy: true,
      next: null,
      chainInputWindow: 0,
      chainCancelAfter: 0,
      dodgeCancelAfter: 0.2,
    },
  },
  comboStarter: "punch1",
  kick: "kick",
  dodge: {
    duration: 0.38,
    speed: 11,
    speedEndFactor: 0.25,
    invulnerableFrom: 0.02,
    invulnerableUntil: 0.3,
    staminaCost: 25,
  },
  stamina: {
    regenPerSecond: 30,
    regenDelay: 0.8,
  },
  playerHitReaction: {
    knockbackDrag: 9,
    postHitInvulnerability: 0.6,
  },
  lock: {
    acquireDistance: 15,
    acquireHalfAngleDeg: 70,
    anglePreference: 0.5,
    breakDistance: 22,
    lockedMoveSpeed: 4.5,
  },
};
