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

/** Como o inimigo percebe o jogador (visão, audição) e quanto tempo leva para ter certeza. */
export interface PerceptionConfig {
  /** Alcance da visão (m). */
  visionRange: number;
  /** Metade do ângulo do cone de visão (graus). */
  visionHalfAngleDeg: number;
  /** Abaixo desta distância percebe em qualquer direção (sente a presença). */
  peripheralRange: number;
  /** Altura dos olhos. */
  eyeHeight: number;
  /** Tempo para ter certeza (medidor 0→1) vendo o jogador de perto (≤ peripheralRange)... */
  detectTimeNear: number;
  /** ...e no limite do alcance (interpolado entre os dois). */
  detectTimeFar: number;
  /** A partir deste valor do medidor fica desconfiado (?) e investiga. */
  suspiciousThreshold: number;
  /** Quanto o medidor cai por segundo sem ver nada. */
  decayPerSecond: number;
  /** Em alerta, sem ver o jogador por este tempo, vai investigar o último lugar onde o viu. */
  loseSightTime: number;
}

export interface InvestigateConfig {
  /** Fração da velocidade ao ir investigar/voltar ao posto. */
  speedFactor: number;
  /** Tempo olhando em volta no ponto investigado. */
  lookAroundTime: number;
  /** Desiste de chegar ao ponto (caminho bloqueado) depois deste tempo. */
  maxTravelTime: number;
  /** Parado no posto, olha em volta a cada X segundos (aleatório entre min e max)... */
  idleGlanceMin: number;
  idleGlanceMax: number;
  /** ...até este ângulo (graus) para cada lado da direção original. */
  idleGlanceDeg: number;
}

export interface EnemyAiConfig {
  perception: PerceptionConfig;
  investigate: InvestigateConfig;
  /**
   * Raio do grito de alerta: ao avistar o jogador ou ser atingido, o inimigo grita e os
   * aliados desprevenidos a esta distância entram na luta. Abate silencioso não grita.
   */
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
  /** Tempo caído antes de sumir da cena (longo: corpos podem ser encontrados por aliados). */
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
    corpseLingerTime: 90,
    ai: {
      perception: {
        visionRange: 14,
        visionHalfAngleDeg: 55,
        peripheralRange: 2.5,
        eyeHeight: 1.6,
        detectTimeNear: 0.25,
        detectTimeFar: 2.2,
        suspiciousThreshold: 0.35,
        decayPerSecond: 0.2,
        loseSightTime: 5,
      },
      investigate: {
        speedFactor: 0.6,
        lookAroundTime: 3,
        maxTravelTime: 10,
        idleGlanceMin: 3,
        idleGlanceMax: 6,
        idleGlanceDeg: 45,
      },
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
