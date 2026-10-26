import {
  CharacterSupportedState,
  PhysicsCharacterController,
  Vector3,
  type CharacterSurfaceInfo,
  type Scene,
} from "@babylonjs/core";
import type { Vec3Data } from "../../shared/types";
import { damp, shortestAngle, yawFromDirection } from "../core/mathUtils";
import type { CapsuleShapeConfig, MovementConfig } from "./CharacterConfig";

/** O que a lógica (máquina de estados do jogador ou IA) pede ao corpo neste quadro. */
export interface MoveIntent {
  /** Direção no mundo, no plano XZ, com comprimento 0..1 (analógico). */
  directionX: number;
  directionZ: number;
  /** Velocidade máxima desejada (m/s). */
  maxSpeed: number;
  /** Para onde virar o corpo; null = virar para a direção do movimento. */
  faceYaw: number | null;
  /**
   * Velocidade horizontal imposta, sem aceleração (avanço de golpe, esquiva, knockback).
   * null = movimento normal a partir de direction/maxSpeed.
   */
  forcedVelocity: { x: number; z: number } | null;
  /** Nitidez do giro neste quadro; null = a do MovementConfig. */
  turnSharpness: number | null;
}

export function createMoveIntent(): MoveIntent {
  return { directionX: 0, directionZ: 0, maxSpeed: 0, faceYaw: null, forcedVelocity: null, turnSharpness: null };
}

const DOWN = new Vector3(0, -1, 0);
const MIN_TURN_INPUT = 0.1;
/**
 * Folga de contato do controlador. O padrão do Babylon (0.1) deixa o personagem
 * "flutuando" até 10 cm após uma queda rápida, porque o solver já considera contato.
 */
const CONTACT_TOLERANCE = 0.02;

/**
 * Corpo físico de um personagem sobre o PhysicsCharacterController do Havok:
 * aceleração/desaceleração, gravidade, pulo (com coyote time e buffer) e rotação.
 * Não lê input: recebe um MoveIntent. Jogador (máquina de estados) e inimigos (IA)
 * usam o mesmo motor.
 */
export class CharacterMotor {
  private readonly controller: PhysicsCharacterController;
  /** Distância do centro da cápsula até os pés visuais (meia altura + folga de contato). */
  private readonly footOffset: number;
  private readonly gravityVec: Vector3;
  private readonly velocity = new Vector3();
  private readonly feet = new Vector3();
  private readonly tmp = new Vector3();

  /** Velocidade horizontal "desejada", suavizada pela aceleração. */
  private velX = 0;
  private velZ = 0;
  private velY = 0;
  /** Velocidade vertical média do quadro (integração exata sob gravidade constante). */
  private frameVelY = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private _grounded = false;
  private _facingYaw = 0;

  constructor(
    scene: Scene,
    feetPosition: Vec3Data,
    shape: CapsuleShapeConfig,
    private readonly config: MovementConfig,
    /** Camada de colisão (CollisionLayers): permite filtrar consultas por tipo de personagem. */
    collisionLayer: number,
  ) {
    this.gravityVec = new Vector3(0, -config.gravity, 0);
    this.controller = new PhysicsCharacterController(
      Vector3.Zero(),
      { capsuleHeight: shape.height, capsuleRadius: shape.radius },
      scene,
    );
    // O controlador mantém a cápsula a keepDistance das superfícies; os pés visuais ficam no chão.
    this.footOffset = shape.height / 2 + this.controller.keepDistance;
    this.controller.setPosition(this.centerFromFeet(feetPosition));
    this.controller.keepContactTolerance = CONTACT_TOLERANCE;
    this.controller.maxStepHeight = shape.maxStepHeight;
    this.controller.maxSlopeCosine = Math.cos((shape.maxSlopeDegrees * Math.PI) / 180);
    this.controller.maxCharacterSpeedForSolver = Math.max(config.runSpeed, config.maxFallSpeed) + 5;
    // Filtro: a câmera e outras consultas podem ignorar personagens.
    this.controller.shape.filterMembershipMask = collisionLayer;
  }

  get grounded(): boolean {
    return this._grounded;
  }

  get facingYaw(): number {
    return this._facingYaw;
  }

  /** Vira o corpo imediatamente (ex.: início de golpe mirando o alvo). */
  snapFacing(yaw: number): void {
    this._facingYaw = yaw;
  }

  get horizontalSpeed(): number {
    return Math.hypot(this.velX, this.velZ);
  }

  get verticalSpeed(): number {
    return this.velY;
  }

  /** Posição dos pés (referência compartilhada; não modificar). */
  get feetPosition(): Readonly<Vector3> {
    const p = this.controller.getPosition();
    this.feet.set(p.x, p.y - this.footOffset, p.z);
    return this.feet;
  }

  /** Registra um pedido de pulo; vale por jumpBufferTime. */
  requestJump(): void {
    this.jumpBufferTimer = this.config.jumpBufferTime;
  }

