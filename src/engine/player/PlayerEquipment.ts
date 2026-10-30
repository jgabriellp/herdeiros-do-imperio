import { getItem, type ItemDef, type ShieldItem, type SwordItem } from "../items/ItemConfig";
import type { SaveManager } from "../save/SaveManager";

/** Punhos ou a arma equipada (espada e/ou escudo). */
export type WeaponMode = "unarmed" | "armed";

export interface GrantResult {
  item: ItemDef;
  /** true = foi para a mão; false = guardado no inventário (slot já ocupado). */
  equipped: boolean;
}

/**
 * Equipamento do jogador. A verdade fica no save (`equipment`): o que está em cada mão
 * e o inventário (`owned`). `grant` é o ÚNICO caminho para dar um item ao jogador:
 * itens do mapa hoje; NPCs e diálogos no futuro.
 */
export class PlayerEquipment {
  private _mode: WeaponMode;

  constructor(private readonly save: SaveManager) {
    this._mode = this.hasAnyWeapon ? "armed" : "unarmed";
  }

  get swordId(): string | null {
    return this.sword ? this.save.current.equipment.mainHand : null;
  }

  get shieldId(): string | null {
    return this.shield ? this.save.current.equipment.offHand : null;
  }

  get sword(): SwordItem | null {
    const item = getItem(this.save.current.equipment.mainHand);
    return item?.kind === "sword" ? item : null;
  }

  get shield(): ShieldItem | null {
    const item = getItem(this.save.current.equipment.offHand);
    return item?.kind === "shield" ? item : null;
  }

  get hasAnyWeapon(): boolean {
    return this.sword !== null || this.shield !== null;
  }

  get mode(): WeaponMode {
    return this._mode;
  }

  /** Espada na mão (golpes de espada em vez de socos). */
  get swordDrawn(): boolean {
    return this._mode === "armed" && this.sword !== null;
  }

  /** Escudo na mão (pode bloquear). */
  get canBlock(): boolean {
    return this._mode === "armed" && this.shield !== null;
  }

  /** Troca de arma. Retorna false se não houver o que empunhar. */
  setMode(mode: WeaponMode): boolean {
    if (mode === "armed" && !this.hasAnyWeapon) return false;
    if (mode === this._mode) return false;
    this._mode = mode;
    return true;
  }

  /** Dá um item ao jogador: entra no inventário e, se o slot estiver vazio, é equipado. */
  grant(itemId: string): GrantResult | null {
    const item = getItem(itemId);
    if (!item) {
      console.error(`[PlayerEquipment] item desconhecido "${itemId}"`);
      return null;
    }
    this.save.addOwnedItem(itemId);
    const slotEmpty = this.save.current.equipment[item.slot] === null;
    if (slotEmpty) {
      this.save.setEquipment({ [item.slot]: itemId });
      // Primeira arma: já empunha.
      this._mode = "armed";
    }
    return { item, equipped: slotEmpty };
  }

  /** Texto curto para o HUD. */
  get label(): string {
    if (this._mode === "unarmed") return "Punhos";
    return [this.sword?.name, this.shield?.name].filter(Boolean).join(" + ");
  }
}
