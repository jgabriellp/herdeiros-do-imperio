import { Vector3 } from "@babylonjs/core";
import type { ArrowShot, ArrowSystem } from "./ArrowSystem";
import type { BowConfig } from "./CombatConfig";
import type { CombatTarget } from "./CombatTypes";

/** Sem mira nem trava: a flecha procura um ponto à frente nesta distância. */
const FORWARD_AIM_DISTANCE = 30;

export interface ArrowAimInput {
  /** Tensão da corda 0..1. */
  charge: number;
  /** Mirando pela câmera (retícula); senão tiro rápido. */
  aimed: boolean;
  bow: BowConfig;
  /** Multiplicador do arco equipado (dano e velocidade). */
  power: number;
  feet: Readonly<Vector3>;
  facingYaw: number;
  cameraPosition: Readonly<Vector3>;
  cameraDirection: Readonly<Vector3>;
  lockTarget: CombatTarget | null;
  arrows: ArrowSystem;
}

/**
 * Calcula o disparo: a flecha sai na altura do peito, à frente do jogador, e vai para
 * - o ponto sob a retícula (mirando), ou
 * - o peito do alvo travado (tiro rápido travado), ou
 * - um ponto à frente (tiro rápido livre).
 * A mira é erguida para compensar a queda pela gravidade: a flecha cai no ponto visado.
 */
export function computeArrowShot(input: ArrowAimInput): ArrowShot {
  const { bow, charge, power, feet, facingYaw } = input;
  const speed = (bow.minSpeed + (bow.maxSpeed - bow.minSpeed) * charge) * power;
  const damage = (bow.minDamage + (bow.maxDamage - bow.minDamage) * charge) * power;

  const fx = Math.sin(facingYaw);
  const fz = Math.cos(facingYaw);
  const origin = new Vector3(feet.x + fx * bow.spawnForward, feet.y + bow.spawnHeight, feet.z + fz * bow.spawnForward);

  let aimPoint: Vector3;
  if (input.aimed) {
    aimPoint = input.arrows.raycastAim(input.cameraPosition.clone(), input.cameraDirection.clone(), bow.aimRange, "player");
  } else if (input.lockTarget) {
    const t = input.lockTarget;
    aimPoint = new Vector3(t.feetPosition.x, t.feetPosition.y + t.lockOnHeight, t.feetPosition.z);
  } else {
    aimPoint = origin.add(new Vector3(fx, 0, fz).scale(FORWARD_AIM_DISTANCE));
  }

  // Compensação da queda: sobe o ponto visado o quanto a flecha vai cair até lá.
  const flightTime = Vector3.Distance(origin, aimPoint) / speed;
  aimPoint.y += 0.5 * bow.gravity * flightTime * flightTime;

  const velocity = aimPoint.subtract(origin).normalize().scale(speed);
  return { origin, velocity, damage, faction: "player" };
}
