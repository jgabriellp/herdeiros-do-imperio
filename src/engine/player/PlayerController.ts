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

/** Avisos do controlador para quem está fora (câmera, HUD). */
export interface PlayerControllerEvents {
  /** Q sem alvo à frente: câmera volta para trás do jogador (como no Zelda). */
  onRecenterRequest(yaw: number): void;
  /** Trocou de arma (1/2). */
  onWeaponChanged(label: string): void;
}

/** Estados em que dá para trocar de arma (não no meio de um golpe, esquiva ou queda). */
const CAN_SWITCH_WEAPON: ReadonlySet<string> = new Set(["Idle", "Move", "Run", "Block"]);

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
    this.ctx.viewYaw = cameraYaw;
    this.updateLock(cameraYaw);
    this.updateMoveDirection(cameraYaw);
    this.updateWeaponSwitch();

    this.machine.update(dt);
    this.motor.step(dt, this.ctx.intent);

    // Caiu para fora do mundo: volta ao ponto de renascimento atual (último checkpoint).
    if (this.motor.feetPosition.y < this.movement.fallRespawnY) this.motor.teleport(this.respawnPoint);
    this.syncVisual(dt);
  }

  private updateWeaponSwitch(): void {
    if (!CAN_SWITCH_WEAPON.has(this.machine.current.name)) return;
    const { input, equipment } = this.ctx;
    const mode = input.wasPressed("weaponUnarmed")
      ? "unarmed"
      : input.wasPressed("weaponArmed")
        ? "armed"
        : input.wasPressed("weaponBow")
          ? "bow"
          : null;
    if (mode && equipment.setMode(mode)) this.events.onWeaponChanged(equipment.label);
  }

  private updateLock(cameraYaw: number): void {
    const feet = this.motor.feetPosition;
    if (!this.stats.isAlive) return;
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
        gear: {
          sword: this.ctx.equipment.swordId,
          shield: this.ctx.equipment.shieldId,
          bow: this.ctx.equipment.bowId,
          mode: this.ctx.equipment.mode,
        },
      },
      dt,
    );
  }
}

/** Yaw horizontal de um ponto para outro. */
export function yawTowards(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return yawFromDirection(toX - fromX, toZ - fromZ);
}
