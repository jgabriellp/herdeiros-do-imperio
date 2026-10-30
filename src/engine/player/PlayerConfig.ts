import type { CapsuleShapeConfig, MovementConfig } from "../character/CharacterConfig";

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  walkSpeed: 4.5,
  runSpeed: 8,
  crouchSpeed: 2.2,
  groundAcceleration: 35,
  groundDeceleration: 45,
  airControl: 0.35,
  turnSharpness: 14,
  jumpHeight: 1.4,
  gravity: 25,
  fallGravityMultiplier: 1.6,
  maxFallSpeed: 30,
  groundStickSpeed: 2,
  coyoteTime: 0.1,
  jumpBufferTime: 0.12,
  fallRespawnY: -30,
};

/** Furtividade do jogador: quanto barulho os passos fazem. */
export interface StealthConfig {
  /** Raio (m) do som dos passos por m/s de velocidade, em pé. */
  footstepRadiusPerSpeed: number;
  /** Multiplicador desse raio agachado. */
  crouchNoiseFactor: number;
  /** Agachado, os inimigos precisam estar mais perto para ver (multiplica o alcance da visão)... */
  crouchVisionRangeFactor: number;
  /** ...e demoram mais para ter certeza (multiplica o tempo de detecção). */
  crouchDetectionTimeFactor: number;
}

export const DEFAULT_STEALTH_CONFIG: StealthConfig = {
  footstepRadiusPerSpeed: 1.1,
  crouchNoiseFactor: 0.2,
  crouchVisionRangeFactor: 0.6,
  crouchDetectionTimeFactor: 1.6,
};

export const DEFAULT_CAPSULE_CONFIG: CapsuleShapeConfig = {
  height: 1.8,
  radius: 0.35,
  maxStepHeight: 0.35,
  maxSlopeDegrees: 50,
};
