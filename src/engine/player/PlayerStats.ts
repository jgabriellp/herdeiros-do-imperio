import type { StaminaConfig } from "../combat/CombatConfig";

/** Vida e stamina do jogador. Máximos vêm do save (atributos do jogador). */
export class PlayerStats {
  health: number;
  stamina: number;
  private regenCooldown = 0;

  constructor(
    public maxHealth: number,
    public maxStamina: number,
    private readonly staminaConfig: StaminaConfig,
  ) {
    this.health = maxHealth;
    this.stamina = maxStamina;
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  /** Gasta stamina se houver o suficiente. */
  trySpendStamina(amount: number): boolean {
    if (this.stamina < amount) return false;
    this.stamina -= amount;
    this.regenCooldown = this.staminaConfig.regenDelay;
    return true;
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  update(dt: number): void {
    if (this.regenCooldown > 0) {
      this.regenCooldown -= dt;
      return;
    }
    this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaConfig.regenPerSecond * dt);
  }
}
