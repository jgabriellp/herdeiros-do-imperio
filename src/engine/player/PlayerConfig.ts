import type { CapsuleShapeConfig, MovementConfig } from "../character/CharacterConfig";

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  walkSpeed: 4.5,
  runSpeed: 8,
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

export const DEFAULT_CAPSULE_CONFIG: CapsuleShapeConfig = {
  height: 1.8,
  radius: 0.35,
  maxStepHeight: 0.35,
  maxSlopeDegrees: 50,
};
