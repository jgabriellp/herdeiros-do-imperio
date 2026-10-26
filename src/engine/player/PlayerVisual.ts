import type { AbstractMesh, TransformNode } from "@babylonjs/core";

/** Estado de locomoção que o visual usa para escolher/misturar animações. */
export interface PlayerVisualState {
  /** Velocidade horizontal atual (m/s). */
  speed: number;
  /** speed normalizada: 0 parado, 1 andando, 2 correndo. */
  speedRatio: number;
  grounded: boolean;
  verticalSpeed: number;
}

/**
 * Aparência do jogador, separada da física e da lógica.
 * Hoje: CapsuleVisual. Depois: um visual que carrega o .glb do Mixamo
 * e mistura animações a partir do PlayerVisualState — sem mudar o controlador.
 *
 * Convenção: a origem de `root` fica nos PÉS do personagem e +Z local é a frente.
 */
export interface PlayerVisual {
  readonly root: TransformNode;
  /** Meshes que projetam sombra. */
  readonly shadowCasters: readonly AbstractMesh[];
  update(state: PlayerVisualState, dt: number): void;
  /** 0 = invisível, 1 = opaco. Usado quando a câmera encosta no personagem. */
  setVisibility(visibility: number): void;
  dispose(): void;
}
