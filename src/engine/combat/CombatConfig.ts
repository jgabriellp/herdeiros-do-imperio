/**
 * Todos os números do combate. Nenhum tempo/dano/alcance fica fixo na lógica.
 * Tempos em segundos, distâncias em metros, velocidades em m/s.
 */

export type AttackId = "punch1" | "punch2" | "punch3" | "kick" | "sword1" | "sword2" | "sword3";
export type AttackKind = "punch" | "kick" | "sword";

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
  /**
   * Varredura da hitbox durante a janela ativa (graus): a esfera percorre um arco de
   * +sweep/2 a -sweep/2 em torno da frente (negativo = sentido inverso). Ausente = parada.
   */
  sweepDeg?: number;
}

export interface BlockConfig {
  /** Velocidade máxima andando com o escudo erguido. */
  moveSpeed: number;
  /** Golpes até este ângulo (graus) da frente do jogador são bloqueados. */
  frontalHalfAngleDeg: number;
  /** Stamina gasta por ponto de dano bloqueado (× multiplicador do escudo)... */
  staminaPerDamage: number;
  /** ...com este mínimo por golpe. */
  minStaminaCost: number;
  /** Fração do empurrão que ainda chega com o escudo. */
  pushbackFactor: number;
  /** Atrito do empurrão no bloqueio. */
  pushbackDrag: number;
  /** Sem stamina para segurar o golpe: guarda quebra e o jogador fica atordoado. */
  guardBreakStun: number;
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

export interface HitStopConfig {
  /** Pausa ao acertar um golpe normal (segundos). */
  light: number;
  /** Pausa ao acertar um golpe forte (finalizador, chute). */
  heavy: number;
}

export interface CameraShakeConfig {
  /** Deslocamento máximo da câmera (metros). */
  amplitude: number;
  duration: number;
}

export interface PlayerDeathConfig {
  /** Tempo caído antes de renascer no checkpoint. */
  respawnDelay: number;
  /** Invulnerabilidade ao renascer (para não morrer de novo na hora). */
  respawnInvulnerability: number;
}

export interface BowConfig {
  /** Tempo para puxar a corda até a tensão máxima. */
  drawTime: number;
  /** Tensão mínima para a flecha sair (soltar antes disso cancela). */
  minCharge: number;
  /** Velocidade da flecha com tensão mínima e máxima (m/s). */
  minSpeed: number;
  maxSpeed: number;
  /** Dano com tensão mínima e máxima. */
  minDamage: number;
  maxDamage: number;
  knockback: number;
  /** Atordoamento causado em inimigo que já estava em combate. */
  targetHitStun: number;
  /** Gravidade da flecha (menor que a real para o tiro ser jogável). */
  gravity: number;
  /** Tempo para encaixar a próxima flecha depois de disparar. */
  nockTime: number;
  /** Tiro sem mirar: puxada curta e tensão fixa. */
  hipDrawTime: number;
  hipCharge: number;
  /** Velocidade andando com a mira. */
  aimMoveSpeed: number;
  /** Alcance do raio da retícula (o ponto que a flecha procura). */
  aimRange: number;
  /** Origem da flecha em relação aos pés: altura e distância à frente. */
  spawnHeight: number;
  spawnForward: number;
  /** Tempo máximo voando; depois some. */
  flightLifetime: number;
  /** Tempo cravada no cenário antes de sumir. */
  stuckLifetime: number;
  /** Máximo de flechas na cena (as mais antigas somem). */
  maxArrows: number;
}

export interface CombatConfig {
  attacks: Record<AttackId, AttackConfig>;
  /** Primeiro golpe do combo de punhos. */
  comboStarter: AttackId;
  /** Primeiro golpe do combo de espada. */
  swordComboStarter: AttackId;
  block: BlockConfig;
  kick: AttackId;
  dodge: DodgeConfig;
  stamina: StaminaConfig;
  playerHitReaction: PlayerHitReactionConfig;
  lock: TargetLockConfig;
  hitStop: HitStopConfig;
  /** Tremida quando um golpe FORTE acerta. */
  heavyHitShake: CameraShakeConfig;
  /** Tremida quando o jogador é atingido. */
  playerHurtShake: CameraShakeConfig;
  death: PlayerDeathConfig;
  bow: BowConfig;
}

const PUNCH_HITBOX: HitboxShape = { radius: 0.45, reach: 0.75, height: 1.25 };
const SWORD_HITBOX: HitboxShape = { radius: 0.55, reach: 1.15, height: 1.15 };

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
    // Espada: mais alcance e dano que os punhos; a lâmina varre um arco.
    sword1: {
      kind: "sword",
      windup: 0.1,
      active: 0.1,
      recovery: 0.32,
      damage: 14,
      knockback: 2,
      targetHitStun: 0.32,
      lungeSpeed: 3,
      hitbox: SWORD_HITBOX,
      heavy: false,
      next: "sword2",
      chainInputWindow: 0.32,
      chainCancelAfter: 0.07,
      dodgeCancelAfter: 0.05,
      sweepDeg: 110,
    },
    sword2: {
      kind: "sword",
      windup: 0.09,
      active: 0.1,
      recovery: 0.32,
      damage: 15,
      knockback: 2,
      targetHitStun: 0.32,
      lungeSpeed: 3,
      hitbox: SWORD_HITBOX,
      heavy: false,
      next: "sword3",
      chainInputWindow: 0.32,
      chainCancelAfter: 0.07,
      dodgeCancelAfter: 0.05,
      sweepDeg: -110,
    },
    sword3: {
      kind: "sword",
      windup: 0.2,
      active: 0.12,
      recovery: 0.5,
      damage: 26,
      knockback: 6.5,
      targetHitStun: 0.5,
      lungeSpeed: 4,
      hitbox: { radius: 0.65, reach: 1.2, height: 1.0 },
      heavy: true,
      next: null,
      chainInputWindow: 0,
      chainCancelAfter: 0,
      dodgeCancelAfter: 0.18,
    },
  },
  comboStarter: "punch1",
  swordComboStarter: "sword1",
  block: {
    moveSpeed: 2.2,
    frontalHalfAngleDeg: 70,
    staminaPerDamage: 1.5,
    minStaminaCost: 10,
    pushbackFactor: 0.35,
    pushbackDrag: 10,
    guardBreakStun: 0.8,
  },
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
  hitStop: {
    light: 0.06,
    heavy: 0.09,
  },
  heavyHitShake: { amplitude: 0.14, duration: 0.28 },
  playerHurtShake: { amplitude: 0.09, duration: 0.2 },
  death: {
    respawnDelay: 2.5,
    respawnInvulnerability: 2,
  },
  bow: {
    drawTime: 0.8,
    minCharge: 0.2,
    minSpeed: 20,
    maxSpeed: 48,
    minDamage: 10,
    maxDamage: 30,
    knockback: 1.2,
    targetHitStun: 0.25,
    gravity: 9,
    nockTime: 0.3,
    hipDrawTime: 0.22,
    hipCharge: 0.45,
    aimMoveSpeed: 2.4,
    aimRange: 80,
    spawnHeight: 1.45,
    spawnForward: 0.5,
    flightLifetime: 4,
    stuckLifetime: 8,
    maxArrows: 40,
  },
};
