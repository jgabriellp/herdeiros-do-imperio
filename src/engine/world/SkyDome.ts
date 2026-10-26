import { Color3, Color4, Mesh, MeshBuilder, StandardMaterial, VertexBuffer, type Scene } from "@babylonjs/core";

const SKY_DIAMETER = 1000;

/**
 * Céu simples: esfera vista por dentro com degradê (horizonte → topo)
 * pintado nas cores dos vértices. Sem textura nem shader próprio.
 */
export function createSkyDome(scene: Scene, topColor: Color3, horizonColor: Color3): Mesh {
  const sky = MeshBuilder.CreateSphere(
    "sky",
    { diameter: SKY_DIAMETER, segments: 24, sideOrientation: Mesh.BACKSIDE },
    scene,
  );
  sky.infiniteDistance = true; // acompanha a câmera, nunca se chega perto
  sky.isPickable = false;
  sky.applyFog = false;

  const positions = sky.getVerticesData(VertexBuffer.PositionKind) ?? [];
  const colors = new Float32Array((positions.length / 3) * 4);
  const radius = SKY_DIAMETER / 2;
  const tmp = new Color3();
  for (let i = 0, v = 0; i < positions.length; i += 3, v += 4) {
    const height = Math.max(0, (positions[i + 1] ?? 0) / radius);
    // Curva para o degradê ficar concentrado perto do horizonte.
    Color3.LerpToRef(horizonColor, topColor, Math.pow(height, 0.6), tmp);
    colors[v] = tmp.r;
    colors[v + 1] = tmp.g;
    colors[v + 2] = tmp.b;
    colors[v + 3] = 1;
  }
  sky.setVerticesData(VertexBuffer.ColorKind, colors);

  // Emissivo branco × cor do vértice = cor final, sem influência das luzes.
  const mat = new StandardMaterial("skyMat", scene);
  mat.disableLighting = true;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.emissiveColor = Color3.White();
  sky.material = mat;

  scene.clearColor = Color4.FromColor3(horizonColor, 1);
  return sky;
}
