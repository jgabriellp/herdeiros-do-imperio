import { Color3, MeshBuilder, StandardMaterial, type Mesh, type Scene } from "@babylonjs/core";
import type { CombatTarget } from "../combat/CombatTypes";

const COLOR = Color3.FromHexString("#ffcf3f");
/** Altura do marcador acima da cabeça do alvo. */
const HEAD_CLEARANCE = 0.45;
const BOB_AMPLITUDE = 0.08;
const BOB_SPEED = 4;
const SPIN_SPEED = 2.5;

/** Marcador 3D (losango apontando para baixo) sobre o alvo travado. */
export class TargetMarker {
  private readonly mesh: Mesh;
  private readonly material: StandardMaterial;
  private time = 0;

  constructor(scene: Scene) {
    // Cone de 4 lados = pirâmide; invertida aponta para o alvo.
    this.mesh = MeshBuilder.CreateCylinder("lockMarker", { diameterTop: 0.32, diameterBottom: 0, height: 0.36, tessellation: 4 }, scene);
    this.material = new StandardMaterial("lockMarkerMat", scene);
    this.material.diffuseColor = COLOR;
    this.material.emissiveColor = COLOR.scale(0.8);
    this.material.disableLighting = true;
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    // Desenha por cima do cenário para nunca ficar escondido atrás de um pilar.
    this.mesh.renderingGroupId = 1;
    this.mesh.setEnabled(false);
  }

  update(dt: number, target: CombatTarget | null): void {
    if (!target) {
      this.mesh.setEnabled(false);
      return;
    }
    this.time += dt;
    const feet = target.feetPosition;
    this.mesh.setEnabled(true);
    this.mesh.position.set(
      feet.x,
      feet.y + target.hurtHeight + HEAD_CLEARANCE + Math.sin(this.time * BOB_SPEED) * BOB_AMPLITUDE,
      feet.z,
    );
    this.mesh.rotation.y = this.time * SPIN_SPEED;
  }

  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
  }
}
