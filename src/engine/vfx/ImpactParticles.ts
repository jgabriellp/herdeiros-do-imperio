import { Color4, DynamicTexture, ParticleSystem, Vector3, type Scene } from "@babylonjs/core";

const POOL_SIZE = 4;
const SPARKS_PER_HIT = 18;
const SPARKS_PER_HEAVY_HIT = 32;
const DUST_PER_HIT = 14;

/**
 * Partículas de impacto: faíscas no ponto do golpe e poeira nos pés do alvo (golpes fortes).
 * Sistemas reaproveitados em rodízio (pool), sem criar nada por golpe.
 */
export class ImpactParticles {
  private readonly texture: DynamicTexture;
  private readonly sparks: ParticleSystem[] = [];
  private readonly dust: ParticleSystem[] = [];
  private nextSpark = 0;
  private nextDust = 0;

  constructor(scene: Scene) {
    this.texture = createSoftDotTexture(scene);
    for (let i = 0; i < POOL_SIZE; i++) {
      this.sparks.push(this.createSparks(scene, i));
      this.dust.push(this.createDust(scene, i));
    }
  }

  sparksAt(point: Readonly<Vector3>, heavy: boolean): void {
    const ps = this.sparks[this.nextSpark]!;
    this.nextSpark = (this.nextSpark + 1) % POOL_SIZE;
    (ps.emitter as Vector3).copyFrom(point);
    ps.manualEmitCount = heavy ? SPARKS_PER_HEAVY_HIT : SPARKS_PER_HIT;
  }

  dustAt(feet: Readonly<Vector3>): void {
    const ps = this.dust[this.nextDust]!;
    this.nextDust = (this.nextDust + 1) % POOL_SIZE;
    (ps.emitter as Vector3).set(feet.x, feet.y + 0.1, feet.z);
    ps.manualEmitCount = DUST_PER_HIT;
  }

  dispose(): void {
    for (const ps of [...this.sparks, ...this.dust]) ps.dispose(false);
    this.texture.dispose();
  }

  private createSparks(scene: Scene, i: number): ParticleSystem {
    const ps = new ParticleSystem(`impactSparks_${i}`, 64, scene);
    ps.particleTexture = this.texture;
    ps.emitter = Vector3.Zero();
    ps.createSphereEmitter(0.12);
    ps.minEmitPower = 3;
    ps.maxEmitPower = 7;
    ps.minLifeTime = 0.12;
    ps.maxLifeTime = 0.32;
    ps.minSize = 0.07;
    ps.maxSize = 0.18;
    ps.color1 = new Color4(1, 0.95, 0.65, 1);
    ps.color2 = new Color4(1, 0.65, 0.2, 1);
    ps.colorDead = new Color4(0.6, 0.2, 0, 0);
    ps.gravity = new Vector3(0, -9, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.emitRate = 0;
    ps.manualEmitCount = 0;
    ps.start();
    return ps;
  }

  private createDust(scene: Scene, i: number): ParticleSystem {
    const ps = new ParticleSystem(`impactDust_${i}`, 32, scene);
    ps.particleTexture = this.texture;
    ps.emitter = Vector3.Zero();
    ps.createHemisphericEmitter(0.35, 0);
    ps.minEmitPower = 0.6;
    ps.maxEmitPower = 1.6;
    ps.minLifeTime = 0.45;
    ps.maxLifeTime = 0.9;
    ps.minSize = 0.25;
    ps.maxSize = 0.6;
    ps.color1 = new Color4(0.62, 0.55, 0.45, 0.55);
    ps.color2 = new Color4(0.5, 0.45, 0.38, 0.45);
    ps.colorDead = new Color4(0.5, 0.45, 0.38, 0);
    ps.gravity = new Vector3(0, -0.6, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.emitRate = 0;
    ps.manualEmitCount = 0;
    ps.start();
    return ps;
  }
}

/** Ponto branco com borda suave, gerado em código (sem arquivo de textura). */
function createSoftDotTexture(scene: Scene): DynamicTexture {
  const size = 32;
  const tex = new DynamicTexture("impactDot", { width: size, height: size }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.8)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.hasAlpha = true;
  tex.update();
  return tex;
}
