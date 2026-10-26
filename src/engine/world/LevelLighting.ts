import {
  Color3,
  DirectionalLight,
  HemisphericLight,
  ShadowGenerator,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import type { ProceduralLevelData } from "../../shared/types";

const SHADOW_MAP_SIZE = 2048;
const SUN_DISTANCE = 60;

export interface LevelLighting {
  sun: DirectionalLight;
  ambient: HemisphericLight;
  /** Personagens e objetos se registram aqui para projetar sombra. */
  shadows: ShadowGenerator;
}

/** Luz direcional (sol) com sombras + luz ambiente hemisférica. */
export function createLevelLighting(scene: Scene, data: ProceduralLevelData["lighting"]): LevelLighting {
  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = data.ambientIntensity;
  ambient.groundColor = new Color3(0.35, 0.3, 0.25);
  ambient.specular = Color3.Black();

  const dir = new Vector3(data.sunDirection.x, data.sunDirection.y, data.sunDirection.z).normalize();
  const sun = new DirectionalLight("sun", dir, scene);
  sun.intensity = data.sunIntensity;
  sun.diffuse = new Color3(1, 0.95, 0.85); // sol levemente quente
  // A posição só importa para o frustum da sombra.
  sun.position = dir.scale(-SUN_DISTANCE);
  sun.autoCalcShadowZBounds = true;

  const shadows = new ShadowGenerator(SHADOW_MAP_SIZE, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias = 0.0005;
  shadows.normalBias = 0.02;

  return { sun, ambient, shadows };
}
