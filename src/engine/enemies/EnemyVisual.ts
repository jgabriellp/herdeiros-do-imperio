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
import type { EnemyVisualAction } from "./states/EnemyState";

const HIT_FLASH = new Color3(1, 0.1, 0.05);
/** Cor do aviso de ataque no corpo: laranja forte, diferente do vermelho do "levou golpe". */
const WARNING = new Color3(1, 0.5, 0.0);
/** Brilho da arma no aviso: amarelo quase branco, contrasta com qualquer cenário. */
const WEAPON_GLINT = new Color3(1, 0.9, 0.35);
const WARNING_PULSES = 3;

/** Rotação do braço da clava (radianos em X): repouso, erguida (aviso), golpe. */
const ARM_REST = 0.35;
const ARM_RAISED = -2.4;
const ARM_STRIKE = 1.4;
const HIT_TILT = 0.3;

/**
 * Visual provisório de inimigo: cápsula com elmo, faixa indicando a frente e uma clava.
 * Animação procedural: a clava sobe e o corpo pulsa em laranja durante a preparação
 * (aviso para o jogador esquivar), desce na janela ativa e volta na recuperação.
 */
export class EnemyVisual {
  readonly root: TransformNode;
  /** Ponto acima da cabeça, para a barra de vida flutuante. */
  readonly headAnchor: TransformNode;
  readonly shadowCasters: readonly AbstractMesh[];
  private readonly body: TransformNode;
  private readonly arm: TransformNode;
  private readonly meshes: Mesh[];
  private readonly bodyMaterial: StandardMaterial;
  private readonly clubMaterial: StandardMaterial;
  private readonly materials: StandardMaterial[];

  constructor(scene: Scene, name: string, private readonly type: EnemyTypeConfig) {
    const { height, radius } = type.shape;
    this.root = new TransformNode(`${name}_visual`, scene);
    this.body = new TransformNode(`${name}_body`, scene);
    this.body.parent = this.root;
    this.headAnchor = new TransformNode(`${name}_head`, scene);
    this.headAnchor.parent = this.root;
    this.headAnchor.position.y = height + 0.35;

    this.bodyMaterial = new StandardMaterial(`${name}_bodyMat`, scene);
    this.bodyMaterial.diffuseColor = Color3.FromHexString(type.bodyColor);
    this.bodyMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    const accent = new StandardMaterial(`${name}_accentMat`, scene);
    accent.diffuseColor = Color3.FromHexString(type.accentColor);
    accent.specularColor = new Color3(0.3, 0.3, 0.3);
    const wood = new StandardMaterial(`${name}_clubMat`, scene);
    wood.diffuseColor = Color3.FromHexString("#6b4a2b");
    wood.specularColor = new Color3(0.05, 0.05, 0.05);
    this.clubMaterial = wood;
    this.materials = [this.bodyMaterial, accent, wood];

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

    // Braço = pivô no ombro direito; a clava pende para baixo dele.
    this.arm = new TransformNode(`${name}_arm`, scene);
    this.arm.parent = this.body;
    this.arm.position.set(radius + 0.08, height * 0.75, 0);
    const club = MeshBuilder.CreateCylinder(`${name}_club`, { diameterTop: 0.16, diameterBottom: 0.08, height: 0.85, tessellation: 8 }, scene);
    club.parent = this.arm;
    club.position.y = -0.42;
    club.material = wood;

    this.meshes = [capsule, helmet, front, club];
    for (const m of this.meshes) m.isPickable = false;
    this.shadowCasters = this.meshes;
  }

  update(action: EnemyVisualAction | null, flashing: boolean): void {
    let armAngle = ARM_REST;
    let tilt = 0;
    let warning = 0;
    let visibility = 1;

    if (action?.kind === "attack") {
      const p = action.phaseProgress;
      if (action.phase === "windup") {
        armAngle = ARM_REST + (ARM_RAISED - ARM_REST) * easeOut(p);
        tilt = 0.15 * p; // inclina para trás tomando impulso
        // Pulsa cada vez mais forte até o golpe sair; no fim fica aceso (o golpe vai sair).
        const pulse = 0.5 + 0.5 * Math.cos(p * Math.PI * 2 * WARNING_PULSES);
        warning = p > 0.8 ? 1 : (0.6 + 0.4 * p) * (0.35 + 0.65 * pulse);
      } else if (action.phase === "active") {
        armAngle = ARM_RAISED + (ARM_STRIKE - ARM_RAISED) * easeOut(p);
        tilt = -0.2;
      } else {
        armAngle = ARM_STRIKE + (ARM_REST - ARM_STRIKE) * p;
        tilt = -0.2 * (1 - p);
      }
    } else if (action?.kind === "hitStun") {
      tilt = HIT_TILT * Math.max(0, 1 - action.progress);
    } else if (action?.kind === "dead") {
      const { deathFallDuration, corpseLingerTime } = this.type;
      const fall = Math.min(1, action.elapsed / deathFallDuration);
      tilt = (Math.PI / 2) * fall * fall;
      // Some só nos últimos segundos (o corpo fica no chão para ser encontrado).
      const fadeTime = Math.min(2, corpseLingerTime * 0.5);
      const fadeStart = deathFallDuration + corpseLingerTime - fadeTime;
      visibility = 1 - Math.min(1, Math.max(0, (action.elapsed - fadeStart) / fadeTime));
    }

    this.arm.rotation.x = armAngle;
    this.body.rotation.x = -tilt;
    if (flashing) this.bodyMaterial.emissiveColor.copyFrom(HIT_FLASH);
    else WARNING.scaleToRef(warning * 0.85, this.bodyMaterial.emissiveColor);
    WEAPON_GLINT.scaleToRef(warning, this.clubMaterial.emissiveColor);
    for (const m of this.meshes) m.visibility = visibility;
  }

  dispose(): void {
    this.root.dispose(false, true);
    for (const m of this.materials) m.dispose();
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
