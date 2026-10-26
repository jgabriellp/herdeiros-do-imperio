import type { CapsuleShapeConfig } from "../character/CharacterConfig";

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
}

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
  },
};
