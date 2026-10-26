import { ArcRotateCamera, Vector3, type Scene } from "@babylonjs/core";
import type { Vec3Data } from "../../shared/types";

/**
 * Câmera orbital provisória para observar a cena.
 * Será substituída pela ThirdPersonCamera na Tarefa 2.
 */
export function createDevOrbitCamera(scene: Scene, canvas: HTMLCanvasElement, target: Vec3Data): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    "devOrbitCamera",
    -Math.PI / 2,
    1.1,
    28,
    new Vector3(target.x, target.y, target.z),
    scene,
  );
  camera.lowerRadiusLimit = 4;
  camera.upperRadiusLimit = 90;
  camera.upperBetaLimit = Math.PI / 2.05; // não passa para baixo do chão
  camera.wheelDeltaPercentage = 0.02;
  camera.minZ = 0.1;
  camera.attachControl(canvas, true);
  return camera;
}
