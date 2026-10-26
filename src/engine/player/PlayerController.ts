import type { Vec3Data } from "../../shared/types";
import type { InputManager } from "../core/input/InputManager";
import type { MovementConfig } from "./PlayerConfig";
import type { MoveIntent, PlayerMotor } from "./PlayerMotor";
import type { PlayerVisual } from "./PlayerVisual";

/**
 * Traduz o input em intenção de movimento relativa à câmera,
 * aplica no motor e sincroniza o visual.
 * Na Tarefa 3, a PlayerStateMachine assume a decisão do que fazer em cada estado.
 */
export class PlayerController {
  private readonly intent: MoveIntent = { directionX: 0, directionZ: 0, maxSpeed: 0, faceYaw: null };

  constructor(
    private readonly input: InputManager,
    private readonly motor: PlayerMotor,
    private readonly visual: PlayerVisual,
    private readonly config: MovementConfig,
    private respawnPoint: Vec3Data,
  ) {
    this.syncVisual(0);
  }

  setRespawnPoint(point: Vec3Data): void {
    this.respawnPoint = point;
  }

  /** @param cameraYaw yaw da câmera: "frente" do input = para onde a câmera olha. */
  update(dt: number, cameraYaw: number): void {
    const { move } = this.input;
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    // frente da câmera = (sin, 0, cos); direita = (cos, 0, -sin)
    this.intent.directionX = move.x * cos + move.y * sin;
    this.intent.directionZ = -move.x * sin + move.y * cos;
    this.intent.maxSpeed = this.input.isDown("run") ? this.config.runSpeed : this.config.walkSpeed;
    this.intent.faceYaw = null;

    if (this.input.wasPressed("jump")) this.motor.requestJump();

    this.motor.step(dt, this.intent);

    if (this.motor.feetPosition.y < this.config.fallRespawnY) this.motor.teleport(this.respawnPoint);

    this.syncVisual(dt);
  }

  private syncVisual(dt: number): void {
    const root = this.visual.root;
    root.position.copyFrom(this.motor.feetPosition);
    root.rotation.y = this.motor.facingYaw;

    const speed = this.motor.horizontalSpeed;
    const { walkSpeed, runSpeed } = this.config;
    const speedRatio = speed <= walkSpeed ? speed / walkSpeed : 1 + (speed - walkSpeed) / (runSpeed - walkSpeed);
    this.visual.update({ speed, speedRatio, grounded: this.motor.grounded, verticalSpeed: this.motor.verticalSpeed }, dt);
  }
}
