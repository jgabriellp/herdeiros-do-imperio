/**
 * Fator de suavização exponencial independente de FPS.
 * Uso: valor += (alvo - valor) * damp(nitidez, dt). Nitidez maior = chega mais rápido.
 */
export function damp(sharpness: number, dt: number): number {
  return 1 - Math.exp(-sharpness * dt);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Diferença angular pelo caminho mais curto, em (-PI, PI]. */
export function shortestAngle(from: number, to: number): number {
  const twoPi = Math.PI * 2;
  let d = (to - from) % twoPi;
  if (d > Math.PI) d -= twoPi;
  if (d <= -Math.PI) d += twoPi;
  return d;
}

/** Ângulo Y (yaw) de uma direção no plano XZ. Yaw 0 = olhando para +Z. */
export function yawFromDirection(x: number, z: number): number {
  return Math.atan2(x, z);
}
