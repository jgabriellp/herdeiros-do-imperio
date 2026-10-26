import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type AbstractMesh,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import type { EnemyTypeConfig } from "./EnemyConfig";

const HIT_FLASH = new Color3(1, 0.1, 0.05);

/** Visual provisório de inimigo: cápsula com elmo e faixa indicando a frente. */
export class EnemyVisual {
  readonly root: TransformNode;
  readonly shadowCasters: readonly AbstractMesh[];
  private readonly body: TransformNode;
  private readonly meshes: Mesh[];
  private readonly bodyMaterial: StandardMaterial;
  private readonly materials: StandardMaterial[];

  constructor(scene: Scene, name: string, type: EnemyTypeConfig) {
    const { height, radius } = type.shape;
    this.root = new TransformNode(`${name}_visual`, scene);
    this.body = new TransformNode(`${name}_body`, scene);
    this.body.parent = this.root;

    this.bodyMaterial = new StandardMaterial(`${name}_bodyMat`, scene);
    this.bodyMaterial.diffuseColor = Color3.FromHexString(type.bodyColor);
    this.bodyMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    const accent = new StandardMaterial(`${name}_accentMat`, scene);
    accent.diffuseColor = Color3.FromHexString(type.accentColor);
    accent.specularColor = new Color3(0.3, 0.3, 0.3);
    this.materials = [this.bodyMaterial, accent];

    const capsule = MeshBuilder.CreateCapsule(`${name}_capsule`, { height, radius, tessellation: 16 }, scene);
    capsule.parent = this.body;
    capsule.position.y = height / 2;
    capsule.material = this.bodyMaterial;

    const helmet = MeshBuilder.CreateCylinder(`${name}_helmet`, { diameter: radius * 2.15, height: 0.22, tessellation: 16 }, scene);
    helmet.parent = this.body;
    helmet.position.y = height - 0.2;
    helmet.material = accent;

    const front = MeshBuilder.CreateBox(`${name}_front`, { width: radius * 1.1, height: 0.1, depth: 0.15 }, scene);
    front.parent = this.body;
    front.position.set(0, height * 0.72, radius * 0.9);
    front.material = accent;

    this.meshes = [capsule, helmet, front];
    for (const m of this.meshes) m.isPickable = false;
    this.shadowCasters = this.meshes;
  }

  setFlash(on: boolean): void {
    this.bodyMaterial.emissiveColor.copyFrom(on ? HIT_FLASH : Color3.Black());
  }

  /** Inclinação para trás (atordoado) ou queda (morte), em radianos. */
  setTilt(angle: number): void {
    this.body.rotation.x = -angle;
  }

  setVisibility(v: number): void {
    for (const m of this.meshes) m.visibility = v;
  }

  dispose(): void {
    this.root.dispose(false, true);
    for (const m of this.materials) m.dispose();
  }
}
