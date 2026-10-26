import { locomotionSpeed } from "./LocomotionStates";
import { PlayerState, type PlayerStateParams } from "./PlayerState";

/** Evita sair do pulo no mesmo quadro em que ele começa (o chão ainda está "perto"). */
const MIN_AIR_TIME = 0.1;

/** No ar: pulando ou caindo de uma borda. Controle aéreo reduzido (no motor). */
export class JumpState extends PlayerState<"Jump"> {
  readonly name = "Jump" as const;
  private jumped = false;
  /** Mantém a velocidade de corrida no ar se o pulo começou correndo. */
  private running = false;

  override enter(params: PlayerStateParams["Jump"]): void {
    super.enter(params);
    this.jumped = params.jumped;
    this.running = this.ctx.input.isDown("run");
    if (params.jumped) this.ctx.motor.requestJump();
  }

  update(dt: number): void {
    this.elapsed += dt;
    const { input, motor } = this.ctx;

    // Caiu da borda e apertou pulo logo depois: o motor decide pelo coyote time.
    if (!this.jumped && input.wasPressed("jump")) {
      this.jumped = true;
      motor.requestJump();
    }

    this.applyLocomotionIntent(locomotionSpeed(this.ctx, this.running ? "Run" : "Move"));

    if (this.elapsed > MIN_AIR_TIME && motor.grounded) this.machine.toLocomotion();
  }
}
