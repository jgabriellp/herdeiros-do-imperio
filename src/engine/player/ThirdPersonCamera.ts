import { PhysicsEngineV2, PhysicsRaycastResult, TargetCamera, Vector3, type Scene } from "@babylonjs/core";
import { CollisionLayers } from "../core/CollisionLayers";
import type { InputManager } from "../core/input/InputManager";
import { clamp, damp, shortestAngle, yawFromDirection } from "../core/mathUtils";
import type { ThirdPersonCameraConfig } from "./CameraConfig";

/** Fonte de tremida (ex.: vfx/CameraShake): deslocamento somado à câmera. */
export interface CameraShakeSource {
  readonly offset: Readonly<Vector3>;
}

/** Algo que a câmera segue: devolve a posição dos pés. */
export interface CameraFollowTarget {
  readonly feetPosition: Readonly<Vector3>;
}

/** Alvo da mira travada que a câmera enquadra junto com o jogador. */
export interface CameraLockTarget {
  readonly feetPosition: Readonly<Vector3>;
  readonly lockOnHeight: number;
}

/**
 * Câmera orbital em terceira pessoa.
 * - Livre: mouse/analógico controla yaw/pitch, com limites verticais e suavização.
 * - Travada: fica atrás do jogador olhando para o alvo e enquadra os dois.
 * - Mira (arco): aproxima e vai para o ombro direito, FOV menor, mouse mais preciso.
 * - Não atravessa paredes: raycast do jogador até a câmera contra a camada WORLD;
 *   aproxima na hora quando bloqueada e volta suavemente quando livre.
 */
