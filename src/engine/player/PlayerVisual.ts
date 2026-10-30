import type { AbstractMesh, TransformNode } from "@babylonjs/core";
import type { AttackKind } from "../combat/CombatConfig";
import type { WeaponMode } from "./PlayerEquipment";

export type AttackPhase = "windup" | "active" | "recovery";

/** Ação em andamento, para o visual animar (procedural hoje, Mixamo depois). */
export type VisualAction =
  | {
      kind: AttackKind;
      /** Posição no combo (0, 1, 2...): alterna o braço, finalizador mais amplo. */
      comboIndex: number;
      phase: AttackPhase;
      /** 0..1 dentro da fase atual. */
      phaseProgress: number;
    }
  | {
      kind: "dodge";
      /** 0..1 da esquiva. */
      progress: number;
      /** Direção da esquiva no espaço LOCAL do personagem (+z = frente). */
      localX: number;
      localZ: number;
      invulnerable: boolean;
    }
  | { kind: "hitStun"; progress: number }
  | {
      kind: "aim";
      /** Tensão da corda 0..1. */
      charge: number;
      raised: boolean;
    }
  | {
      kind: "block";
      /** 0..1: força do tranco de um golpe recém-bloqueado (decai até 0). */
      impact: number;
    }
  | { kind: "dead"; elapsed: number };

/** Estado que o visual usa para escolher/misturar animações. */
export interface PlayerVisualState {
  /** Velocidade horizontal atual (m/s). */
  speed: number;
  /** speed normalizada: 0 parado, 1 andando, 2 correndo. */
  speedRatio: number;
  grounded: boolean;
  crouched: boolean;
  verticalSpeed: number;
  action: VisualAction | null;
  /** Itens equipados e o que está empunhado (o resto fica guardado nas costas). */
  gear: { sword: string | null; shield: string | null; bow: string | null; mode: WeaponMode };
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
