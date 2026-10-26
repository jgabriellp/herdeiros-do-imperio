import type { Vec3Data } from "../../shared/types";
import type { CharacterMotor } from "../character/CharacterMotor";
import type { MovementConfig } from "../character/CharacterConfig";
import type { TargetLock } from "../combat/TargetLock";
import type { InputManager } from "../core/input/InputManager";
import { yawFromDirection } from "../core/mathUtils";
import type { PlayerStateMachine } from "./PlayerStateMachine";
import type { PlayerStats } from "./PlayerStats";
import type { PlayerVisual } from "./PlayerVisual";
import type { PlayerContext } from "./states/PlayerState";

/** Avisos do controlador para a câmera. */
export interface PlayerControllerEvents {
  /** Q sem alvo à frente: câmera volta para trás do jogador (como no Zelda). */
  onRecenterRequest(yaw: number): void;
}

/**
 * Orquestra um quadro do jogador:
 * input → mira travada → direção relativa (câmera ou alvo) → máquina de estados → motor → visual.
 */
export class PlayerController {
  constructor(
    private readonly ctx: PlayerContext,
    private readonly machine: PlayerStateMachine,
    private readonly motor: CharacterMotor,
    private readonly stats: PlayerStats,
    private readonly lock: TargetLock,
    private readonly input: InputManager,
    private readonly visual: PlayerVisual,
    private readonly movement: MovementConfig,
    private readonly events: PlayerControllerEvents,
    private respawnPoint: Vec3Data,
  ) {
    this.syncVisual(0);
  }

  setRespawnPoint(point: Vec3Data): void {
    this.respawnPoint = point;
  }

  /** @param cameraYaw yaw da câmera: "frente" do input quando não há trava. */
  update(dt: number, cameraYaw: number): void {
    this.stats.update(dt);
    this.updateLock(cameraYaw);
    this.updateMoveDirection(cameraYaw);

    this.machine.update(dt);
    this.motor.step(dt, this.ctx.intent);

    if (this.motor.feetPosition.y < this.movement.fallRespawnY) this.motor.teleport(this.respawnPoint);
    this.syncVisual(dt);
  }

  private updateLock(cameraYaw: number): void {
    const feet = this.motor.feetPosition;
    if (this.input.wasPressed("lockOn")) {
      if (this.lock.target) {
        this.lock.release();
      } else if (!this.lock.acquire(feet.x, feet.z, cameraYaw)) {
        this.events.onRecenterRequest(this.motor.facingYaw);
      }
    }
    this.lock.validate(feet.x, feet.z);
  }

  /**
   * Converte o input (x = direita, y = frente) em direção no mundo.
   * Travado, "frente" é o alvo: A/D andam em círculo em volta dele (strafe).
   */
  private updateMoveDirection(cameraYaw: number): void {
    const basisYaw = this.ctx.lockYaw() ?? cameraYaw;
    const { move } = this.input;
    const sin = Math.sin(basisYaw);
    const cos = Math.cos(basisYaw);
    // frente = (sin, 0, cos); direita = (cos, 0, -sin)
    this.ctx.moveDir.x = move.x * cos + move.y * sin;
    this.ctx.moveDir.z = -move.x * sin + move.y * cos;
  }

  private syncVisual(dt: number): void {
    const root = this.visual.root;
    root.position.copyFrom(this.motor.feetPosition);
    root.rotation.y = this.motor.facingYaw;

    const speed = this.motor.horizontalSpeed;
    const { walkSpeed, runSpeed } = this.movement;
    const speedRatio = speed <= walkSpeed ? speed / walkSpeed : 1 + (speed - walkSpeed) / (runSpeed - walkSpeed);
    this.visual.update(
      {
        speed,
        speedRatio,
        grounded: this.motor.grounded,
        verticalSpeed: this.motor.verticalSpeed,
        action: this.ctx.action,
      },
      dt,
    );
  }
}

/** Yaw horizontal de um ponto para outro. */
export function yawTowards(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return yawFromDirection(toX - fromX, toZ - fromZ);
}
