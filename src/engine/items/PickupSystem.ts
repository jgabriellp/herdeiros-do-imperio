import { Color3, MeshBuilder, StandardMaterial, TransformNode, type Mesh, type Scene } from "@babylonjs/core";
import type { PickupDef, Vec3Data } from "../../shared/types";
import { GameError } from "../core/GameError";
import type { SaveManager } from "../save/SaveManager";
import { ITEMS } from "./ItemConfig";
import { createItemMesh, type ItemMesh } from "./ItemMeshes";

/** Distância horizontal para pegar um item (folga para itens sobre pedestais sólidos). */
const PICKUP_RADIUS = 1.4;
const PICKUP_HEIGHT_TOLERANCE = 1.6;
const FLOAT_HEIGHT = 0.55;
const SPIN_SPEED = 1.5;
const BOB_SPEED = 2.2;
const BOB_AMPLITUDE = 0.08;
const GLOW = Color3.FromHexString("#ffd95a");

interface ActivePickup {
  def: PickupDef;
  key: string;
  root: TransformNode;
  item: ItemMesh;
  ring: Mesh;
}

/**
 * Itens colocados no mapa (level.json → pickups). Flutuam girando sobre um anel brilhante;
 * passar perto pega. Itens já pegos (registrados no save) não reaparecem.
 */
export class PickupSystem {
  private readonly active: ActivePickup[] = [];
  private readonly ringMaterial: StandardMaterial;
  private time = 0;

  constructor(
    scene: Scene,
    episodeId: string,
    pickups: readonly PickupDef[],
    private readonly save: SaveManager,
    private readonly onCollect: (itemId: string) => void,
  ) {
    validateItems(pickups);
    this.ringMaterial = new StandardMaterial("pickupRingMat", scene);
    this.ringMaterial.emissiveColor = GLOW;
    this.ringMaterial.disableLighting = true;
    this.ringMaterial.alpha = 0.7;

    for (const def of pickups) {
      const key = `${episodeId}/${def.id}`;
      if (save.hasCollectedPickup(key)) continue;
      this.active.push(this.createPickup(scene, def, key));
    }
  }

  update(dt: number, playerFeet: Readonly<Vec3Data>): void {
    this.time += dt;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!;
      const base = p.def.position;
      p.item.root.rotation.y = this.time * SPIN_SPEED;
      p.item.root.position.y = FLOAT_HEIGHT + Math.sin(this.time * BOB_SPEED + i) * BOB_AMPLITUDE;

      const dx = base.x - playerFeet.x;
      const dz = base.z - playerFeet.z;
      if (dx * dx + dz * dz > PICKUP_RADIUS * PICKUP_RADIUS) continue;
      if (Math.abs(base.y - playerFeet.y) > PICKUP_HEIGHT_TOLERANCE) continue;

      this.save.markPickupCollected(p.key);
      this.onCollect(p.def.item);
      this.disposePickup(p);
      this.active.splice(i, 1);
    }
  }

  dispose(): void {
    for (const p of this.active) this.disposePickup(p);
    this.active.length = 0;
    this.ringMaterial.dispose();
  }

  private createPickup(scene: Scene, def: PickupDef, key: string): ActivePickup {
    const root = new TransformNode(`pickup_${def.id}`, scene);
    root.position.set(def.position.x, def.position.y, def.position.z);

    const item = createItemMesh(scene, ITEMS[def.item]!, `pickup_${def.id}_item`);
    // Espada fica em pé (lâmina para cima); escudo de frente. A altura é animada em update().
    item.root.parent = root;

    const ring = MeshBuilder.CreateTorus(`pickup_${def.id}_ring`, { diameter: 0.8, thickness: 0.05, tessellation: 24 }, scene);
    ring.parent = root;
    ring.position.y = 0.03;
    ring.material = this.ringMaterial;
    ring.isPickable = false;

    return { def, key, root, item, ring };
  }

  private disposePickup(p: ActivePickup): void {
    p.item.dispose();
    p.ring.dispose();
    p.root.dispose();
  }
}

function validateItems(pickups: readonly PickupDef[]): void {
  const known = Object.keys(ITEMS);
  const problems = pickups
    .filter((p) => !(p.item in ITEMS))
    .map((p) => `level.json: pickup "${p.id}" tem item desconhecido "${p.item}" (itens conhecidos: ${known.join(", ")})`);
  if (problems.length > 0) throw new GameError("INVALID_EPISODE", problems.join("\n"));
}
