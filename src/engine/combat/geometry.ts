import type { Vector3 } from "@babylonjs/core";
import type { CombatTarget } from "./CombatTypes";

/**
 * Onde o segmento p0→p1 (ex.: o trecho voado por uma flecha num quadro) entra
 * na cápsula vertical do alvo, como fração 0..1 do segmento; null se não toca.
 * Aproximação: menor distância entre o segmento e o eixo da cápsula, com o raio somado.
 */
export function segmentHitsTarget(p0: Readonly<Vector3>, p1: Readonly<Vector3>, target: CombatTarget, extraRadius: number): number | null {
  const feet = target.feetPosition;
  const r = target.hurtRadius + extraRadius;
  // Eixo da cápsula: de feet+raio até feet+altura-raio.
  const ax = feet.x, az = feet.z;
  const ay0 = feet.y + target.hurtRadius;
  const ay1 = feet.y + Math.max(target.hurtRadius, target.hurtHeight - target.hurtRadius);

  // Menor distância entre o segmento P(s) = p0 + s·d e o eixo Q(t) = (ax, ay0 + t·h, az).
  const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
  const h = ay1 - ay0;
  const wx = p0.x - ax, wy = p0.y - ay0, wz = p0.z - az;
  const a = dx * dx + dy * dy + dz * dz;
  const b = dy * h; // d·e com e = (0, h, 0)
  const c = h * h;
  const d = dx * wx + dy * wy + dz * wz;
  const e = wy * h;
  const denom = a * c - b * b;

  let s = denom > 1e-9 ? clamp01((b * e - c * d) / denom) : 0;
  let t = c > 1e-9 ? clamp01((b * s + e) / c) : 0;
  // Reprojeta s após prender t (resultado correto para segmentos).
  s = a > 1e-9 ? clamp01((b * t - d) / a) : 0;
  t = c > 1e-9 ? clamp01((b * s + e) / c) : 0;

  const px = p0.x + dx * s - ax;
  const py = p0.y + dy * s - (ay0 + h * t);
  const pz = p0.z + dz * s - az;
  return px * px + py * py + pz * pz <= r * r ? s : null;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
