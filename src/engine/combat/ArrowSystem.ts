import { PhysicsEngineV2, PhysicsRaycastResult, Vector3, type Scene, type TransformNode } from "@babylonjs/core";
import { CollisionLayers } from "../core/CollisionLayers";
import { createArrowMesh, type ItemMesh } from "../items/ItemMeshes";
import type { BowConfig } from "./CombatConfig";
import type { CombatTarget, Faction } from "./CombatTypes";
import type { DamageSystem } from "./DamageSystem";
import { segmentHitsTarget } from "./geometry";

/** Espessura da flecha para colisão com personagens. */
const ARROW_RADIUS = 0.04;
/** O que a flecha atravessa: cenário e objetos soltos (não personagens; esses são testados à parte). */
const WORLD_MASK = CollisionLayers.WORLD | CollisionLayers.PROP;

interface Arrow {
  node: TransformNode;
  position: Vector3;
  velocity: Vector3;
  damage: number;
  faction: Faction;
  /** Voando (false = cravada no cenário). */
  flying: boolean;
  timeLeft: number;
}

export interface ArrowShot {
  origin: Vector3;
  velocity: Vector3;
  damage: number;
  faction: Faction;
}

/**
 * Flechas como projéteis: gravidade, colisão com o cenário (raycast Havok) e com
 * personagens (segmento × cápsula). Acerto em personagem passa pelo DamageSystem
 * (mesmo hit stop, faíscas e regras de facção dos golpes corpo a corpo).
 * A flecha é um abate furtivo (`stealthKill`): mata na hora quem está desprevenido.
 */
export class ArrowSystem {
  private readonly arrows: Arrow[] = [];
  private readonly template: ItemMesh;
  private readonly hit = new PhysicsRaycastResult();
  private readonly next = new Vector3();
  private readonly tmp = new Vector3();
  private counter = 0;

  constructor(
    private readonly scene: Scene,
    private readonly damage: DamageSystem,
    private readonly config: BowConfig,
  ) {
    this.template = createArrowMesh(scene, "arrowTemplate");
    this.template.root.setEnabled(false);
  }

  get activeCount(): number {
    return this.arrows.length;
  }

  spawn(shot: ArrowShot): void {
    if (this.arrows.length >= this.config.maxArrows) this.remove(0);
    const node = this.template.root.instantiateHierarchy(null, undefined, (source, clone) => {
      clone.name = `${source.name}_${this.counter}`;
    });
    if (!node) return;
    this.counter++;
    node.setEnabled(true);
    const arrow: Arrow = {
      node,
      position: shot.origin.clone(),
      velocity: shot.velocity.clone(),
      damage: shot.damage,
      faction: shot.faction,
      flying: true,
      timeLeft: this.config.flightLifetime,
    };
    this.orient(arrow);
    this.arrows.push(arrow);
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i]!;
      arrow.timeLeft -= dt;
      if (arrow.timeLeft <= 0) {
        this.remove(i);
        continue;
      }
      if (arrow.flying && this.fly(arrow, dt)) this.remove(i);
    }
  }

  /**
   * Primeiro ponto atingido por um raio (cenário ou personagem de outra facção),
   * usado para saber para onde a retícula aponta.
   */
  raycastAim(origin: Vector3, direction: Vector3, range: number, shooter: Faction): Vector3 {
    const end = origin.add(direction.scale(range));
    let best = 1;
    const physics = this.scene.getPhysicsEngine();
    if (physics instanceof PhysicsEngineV2) {
      physics.raycastToRef(origin, end, this.hit, { collideWith: WORLD_MASK });
      if (this.hit.hasHit) best = Vector3.Distance(origin, this.hit.hitPointWorld) / range;
    }
    for (const t of this.targetsOf(shooter)) {
      const s = segmentHitsTarget(origin, end, t, 0);
      if (s !== null && s < best) best = s;
    }
    return Vector3.Lerp(origin, end, best);
  }

  dispose(): void {
    while (this.arrows.length > 0) this.remove(this.arrows.length - 1);
    this.template.dispose();
  }

  /** Avança um quadro. Retorna true se a flecha deve sumir (acertou alguém). */
  private fly(arrow: Arrow, dt: number): boolean {
    arrow.velocity.y -= this.config.gravity * dt;
    arrow.position.addToRef(arrow.velocity.scaleToRef(dt, this.tmp), this.next);

    // Primeiro obstáculo no trecho deste quadro: cenário ou personagem.
    let worldFraction = Infinity;
    const physics = this.scene.getPhysicsEngine();
    if (physics instanceof PhysicsEngineV2) {
      physics.raycastToRef(arrow.position, this.next, this.hit, { collideWith: WORLD_MASK });
      if (this.hit.hasHit) {
        const len = Vector3.Distance(arrow.position, this.next);
        worldFraction = len > 1e-6 ? Vector3.Distance(arrow.position, this.hit.hitPointWorld) / len : 0;
      }
    }
    let target: CombatTarget | null = null;
    let targetFraction = Infinity;
    for (const t of this.targetsOf(arrow.faction)) {
      const s = segmentHitsTarget(arrow.position, this.next, t, ARROW_RADIUS);
      if (s !== null && s < targetFraction) {
        targetFraction = s;
        target = t;
      }
    }

    if (target && targetFraction <= worldFraction) {
      Vector3.LerpToRef(arrow.position, this.next, targetFraction, this.tmp);
      this.hitTarget(arrow, target, this.tmp);
      return true;
    }
    if (worldFraction !== Infinity) {
      // Crava no ponto atingido, mantendo a inclinação do voo.
      arrow.position.copyFrom(this.hit.hitPointWorld);
      this.orient(arrow);
      arrow.flying = false;
      arrow.timeLeft = this.config.stuckLifetime;
      return false;
    }

    arrow.position.copyFrom(this.next);
    this.orient(arrow);
    return false;
  }

  private hitTarget(arrow: Arrow, target: CombatTarget, point: Vector3): void {
    const len = Math.hypot(arrow.velocity.x, arrow.velocity.z) || 1;
    this.damage.applyDirect(
      target,
      arrow.faction,
      {
        damage: arrow.damage,
        directionX: arrow.velocity.x / len,
        directionZ: arrow.velocity.z / len,
        knockback: this.config.knockback,
        hitStun: this.config.targetHitStun,
        heavy: false,
        stealthKill: true,
      },
      point,
    );
  }

  /** Ponta da flecha (+Z do modelo) na direção do movimento. */
  private orient(arrow: Arrow): void {
    arrow.node.position.copyFrom(arrow.position);
    if (arrow.velocity.lengthSquared() > 1e-6) {
      arrow.node.lookAt(arrow.position.add(arrow.velocity));
    }
  }

  private *targetsOf(shooter: Faction): Iterable<CombatTarget> {
    yield* this.damage.aliveTargets(shooter === "player" ? "enemy" : "player");
  }

  private remove(index: number): void {
    const arrow = this.arrows[index];
    if (!arrow) return;
    arrow.node.dispose();
    this.arrows.splice(index, 1);
  }
}
