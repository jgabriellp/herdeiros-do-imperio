import { Color3, MeshBuilder, StandardMaterial, type Scene } from "@babylonjs/core";
import type { EpisodeManifest } from "../../shared/types";

/** Modo dev: marca spawn (verde) e checkpoints (azul) para conferir o manifesto. */
export function createDebugMarkers(scene: Scene, manifest: EpisodeManifest): void {
  const spawnMat = translucent(scene, "dbg_spawn", new Color3(0.2, 0.9, 0.3));
  const cpMat = translucent(scene, "dbg_checkpoint", new Color3(0.3, 0.6, 1));

  const spawn = MeshBuilder.CreateTorus("dbg_spawn", { diameter: 1.4, thickness: 0.08 }, scene);
  spawn.position.set(manifest.spawnPoint.x, manifest.spawnPoint.y + 0.05, manifest.spawnPoint.z);
  spawn.material = spawnMat;
  spawn.isPickable = false;

  for (const cp of manifest.checkpoints) {
    const m = MeshBuilder.CreateCylinder(`dbg_cp_${cp.id}`, { diameter: 1.1, height: 0.04 }, scene);
    m.position.set(cp.position.x, cp.position.y + 0.02, cp.position.z);
    m.material = cpMat;
    m.isPickable = false;
  }
}

function translucent(scene: Scene, name: string, color: Color3): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = color;
  mat.emissiveColor = color.scale(0.6);
  mat.alpha = 0.45;
  return mat;
}
