import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type AbstractMesh,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import { damp } from "../core/mathUtils";
import type { PlayerVisual, PlayerVisualState } from "./PlayerVisual";

const BODY_COLOR = Color3.FromHexString("#3d5a80");
const INDICATOR_COLOR = Color3.FromHexString("#f2c14e");
/** Inclinação máxima para frente ao correr (radianos): dá leitura de aceleração. */
const MAX_LEAN = 0.12;
const LEAN_SHARPNESS = 10;

/** Visual provisório: cápsula com um "visor" indicando a frente. */
export class CapsuleVisual implements PlayerVisual {
  readonly root: TransformNode;
  readonly shadowCasters: readonly AbstractMesh[];
  private readonly body: TransformNode;
  private readonly materials: StandardMaterial[] = [];
  private lean = 0;

  constructor(scene: Scene, height: number, radius: number) {
    this.root = new TransformNode("playerVisual", scene);
    // Pivô nos pés: inclinar o corpo gira a partir do chão, como uma pessoa.
    this.body = new TransformNode("playerBody", scene);
    this.body.parent = this.root;

    const capsule = MeshBuilder.CreateCapsule("playerCapsule", { height, radius, tessellation: 16 }, scene);
    capsule.parent = this.body;
    capsule.position.y = height / 2;
    capsule.material = this.material(scene, "playerBodyMat", BODY_COLOR);

    const visor = MeshBuilder.CreateBox("playerFacing", { width: radius * 1.2, height: 0.14, depth: 0.2 }, scene);
    visor.parent = this.body;
    visor.position.set(0, height * 0.8, radius * 0.85);
    visor.material = this.material(scene, "playerFacingMat", INDICATOR_COLOR, true);

    const meshes: Mesh[] = [capsule, visor];
    for (const m of meshes) m.isPickable = false;
    this.shadowCasters = meshes;
  }

  update(state: PlayerVisualState, dt: number): void {
    const targetLean = state.grounded ? Math.min(state.speedRatio / 2, 1) * MAX_LEAN : 0;
    this.lean += (targetLean - this.lean) * damp(LEAN_SHARPNESS, dt);
    this.body.rotation.x = this.lean;
  }

  setVisibility(visibility: number): void {
    for (const mesh of this.shadowCasters) mesh.visibility = visibility;
  }

  dispose(): void {
    this.root.dispose(false, true);
    for (const m of this.materials) m.dispose();
  }

  private material(scene: Scene, name: string, color: Color3, glow = false): StandardMaterial {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = color;
    mat.specularColor = new Color3(0.15, 0.15, 0.15);
    if (glow) mat.emissiveColor = color.scale(0.35);
    this.materials.push(mat);
    return mat;
  }
}
