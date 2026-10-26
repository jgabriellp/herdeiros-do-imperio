/**
 * Camadas de colisão (máscaras de bits do Havok).
 * Usadas para filtrar consultas: ex. a câmera só colide com WORLD.
 */
export const CollisionLayers = {
  /** Cenário estático: chão, paredes, pilares. */
  WORLD: 1 << 0,
  /** Objetos dinâmicos soltos (caixas). Não bloqueiam a câmera. */
  PROP: 1 << 1,
  PLAYER: 1 << 2,
  ENEMY: 1 << 3,
} as const;