export class ThirdPersonCamera {
  readonly camera: TargetCamera;
  private targetYaw: number;
  private targetPitch: number;
  private _yaw: number;
  private pitch: number;
  /** Distância escolhida pelo jogador (roda do mouse). */
  private userDistance: number;
  private currentDistance: number;
  private readonly followPoint = new Vector3();
  private readonly lookPoint = new Vector3();
  private readonly desiredLook = new Vector3();
  private readonly rayEnd = new Vector3();
  private readonly offset = new Vector3();
  private readonly scaled = new Vector3();
  private readonly hit = new PhysicsRaycastResult();
  private readonly shakenLook = new Vector3();
  /** Centro da órbita: o ponto seguido, deslocado para o ombro quando mira. */
  private readonly pivot = new Vector3();
  private readonly forward = new Vector3();
  /** 0 = câmera normal, 1 = câmera de mira (transição suave). */
  private aimBlend = 0;
  private initialized = false;
  private shake: CameraShakeSource | null = null;

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
    this.userDistance = this.currentDistance = config.distance;
  }

  /** Yaw atual: define a "frente" do movimento relativo à câmera. */
  get yaw(): number {
    return this._yaw;
  }

  /** Distância atual entre a câmera e o ponto seguido (já considerando colisões). */
  get distance(): number {
    return this.currentDistance;
  }

  /** Direção para onde a câmera olha (centro da tela = retícula). */
  get aimDirection(): Readonly<Vector3> {
    return this.forward;
  }

  get position(): Readonly<Vector3> {
    return this.camera.position;
  }

  setShakeSource(shake: CameraShakeSource | null): void {
    this.shake = shake;
  }

  /** Coloca a câmera atrás do jogador na hora (ex.: ao renascer). */
  snapBehind(playerYaw: number): void {
    this.targetYaw = this._yaw = playerYaw;
    this.targetPitch = this.pitch = this.config.initialPitch;
    this.initialized = false;
  }

  /** Gira suavemente para ficar atrás do jogador (Q sem alvo, como no Zelda). */
  recenter(playerYaw: number): void {
    this.targetYaw = this._yaw + shortestAngle(this._yaw, playerYaw);
    this.targetPitch = this.config.initialPitch;
  }

  update(dt: number, lock: CameraLockTarget | null, aiming = false): void {
    const cfg = this.config;
    this.updateFollowPoint(dt);
    this.aimBlend += ((aiming ? 1 : 0) - this.aimBlend) * damp(cfg.aim.blendSharpness, dt);

    let wantedDistance: number;
    let rotationSharpness: number;
    if (aiming) {
      // Mirando, o mouse manda (mais preciso) e a trava é ignorada.
      const look = this.input.look;
      this.targetYaw += look.x * cfg.aim.sensitivityScale;
      this.targetPitch = clamp(this.targetPitch + look.y * cfg.aim.sensitivityScale, cfg.aim.minPitch, cfg.aim.maxPitch);
      wantedDistance = cfg.aim.distance;
      rotationSharpness = cfg.rotationSharpness;
    } else if (lock) {
      const t = lock.feetPosition;
      const dx = t.x - this.followPoint.x;
      const dz = t.z - this.followPoint.z;
      // Atrás do jogador, olhando para o alvo (yaw sem "dar a volta" pelo caminho longo).
      this.targetYaw = this._yaw + shortestAngle(this._yaw, yawFromDirection(dx, dz));
      this.targetPitch = cfg.lockPitch;
      const separation = Math.hypot(dx, dz);
      wantedDistance = clamp(cfg.distance + separation * cfg.lockDistancePerMeter, cfg.minDistance, cfg.maxDistance);
      this.desiredLook.set(t.x, t.y + lock.lockOnHeight, t.z);
      Vector3.LerpToRef(this.followPoint, this.desiredLook, cfg.lockLookBias, this.desiredLook);
      rotationSharpness = cfg.lockRotationSharpness;
    } else {
      const look = this.input.look;
      this.targetYaw += look.x;
      this.targetPitch = clamp(this.targetPitch + look.y, cfg.minPitch, cfg.maxPitch);
      this.userDistance = clamp(this.userDistance + this.input.zoom * cfg.zoomStep, cfg.minDistance, cfg.maxDistance);
      wantedDistance = this.userDistance;
      rotationSharpness = cfg.rotationSharpness;
    }

    const rot = damp(rotationSharpness, dt);
    this._yaw += (this.targetYaw - this._yaw) * rot;
    this.pitch += (this.targetPitch - this.pitch) * rot;

    // Direção do jogador para a câmera (oposta ao "olhar").
    const cosPitch = Math.cos(this.pitch);
    this.offset.set(-Math.sin(this._yaw) * cosPitch, Math.sin(this.pitch), -Math.cos(this._yaw) * cosPitch);
    this.offset.scaleToRef(-1, this.forward);

    // Pivô no ombro direito conforme a mira entra (direita da câmera = (cos, 0, -sin)).
    const shoulder = cfg.aim.shoulderOffset * this.aimBlend;
    this.pivot.set(
      this.followPoint.x + Math.cos(this._yaw) * shoulder,
      this.followPoint.y + cfg.aim.heightOffset * this.aimBlend,
      this.followPoint.z - Math.sin(this._yaw) * shoulder,
    );
    // Sem trava, a câmera olha "através" do pivô (ao longo da frente).
    if (!lock || aiming) this.desiredLook.copyFrom(this.pivot);
    Vector3.LerpToRef(this.lookPoint, this.desiredLook, damp(cfg.lookSharpness, dt), this.lookPoint);
    if (aiming) this.lookPoint.copyFrom(this.pivot); // mirando: sem atraso entre retícula e mouse
    this.camera.fov = cfg.fov + (cfg.aim.fov - cfg.fov) * this.aimBlend;

    const allowed = this.collisionDistance(wantedDistance);
    if (allowed < this.currentDistance) {
      this.currentDistance = allowed; // obstáculo: aproxima imediatamente
    } else {
      this.currentDistance += (allowed - this.currentDistance) * damp(cfg.distanceSharpness, dt);
    }

    this.offset.scaleToRef(this.currentDistance, this.scaled);
    this.camera.position.copyFrom(this.pivot).addInPlace(this.scaled);
    if (this.shake) {
      // Desloca câmera e alvo juntos: treme a imagem sem girar o mundo.
      this.camera.position.addInPlace(this.shake.offset);
      this.camera.setTarget(this.lookPoint.addToRef(this.shake.offset, this.shakenLook));
    } else {
      this.camera.setTarget(this.lookPoint);
    }
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
      this.lookPoint.copyFrom(this.followPoint);
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
    this.offset.scaleToRef(reach, this.scaled);
    this.rayEnd.copyFrom(this.pivot).addInPlace(this.scaled);
    physics.raycastToRef(this.pivot, this.rayEnd, this.hit, { collideWith: CollisionLayers.WORLD });
    if (!this.hit.hasHit) return wanted;
    return Math.max(0.2, Math.min(wanted, this.hit.hitDistance - this.config.collisionMargin));
  }
}
