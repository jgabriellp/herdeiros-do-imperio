/** Parâmetros da câmera em terceira pessoa. Ângulos em radianos. */
export interface ThirdPersonCameraConfig {
  /** Altura do ponto seguido acima dos pés (aprox. ombros). */
  followHeight: number;
  distance: number;
  minDistance: number;
  maxDistance: number;
  zoomStep: number;
  /** Pitch: 0 = horizontal; positivo = câmera acima olhando para baixo. */
  minPitch: number;
  maxPitch: number;
  initialPitch: number;
  /** Suavização do ponto seguido (maior = segue mais colado). */
  followSharpness: number;
  /** Suavização da rotação vinda do mouse/analógico. */
  rotationSharpness: number;
  /** Suavização do zoom e do retorno após uma colisão. */
  distanceSharpness: number;
  /** Folga entre a câmera e a parede atingida. */
  collisionMargin: number;
  /** Abaixo desta distância o personagem começa a ficar transparente... */
  fadeStartDistance: number;
  /** ...e abaixo desta fica invisível (câmera encostada numa parede). */
  fadeEndDistance: number;
  fov: number;
  nearPlane: number;
  // --- mira travada ---
  /** Pitch fixo enquanto travado (levemente de cima, para ver o alvo por cima do ombro). */
  lockPitch: number;
  /** Suavização da rotação travada (menor que a do mouse: a câmera "acompanha", não salta). */
  lockRotationSharpness: number;
  /** Onde a câmera olha entre jogador (0) e alvo (1). */
  lockLookBias: number;
  /** Afasta a câmera conforme o alvo se distancia, para enquadrar os dois. */
  lockDistancePerMeter: number;
  /** Suavização do ponto observado ao entrar/sair da trava. */
  lookSharpness: number;
}

export const DEFAULT_CAMERA_CONFIG: ThirdPersonCameraConfig = {
  followHeight: 1.55,
  distance: 5.5,
  minDistance: 2.5,
  maxDistance: 9,
  zoomStep: 0.6,
  minPitch: -0.2,
  maxPitch: 1.2,
  initialPitch: 0.3,
  followSharpness: 14,
  rotationSharpness: 30,
  distanceSharpness: 6,
  collisionMargin: 0.3,
  fadeStartDistance: 1.6,
  fadeEndDistance: 0.7,
  fov: 0.95,
  nearPlane: 0.05,
  lockPitch: 0.32,
  lockRotationSharpness: 8,
  lockLookBias: 0.4,
  lockDistancePerMeter: 0.3,
  lookSharpness: 10,
};