  teleport(feet: Vec3Data): void {
    this.controller.setPosition(this.centerFromFeet(feet));
    this.controller.setVelocity(Vector3.Zero());
    this.velX = this.velZ = this.velY = this.frameVelY = 0;
  }

  step(dt: number, intent: MoveIntent): void {
    if (dt <= 0) return;
    const support = this.controller.checkSupport(dt, DOWN);
    // Subindo de um pulo, o chão ainda "aparece" por perto: não conta como apoiado.
    this._grounded = support.supportedState === CharacterSupportedState.SUPPORTED && this.velY <= 0;

    this.updateTimers(dt);
    this.updateHorizontal(dt, intent);
    this.updateVertical(dt);
    this.updateFacing(dt, intent);

    this.applyVelocity(support);
    this.controller.integrate(dt, support, this.gravityVec);

    // Bateu a cabeça no teto: o solver reduziu a subida pedida.
    const resolvedY = this.controller.getVelocity().y;
    if (this.velY > 0 && resolvedY < this.frameVelY - 0.01) this.velY = Math.min(this.velY, resolvedY);
  }

  dispose(): void {
    this.controller.dispose();
  }

  private centerFromFeet(feet: Vec3Data): Vector3 {
    return new Vector3(feet.x, feet.y + this.footOffset, feet.z);
  }

  private updateTimers(dt: number): void {
    this.coyoteTimer = this._grounded ? this.config.coyoteTime : Math.max(0, this.coyoteTimer - dt);
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
  }

  private updateHorizontal(dt: number, intent: MoveIntent): void {
    if (intent.forcedVelocity) {
      this.velX = intent.forcedVelocity.x;
      this.velZ = intent.forcedVelocity.z;
      return;
    }
    const cfg = this.config;
    const targetX = intent.directionX * intent.maxSpeed;
    const targetZ = intent.directionZ * intent.maxSpeed;
    const hasInput = intent.directionX !== 0 || intent.directionZ !== 0;

    let rate = hasInput ? cfg.groundAcceleration : cfg.groundDeceleration;
    if (!this._grounded) rate *= cfg.airControl;

    // Move a velocidade atual rumo à desejada, no máximo rate*dt por quadro.
    const dx = targetX - this.velX;
    const dz = targetZ - this.velZ;
    const dist = Math.hypot(dx, dz);
    const maxDelta = rate * dt;
    if (dist <= maxDelta) {
      this.velX = targetX;
      this.velZ = targetZ;
    } else {
      this.velX += (dx / dist) * maxDelta;
      this.velZ += (dz / dist) * maxDelta;
    }
  }

  private updateVertical(dt: number): void {
    const cfg = this.config;
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.velY = Math.sqrt(2 * cfg.gravity * cfg.jumpHeight);
      this.jumpBufferTimer = this.coyoteTimer = 0;
      this._grounded = false;
    } else if (this._grounded) {
      this.velY = this.frameVelY = 0;
      return;
    }
    // Usar a média entre a velocidade do início e do fim do quadro torna a altura
    // do pulo igual em qualquer FPS (Euler simples passaria do ponto em FPS baixo).
    const before = this.velY;
    const multiplier = before < 0 ? cfg.fallGravityMultiplier : 1;
    this.velY = Math.max(before - cfg.gravity * multiplier * dt, -cfg.maxFallSpeed);
    this.frameVelY = (before + this.velY) / 2;
  }

  private updateFacing(dt: number, intent: MoveIntent): void {
    let targetYaw = intent.faceYaw;
    if (targetYaw === null) {
      if (Math.hypot(intent.directionX, intent.directionZ) < MIN_TURN_INPUT) return;
      targetYaw = yawFromDirection(intent.directionX, intent.directionZ);
    }
    const sharpness = intent.turnSharpness ?? this.config.turnSharpness;
    this._facingYaw += shortestAngle(this._facingYaw, targetYaw) * damp(sharpness, dt);
  }

  private applyVelocity(support: CharacterSurfaceInfo): void {
    this.velocity.set(this.velX, this.frameVelY, this.velZ);
    if (this._grounded) {
      // No chão, projeta o movimento no plano da superfície (sobe/desce rampas sem "quicar")
      // e soma a velocidade da superfície (plataformas móveis).
      const n = support.averageSurfaceNormal;
      const speed = this.velocity.length();
      this.velocity.subtractInPlace(n.scaleToRef(Vector3.Dot(this.velocity, n), this.tmp));
      const projected = this.velocity.length();
      if (projected > 1e-4) this.velocity.scaleInPlace(speed / projected);
      // Pressiona contra a superfície; o solver do controlador anula o que penetraria.
      this.velocity.subtractInPlace(n.scaleToRef(this.config.groundStickSpeed, this.tmp));
      this.velocity.addInPlace(support.averageSurfaceVelocity);
    }
    this.controller.setVelocity(this.velocity);
  }
}
