import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import type { BowItem, ItemDef, ShieldItem, SwordItem } from "./ItemConfig";

/** Malha provisória de um item (até chegarem os modelos .glb). */
export interface ItemMesh {
  readonly root: TransformNode;
  readonly meshes: readonly Mesh[];
  dispose(): void;
}

/**
 * Espada: empunhadura na origem, lâmina ao longo de +Y.
 * Escudo: disco centrado na origem, face voltada para +Z.
 * Arco: empunhadura na origem, braços ao longo de ±Y, curvado para +Z; corda em z negativo.
 */
export function createItemMesh(scene: Scene, item: ItemDef, name: string): ItemMesh {
  switch (item.kind) {
    case "sword":
      return createSword(scene, item, name);
    case "shield":
      return createShield(scene, item, name);
    case "bow":
      return createBow(scene, item, name);
  }
}

/** Flecha: ponta em +Z, comprimento ~0,75 m, origem no meio. */
export function createArrowMesh(scene: Scene, name: string): ItemMesh {
  const root = new TransformNode(name, scene);
  const wood = material(scene, `${name}_shaft`, Color3.FromHexString("#b08a5a"), 0.05);
  const tip = material(scene, `${name}_tip`, Color3.FromHexString("#9aa0a6"), 0.5);
  const feather = material(scene, `${name}_feather`, Color3.FromHexString("#e8e2d0"), 0.05);

  const shaft = MeshBuilder.CreateCylinder(`${name}_shaft`, { diameter: 0.022, height: 0.7, tessellation: 6 }, scene);
  shaft.rotation.x = Math.PI / 2;
  shaft.material = wood;
  const head = MeshBuilder.CreateCylinder(`${name}_head`, { diameterTop: 0, diameterBottom: 0.05, height: 0.08, tessellation: 6 }, scene);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.39;
  head.material = tip;
  const fletch = MeshBuilder.CreateBox(`${name}_fletch`, { width: 0.07, height: 0.005, depth: 0.12 }, scene);
  fletch.position.z = -0.29;
  fletch.material = feather;

  const meshes = [shaft, head, fletch];
  for (const m of meshes) {
    m.parent = root;
    m.isPickable = false;
  }
  return wrap(root, meshes, [wood, tip, feather]);
}

function createBow(scene: Scene, item: BowItem, name: string): ItemMesh {
  const root = new TransformNode(name, scene);
  const wood = material(scene, `${name}_wood`, Color3.FromHexString(item.color), 0.1);
  const cord = material(scene, `${name}_string`, Color3.FromHexString("#e9e4d4"), 0.05);

  // Arco de circunferência suave: pontas para trás (-Z), meio para a frente (+Z).
  const half = item.height / 2;
  const path: Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = -1 + (2 * i) / 16;
    path.push(new Vector3(0, t * half, 0.14 * (1 - t * t)));
  }
  const limbs = MeshBuilder.CreateTube(`${name}_limbs`, { path, radius: 0.018, tessellation: 6 }, scene);
  limbs.material = wood;
  const string = MeshBuilder.CreateCylinder(`${name}_string`, { diameter: 0.006, height: item.height, tessellation: 4 }, scene);
  string.material = cord;

  const meshes = [limbs, string];
  for (const m of meshes) {
    m.parent = root;
    m.isPickable = false;
  }
  return wrap(root, meshes, [wood, cord]);
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
