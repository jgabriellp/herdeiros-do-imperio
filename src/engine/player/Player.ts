import type { Scene, ShadowGenerator } from "@babylonjs/core";
import type { Vec3Data } from "../../shared/types";
import type { InputManager } from "../core/input/InputManager";
import { CapsuleVisual } from "./CapsuleVisual";
import { DEFAULT_CAPSULE_CONFIG, DEFAULT_MOVEMENT_CONFIG } from "./PlayerConfig";
import { PlayerController } from "./PlayerController";
import { PlayerMotor } from "./PlayerMotor";
import type { PlayerVisual } from "./PlayerVisual";

/** Monta o jogador (corpo físico + visual + controlador) e o libera junto. */
export class Player {
  readonly motor: PlayerMotor;
  readonly visual: PlayerVisual;
  readonly controller: PlayerController;

  constructor(scene: Scene, input: InputManager, spawn: Vec3Data, shadows: ShadowGenerator | null) {
    const shape = DEFAULT_CAPSULE_CONFIG;
    this.motor = new PlayerMotor(scene, spawn, shape, DEFAULT_MOVEMENT_CONFIG);
    // Trocar por um visual .glb (Mixamo) = trocar só esta linha.
    this.visual = new CapsuleVisual(scene, shape.height, shape.radius);
    this.controller = new PlayerController(input, this.motor, this.visual, DEFAULT_MOVEMENT_CONFIG, spawn);
    for (const mesh of this.visual.shadowCasters) shadows?.addShadowCaster(mesh);
  }

  /** Deixa o personagem transparente quando a câmera chega perto demais. */
  fadeForCamera(distance: number, fadeStart: number, fadeEnd: number): void {
    const t = (distance - fadeEnd) / (fadeStart - fadeEnd);
    this.visual.setVisibility(Math.min(1, Math.max(0, t)));
  }

  dispose(): void {
    this.visual.dispose();
    this.motor.dispose();
  }
}
