import type { CombatConfig } from "../combat/CombatConfig";
import type { HitEvent } from "../combat/DamageSystem";
import type { CameraShake } from "./CameraShake";
import type { HitStop } from "./HitStop";
import type { ImpactParticles } from "./ImpactParticles";

/**
 * Reação a cada acerto: hit stop, faíscas (sempre), poeira e tremida (golpes fortes),
 * tremida leve quando o jogador é atingido. Se inscreve em DamageSystem.onHit.
 */
export function createImpactFeedback(
  combat: CombatConfig,
  hitStop: HitStop,
  particles: ImpactParticles,
  shake: CameraShake,
): (event: HitEvent) => void {
  return (event) => {
    const { hit } = event;
    hitStop.trigger(hit.heavy ? combat.hitStop.heavy : combat.hitStop.light);
    particles.sparksAt(event.point, hit.heavy);

    if (hit.heavy) {
      particles.dustAt(event.target.feetPosition);
      shake.trigger(combat.heavyHitShake.amplitude, combat.heavyHitShake.duration);
    }
    if (event.target.faction === "player") {
      shake.trigger(combat.playerHurtShake.amplitude, combat.playerHurtShake.duration);
    }
  };
}
