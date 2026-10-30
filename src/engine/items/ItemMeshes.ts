import { Color3, MeshBuilder, StandardMaterial, TransformNode, type Mesh, type Scene } from "@babylonjs/core";
import type { ItemDef, ShieldItem, SwordItem } from "./ItemConfig";

/** Malha provisória de um item (até chegarem os modelos .glb). */
export interface ItemMesh {
  readonly root: TransformNode;
  readonly meshes: readonly Mesh[];
  dispose(): void;
}

/**
 * Espada: empunhadura na origem, lâmina ao longo de +Y.
 * Escudo: disco centrado na origem, face voltada para +Z.
 */
export function createItemMesh(scene: Scene, item: ItemDef, name: string): ItemMesh {
  return item.kind === "sword" ? createSword(scene, item, name) : createShield(scene, item, name);
}

function createSword(scene: Scene, item: SwordItem, name: string): ItemMesh {
  const root = new TransformNode(name, scene);
  const steel = material(scene, `${name}_steel`, Color3.FromHexString(item.bladeColor), 0.6);
  const leather = material(scene, `${name}_grip`, Color3.FromHexString("#4a3020"), 0.05);

  const grip = MeshBuilder.CreateCylinder(`${name}_grip`, { diameter: 0.05, height: 0.2, tessellation: 8 }, scene);
  grip.material = leather;
  const guard = MeshBuilder.CreateBox(`${name}_guard`, { width: 0.24, height: 0.04, depth: 0.05 }, scene);
  guard.position.y = 0.11;
  guard.material = steel;
  const blade = MeshBuilder.CreateBox(`${name}_blade`, { width: 0.07, height: item.bladeLength, depth: 0.02 }, scene);
  blade.position.y = 0.13 + item.bladeLength / 2;
  blade.material = steel;

  const meshes = [grip, guard, blade];
  for (const m of meshes) {
    m.parent = root;
    m.isPickable = false;
  }
  return wrap(root, meshes, [steel, leather]);
}

function createShield(scene: Scene, item: ShieldItem, name: string): ItemMesh {
  const root = new TransformNode(name, scene);
  const wood = material(scene, `${name}_wood`, Color3.FromHexString(item.color), 0.05);
  const iron = material(scene, `${name}_iron`, Color3.FromHexString("#5d5d5d"), 0.4);

  const disc = MeshBuilder.CreateCylinder(`${name}_disc`, { diameter: item.diameter, height: 0.05, tessellation: 20 }, scene);
  disc.rotation.x = Math.PI / 2; // face para +Z
  disc.material = wood;
  const boss = MeshBuilder.CreateSphere(`${name}_boss`, { diameter: 0.14, segments: 8 }, scene);
  boss.position.z = 0.03;
  boss.scaling.z = 0.5;
  boss.material = iron;

  const meshes = [disc, boss];
  for (const m of meshes) {
    m.parent = root;
    m.isPickable = false;
  }
  return wrap(root, meshes, [wood, iron]);
}

function material(scene: Scene, name: string, color: Color3, specular: number): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = color;
  mat.specularColor = new Color3(specular, specular, specular);
  return mat;
}

function wrap(root: TransformNode, meshes: Mesh[], materials: StandardMaterial[]): ItemMesh {
  return {
    root,
    meshes,
    dispose() {
      root.dispose(false, true);
      for (const m of materials) m.dispose();
    },
  };
}
