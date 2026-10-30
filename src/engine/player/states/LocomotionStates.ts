import { PlayerState, type PlayerStateName } from "./PlayerState";

/** Abaixo disso o input analógico conta como "parado". */
export const MOVE_DEADZONE = 0.1;

/**
 * Base de Idle/Move/Run: movimento livre no chão e a porta de entrada
 * para pulo, golpes, esquiva e bloqueio.
 */
abstract class LocomotionState<K extends "Idle" | "Move" | "Run"> extends PlayerState<K> {
  update(_dt: number): void {
    const { input, motor } = this.ctx;

    if (!motor.grounded) {
      this.machine.change("Jump", { jumped: false });
      return;
    }
    if (input.wasPressed("dodge") && this.machine.tryDodge()) return;
    if (this.ctx.equipment.bowDrawn) {
      // Com o arco: botão direito mira; clique sem mirar = tiro rápido.
      if (input.isDown("aim")) {
        this.machine.change("Aim", { hip: false });
        return;
      }
      if (input.wasPressed("attack")) {
        this.machine.change("Aim", { hip: true });
        return;
      }
    }
    if (input.isDown("block") && this.ctx.equipment.canBlock) {
      this.machine.change("Block");
      return;
    }
    if (input.wasPressed("attack")) {
      this.machine.change("Attack", { attack: this.ctx.comboStarter(), comboIndex: 0 });
      return;
    }
    if (input.wasPressed("kick")) {
      this.machine.change("Attack", { attack: this.ctx.combat.kick, comboIndex: 0 });
      return;
    }
    if (input.wasPressed("jump")) {
      this.machine.change("Jump", { jumped: true });
      return;
    }

    const next = pickLocomotion(this.moveMagnitude(), input.isDown("run"), this.ctx.lockYaw() !== null);
    if (next !== this.name) this.machine.change(next);
    // Aplica depois da troca: entre Idle/Move/Run o movimento continua sem interrupção.
    this.applyLocomotionIntent(locomotionSpeed(this.ctx, next));
  }
}

export class IdleState extends LocomotionState<"Idle"> {
  readonly name = "Idle" as const;
}

export class MoveState extends LocomotionState<"Move"> {
  readonly name = "Move" as const;
}

export class RunState extends LocomotionState<"Run"> {
  readonly name = "Run" as const;
}

/** Travado não corre: o deslocamento vira strafe controlado em volta do alvo. */
export function pickLocomotion(magnitude: number, runHeld: boolean, locked: boolean): "Idle" | "Move" | "Run" {
  if (magnitude < MOVE_DEADZONE) return "Idle";
  return runHeld && !locked ? "Run" : "Move";
}

export function locomotionSpeed(
  ctx: {
    movement: { walkSpeed: number; runSpeed: number; crouchSpeed: number };
    combat: { lock: { lockedMoveSpeed: number } };
    crouched: boolean;
    lockYaw(): number | null;
  },
  state: PlayerStateName,
): number {
  if (ctx.crouched) return ctx.movement.crouchSpeed;
  if (ctx.lockYaw() !== null) return ctx.combat.lock.lockedMoveSpeed;
  return state === "Run" ? ctx.movement.runSpeed : ctx.movement.walkSpeed;
}
