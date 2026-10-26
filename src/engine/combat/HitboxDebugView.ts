import { Color3, MeshBuilder, StandardMaterial, type Mesh, type Scene } from "@babylonjs/core";
import type { Hitbox } from "./Hitbox";

/** Modo dev: desenha a esfera da hitbox enquanto ela está ativa. */
export class HitboxDebugView {
  private readonly mesh: Mesh;
  private readonly material: StandardMaterial;
  enabled = false;

  constructor(
    scene: Scene,
    private readonly hitbox: Hitbox,
  ) {
    this.mesh = MeshBuilder.CreateSphere("dbg_hitbox", { diameter: 1, segments: 10 }, scene);
    this.material = new StandardMaterial("dbg_hitboxMat", scene);
    this.material.emissiveColor = new Color3(1, 0.2, 0.2);
    this.material.disableLighting = true;
    this.material.alpha = 0.35;
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    this.mesh.setEnabled(false);
  }

  update(): void {
    const show = this.enabled && this.hitbox.isActive;
    this.mesh.setEnabled(show);
    if (!show) return;
    this.mesh.position.copyFrom(this.hitbox.center);
    this.mesh.scaling.setAll(this.hitbox.radius * 2);
  }

  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
  }
}
