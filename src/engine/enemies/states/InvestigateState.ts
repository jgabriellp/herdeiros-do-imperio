import { Vector3 } from "@babylonjs/core";
import { yawFromDirection } from "../../core/mathUtils";
import { EnemyState, type EnemyStateParams } from "./EnemyState";

/** Chegou ao ponto quando está a menos disto (m). */
const ARRIVE_DISTANCE = 1;
/** Velocidade angular de "olhar em volta" no ponto investigado. */
const LOOK_SWEEP_SPEED = 1.4;
const LOOK_SWEEP_ANGLE = 1.1;
const LOOK_TURN_SHARPNESS = 3;

type Phase = "go" | "look" | "return";

/**
 * Desconfiado (?): vai até o ponto suspeito, olha em volta e, sem achar nada,
 * volta ao posto e ao estado desprevenido. Um novo estímulo no caminho redireciona.
 * Quem passa a alerta (viu de verdade, ouviu um grito, foi atingido) é decidido no Enemy.
 */
export class InvestigateState extends EnemyState<"Investigate"> {
  readonly name = "Investigate" as const;
  private phase: Phase = "go";
  private readonly target = new Vector3();
  private phaseTime = 0;
  private lookBaseYaw = 0;

  override enter(params: EnemyStateParams["Investigate"]): void {
    super.enter(params);
    this.retarget(params.point);
  }

  /** Novo ponto suspeito: vai até ele (reinicia a investigação). */
  retarget(point: Readonly<{ x: number; y: number; z: number }>): void {
    this.target.set(point.x, point.y, point.z);
    this.phase = "go";
    this.phaseTime = 0;
  }

  /** Ainda procurando (indicador "?"); voltando ao posto já não conta como desconfiado. */
  get searching(): boolean {
    return this.phase !== "return";
  }

  override get detail(): string {
    return this.phase === "return" ? "voltando ao posto" : this.phase === "look" ? "olhando em volta" : "investigando";
  }

  update(dt: number): void {
    this.phaseTime += dt;
    const { investigate } = this.ctx.type.ai;
    this.resetIntent();

    if (this.phase === "go") {
      const arrived = this.moveTowards(this.target, investigate.speedFactor);
      if (arrived || this.phaseTime > investigate.maxTravelTime) {
        this.phase = "look";
        this.phaseTime = 0;
        this.lookBaseYaw = this.ctx.motor.facingYaw;
      }
    } else if (this.phase === "look") {
      this.ctx.intent.faceYaw = this.lookBaseYaw + Math.sin(this.phaseTime * LOOK_SWEEP_SPEED) * LOOK_SWEEP_ANGLE;
      this.ctx.intent.turnSharpness = LOOK_TURN_SHARPNESS;
      if (this.phaseTime > investigate.lookAroundTime) {
        this.phase = "return";
        this.phaseTime = 0;
      }
    } else {
      const home = this.ctx.home;
      const arrived = this.moveTowards(home.position, investigate.speedFactor);
      if (arrived || this.phaseTime > investigate.maxTravelTime * 2) {
        this.ctx.motor.snapFacing(home.yaw);
        this.machine.change("Idle");
      }
    }
  }

  /** Anda até `point`; retorna true ao chegar. */
  private moveTowards(point: Readonly<{ x: number; z: number }>, speedFactor: number): boolean {
    const me = this.ctx.motor.feetPosition;
    const dx = point.x - me.x;
    const dz = point.z - me.z;
    const dist = Math.hypot(dx, dz);
    if (dist < ARRIVE_DISTANCE) return true;
    this.ctx.intent.directionX = dx / dist;
    this.ctx.intent.directionZ = dz / dist;
    this.ctx.intent.maxSpeed = this.ctx.stats.speed * speedFactor;
    this.ctx.intent.faceYaw = yawFromDirection(dx, dz);
    this.ctx.intent.turnSharpness = this.ctx.type.ai.turnSharpness;
    return false;
  }
}
