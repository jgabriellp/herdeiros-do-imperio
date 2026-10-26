import { PhysicsEngineV2, PhysicsRaycastResult, TargetCamera, Vector3, type Scene } from "@babylonjs/core";
import { CollisionLayers } from "../core/CollisionLayers";
import type { InputManager } from "../core/input/InputManager";
import { clamp, damp } from "../core/mathUtils";
import type { ThirdPersonCameraConfig } from "./CameraConfig";

/** Algo que a câmera segue: devolve a posição dos pés. */
export interface CameraFollowTarget {
  readonly feetPosition: Readonly<Vector3>;
}

/**
 * Câmera orbital em terceira pessoa controlada pelo mouse/analógico.
 * - yaw/pitch com limites verticais e suavização
 * - segue o alvo com atraso suave
 * - não atravessa paredes: raycast do alvo até a câmera contra a camada WORLD;
 *   aproxima na hora quando bloqueada e volta suavemente quando livre
 */
export class ThirdPersonCamera {
  readonly camera: TargetCamera;
  private targetYaw = 0;
  private targetPitch: number;
  private _yaw = 0;
  private pitch: number;
  private desiredDistance: number;
  private currentDistance: number;
  private readonly followPoint = new Vector3();
  private readonly rayEnd = new Vector3();
  private readonly offset = new Vector3();
  private readonly hit = new PhysicsRaycastResult();
  private initialized = false;

  constructor(
    private readonly scene: Scene,
    private readonly target: CameraFollowTarget,
    private readonly input: InputManager,
    private readonly config: ThirdPersonCameraConfig,
    initialYaw = 0,
  ) {
    this.camera = new TargetCamera("thirdPersonCamera", Vector3.Zero(), scene);
    this.camera.fov = config.fov;
    this.camera.minZ = config.nearPlane;
    scene.activeCamera = this.camera;

    this.targetYaw = this._yaw = initialYaw;
    this.targetPitch = this.pitch = config.initialPitch;
    this.desiredDistance = this.currentDistance = config.distance;
  }

  /** Distância atual entre a câmera e o ponto seguido (já considerando colisões). */
  get distance(): number {
    return this.currentDistance;
  }

  /** Yaw atual: define a "frente" do movimento relativo à câmera. */
  get yaw(): number {
    return this._yaw;
  }

  update(dt: number): void {
    const cfg = this.config;
    const look = this.input.look;
    this.targetYaw += look.x;
    this.targetPitch = clamp(this.targetPitch + look.y, cfg.minPitch, cfg.maxPitch);
    this.desiredDistance = clamp(
      this.desiredDistance + this.input.zoom * cfg.zoomStep,
      cfg.minDistance,
      cfg.maxDistance,
    );

    const rot = damp(cfg.rotationSharpness, dt);
    this._yaw += (this.targetYaw - this._yaw) * rot;
    this.pitch += (this.targetPitch - this.pitch) * rot;

    this.updateFollowPoint(dt);

    // Direção do alvo para a câmera (oposta ao "olhar").
    const cosPitch = Math.cos(this.pitch);
    this.offset.set(-Math.sin(this._yaw) * cosPitch, Math.sin(this.pitch), -Math.cos(this._yaw) * cosPitch);

    const allowed = this.collisionDistance(this.desiredDistance);
    if (allowed < this.currentDistance) {
      this.currentDistance = allowed; // obstáculo: aproxima imediatamente
    } else {
      this.currentDistance += (allowed - this.currentDistance) * damp(cfg.distanceSharpness, dt);
    }

    this.camera.position.copyFrom(this.followPoint).addInPlace(this.offset.scale(this.currentDistance));
    this.camera.setTarget(this.followPoint);
  }

  dispose(): void {
    if (this.scene.activeCamera === this.camera) this.scene.activeCamera = null;
    this.camera.dispose();
  }

  private updateFollowPoint(dt: number): void {
    const feet = this.target.feetPosition;
    const tx = feet.x;
    const ty = feet.y + this.config.followHeight;
    const tz = feet.z;
    if (!this.initialized) {
      this.followPoint.set(tx, ty, tz);
      this.initialized = true;
      return;
    }
    const f = damp(this.config.followSharpness, dt);
    this.followPoint.x += (tx - this.followPoint.x) * f;
    this.followPoint.y += (ty - this.followPoint.y) * f;
    this.followPoint.z += (tz - this.followPoint.z) * f;
  }

  /** Maior distância possível até `wanted` sem atravessar o cenário. */
  private collisionDistance(wanted: number): number {
    const physics = this.scene.getPhysicsEngine();
    if (!(physics instanceof PhysicsEngineV2)) return wanted;
    const reach = wanted + this.config.collisionMargin;
    this.rayEnd.copyFrom(this.followPoint).addInPlace(this.offset.scale(reach));
    physics.raycastToRef(this.followPoint, this.rayEnd, this.hit, { collideWith: CollisionLayers.WORLD });
    if (!this.hit.hasHit) return wanted;
    return Math.max(0.2, Math.min(wanted, this.hit.hitDistance - this.config.collisionMargin));
  }
}
