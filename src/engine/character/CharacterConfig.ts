/** Valores de movimento de um personagem (jogador ou inimigo). Unidades: metros, segundos, radianos. */
export interface MovementConfig {
  walkSpeed: number;
  runSpeed: number;
  /** Velocidade agachado (furtivo). */
  crouchSpeed: number;
  /** Aceleração no chão com input (m/s²). */
  groundAcceleration: number;
  /** Desaceleração no chão sem input (m/s²). */
  groundDeceleration: number;
  /** Fração da aceleração disponível no ar (0..1). */
  airControl: number;
  /** Nitidez da rotação rumo à direção do movimento (maior = vira mais rápido). */
  turnSharpness: number;
  jumpHeight: number;
  /** Gravidade do personagem (m/s²), mais forte que a real para o pulo não parecer "lunar". */
  gravity: number;
  /** Multiplicador da gravidade na descida (queda mais firme que a subida). */
  fallGravityMultiplier: number;
  maxFallSpeed: number;
  /**
   * Velocidade que pressiona o personagem contra o chão enquanto apoiado.
   * Sem isso ele "flutua" na folga de contato do controlador após um pulo.
   */
  groundStickSpeed: number;
  /** Tempo após sair de uma borda em que ainda dá para pular. */
  coyoteTime: number;
  /** Tempo em que um pulo apertado pouco antes de tocar o chão ainda vale. */
  jumpBufferTime: number;
  /** Abaixo desta altura o personagem caiu do mundo (proteção contra queda infinita). */
  fallRespawnY: number;
}

export interface CapsuleShapeConfig {
  height: number;
  radius: number;
  /** Maior degrau subido automaticamente. */
  maxStepHeight: number;
  /** Rampa mais íngreme em que dá para andar, em graus. */
  maxSlopeDegrees: number;
}
