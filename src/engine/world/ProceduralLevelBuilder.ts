import {
  Color3,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  StandardMaterial,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import type { ObstacleDef, ProceduralLevelData } from "../../shared/types";
import { createLevelLighting, type LevelLighting } from "./LevelLighting";
import { createSkyDome } from "./SkyDome";

const DEFAULT_OBSTACLE_COLOR = "#8a7f72";

export interface BuiltLevel {
  lighting: LevelLighting;
}

/**
 * Monta uma fase "procedural" genérica a partir dos dados do level.json.
 * Não conhece nenhum episódio: tudo que muda entre fases vem dos dados.
 * Meshes, materiais e corpos físicos são liberados com scene.dispose().
 */
export class ProceduralLevelBuilder {
  private readonly materials = new Map<string, StandardMaterial>();

  constructor(private readonly scene: Scene) {}

  build(data: ProceduralLevelData): BuiltLevel {
    createSkyDome(this.scene, Color3.FromHexString(data.sky.topColor), Color3.FromHexString(data.sky.horizonColor));
    const lighting = createLevelLighting(this.scene, data.lighting);

    this.buildGround(data.ground);
    data.obstacles.forEach((def, i) => {
      const mesh = this.buildObstacle(def, i);
      lighting.shadows.addShadowCaster(mesh);
    });

    return { lighting };
  }

  private buildGround(ground: ProceduralLevelData["ground"]): void {
    const mesh = MeshBuilder.CreateGround("ground", { width: ground.width, height: ground.depth }, this.scene);
    mesh.material = this.material(ground.color);
    mesh.receiveShadows = true;
    new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, this.scene);
  }

  private buildObstacle(def: ObstacleDef, index: number): Mesh {
    const name = `obstacle_${index}_${def.shape}`;
    let mesh: Mesh;
    let shape: PhysicsShapeType;

    if (def.shape === "box") {
      mesh = MeshBuilder.CreateBox(name, { width: def.size.x, height: def.size.y, depth: def.size.z }, this.scene);
      mesh.rotation.y = def.rotationY ?? 0;
      shape = PhysicsShapeType.BOX;
    } else {
      mesh = MeshBuilder.CreateCylinder(name, { diameter: def.diameter, height: def.height, tessellation: 20 }, this.scene);
      shape = PhysicsShapeType.CYLINDER;
    }

    mesh.position.set(def.position.x, def.position.y, def.position.z);
    mesh.material = this.material(def.color ?? DEFAULT_OBSTACLE_COLOR);
    mesh.receiveShadows = true;

    // mass 0 = estático (parede, pilar); > 0 = dinâmico (caixa que cai e pode ser empurrada).
    new PhysicsAggregate(mesh, shape, { mass: def.mass ?? 0, friction: 0.6, restitution: 0.1 }, this.scene);
    return mesh;
  }

  /** Um material por cor, compartilhado entre meshes. */
  private material(hex: string): StandardMaterial {
    let mat = this.materials.get(hex);
    if (!mat) {
      mat = new StandardMaterial(`mat_${hex}`, this.scene);
      mat.diffuseColor = Color3.FromHexString(hex);
      mat.specularColor = new Color3(0.08, 0.08, 0.08);
      this.materials.set(hex, mat);
    }
    return mat;
  }
}
