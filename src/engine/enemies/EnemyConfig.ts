import type { CapsuleShapeConfig } from "../character/CharacterConfig";
import type { HitboxShape } from "../combat/CombatConfig";

/** Golpe de um tipo de inimigo. O DANO vem do encounters.json (stats.damage). */
export interface EnemyAttackConfig {
  /** Distância (entre pés) a partir da qual o inimigo começa o golpe. */
  range: number;
  /** Preparação com aviso visual: tempo que o jogador tem para reagir. */
  windup: number;
  active: number;
  recovery: number;
  /** Quanto o inimigo ainda gira para acompanhar o jogador durante a preparação (0 = trava a mira). */
  windupTurnSharpness: number;
  lungeSpeed: number;
  knockback: number;
  /** Atordoamento causado no jogador. */
  targetHitStun: number;
  heavy: boolean;
  hitbox: HitboxShape;
  /** Intervalo aleatório entre ataques do mesmo inimigo. */
  cooldownMin: number;
  cooldownMax: number;
  /** Recuo quando o golpe bate no escudo do jogador. */
  blockedRecoil: { knockback: number; hitStun: number };
}

export interface EnemyAiConfig {
  /** Percebe o jogador a esta distância. */
  aggroRange: number;
  /** Entra na luta se um aliado a esta distância já estiver lutando (alerta de grupo). */
  alertRadius: number;
  /** Desiste se o jogador passar desta distância. */
  loseAggroRange: number;
  /** Distância mantida enquanto ronda esperando a vez de atacar. */
  circleRadius: number;
  /** Fração da velocidade usada ao rondar. */
  circleSpeedFactor: number;
  /** Tempo médio até trocar o sentido da ronda (dá variedade). */
  circleSwitchTime: number;
  /** Distância mínima desejada entre inimigos (evita amontoar). */
  separationRadius: number;
  /** Nitidez do giro para encarar o jogador. */
  turnSharpness: number;
  /** Com a vez de atacar, desiste e devolve a vez se não alcançar o jogador neste tempo. */
  approachTimeout: number;
}

/**
 * Características de um TIPO de inimigo (o "type" do encounters.json).
 * Atributos por instância (vida, dano, velocidade) vêm do encounters.json.
 */
export interface EnemyTypeConfig {
  shape: CapsuleShapeConfig;
  bodyColor: string;
  accentColor: string;
  /** Atrito do empurrão sofrido (maior = para mais rápido). */
  knockbackDrag: number;
  /** Duração do piscar vermelho ao ser atingido. */
  hitFlashDuration: number;
  /** Duração da queda ao morrer. */
  deathFallDuration: number;
  /** Tempo caído antes de sumir da cena. */
  corpseLingerTime: number;
  ai: EnemyAiConfig;
  attack: EnemyAttackConfig;
}

/** Regras do grupo: quantos atacam ao mesmo tempo (combate em grupo justo e legível). */
export interface AttackCoordinatorConfig {
  maxSimultaneousAttackers: number;
  /** Intervalo mínimo entre o INÍCIO de dois ataques (mesmo com vaga livre). */
  minTimeBetweenAttacks: number;
}

export const DEFAULT_ATTACK_COORDINATOR_CONFIG: AttackCoordinatorConfig = {
  maxSimultaneousAttackers: 2,
  minTimeBetweenAttacks: 0.8,
};

/** Tipos conhecidos pelo motor. Novo tipo de inimigo = nova entrada aqui. */
export const ENEMY_TYPES: Record<string, EnemyTypeConfig> = {
  vandalo: {
    shape: { height: 1.75, radius: 0.38, maxStepHeight: 0.35, maxSlopeDegrees: 50 },
    bodyColor: "#8c4a2f",
    accentColor: "#4a4038",
    knockbackDrag: 7,
    hitFlashDuration: 0.12,
    deathFallDuration: 0.45,
    corpseLingerTime: 1.5,
    ai: {
      aggroRange: 12,
      alertRadius: 12,
      loseAggroRange: 25,
      circleRadius: 4.5,
      circleSpeedFactor: 0.45,
      circleSwitchTime: 3,
      separationRadius: 1.6,
      turnSharpness: 8,
      approachTimeout: 4,
    },
    attack: {
      range: 1.7,
      windup: 0.6,
      active: 0.12,
      recovery: 0.7,
      windupTurnSharpness: 4,
      lungeSpeed: 3.5,
      knockback: 6,
      targetHitStun: 0.4,
      heavy: false,
      hitbox: { radius: 0.55, reach: 0.95, height: 1.1 },
      cooldownMin: 1.2,
      cooldownMax: 2.4,
      blockedRecoil: { knockback: 3, hitStun: 0.45 },
    },
  },
};
