import { getItem, type BowItem, type ItemDef, type ShieldItem, type SwordItem } from "../items/ItemConfig";
import type { SaveManager } from "../save/SaveManager";

/** O que está empunhado: punhos, arma de corpo a corpo (espada e/ou escudo) ou arco. */
export type WeaponMode = "unarmed" | "armed" | "bow";

export interface GrantResult {
  item: ItemDef;
  /** true = foi para a mão; false = guardado no inventário (slot já ocupado). */
  equipped: boolean;
}

/**
 * Equipamento do jogador. A verdade fica no save (`equipment`): o que está em cada slot
 * e o inventário (`owned`). `grant` é o ÚNICO caminho para dar um item ao jogador:
 * itens do mapa hoje; NPCs e diálogos no futuro.
 */
export class PlayerEquipment {
  private _mode: WeaponMode;

  constructor(private readonly save: SaveManager) {
    this._mode = this.hasMelee ? "armed" : this.bow ? "bow" : "unarmed";
  }

  get swordId(): string | null {
    return this.sword ? this.save.current.equipment.mainHand : null;
  }

  get shieldId(): string | null {
    return this.shield ? this.save.current.equipment.offHand : null;
  }

  get bowId(): string | null {
    return this.bow ? this.save.current.equipment.ranged : null;
  }

  get sword(): SwordItem | null {
    const item = getItem(this.save.current.equipment.mainHand);
    return item?.kind === "sword" ? item : null;
  }

  get shield(): ShieldItem | null {
    const item = getItem(this.save.current.equipment.offHand);
    return item?.kind === "shield" ? item : null;
  }

  get bow(): BowItem | null {
    const item = getItem(this.save.current.equipment.ranged);
    return item?.kind === "bow" ? item : null;
  }

  /** Tem espada e/ou escudo (modo "armed"). */
  get hasMelee(): boolean {
    return this.sword !== null || this.shield !== null;
  }

  /** Há mais de um modo disponível (vale mostrar os atalhos de troca). */
  get canSwitch(): boolean {
    return this.hasMelee || this.bow !== null;
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

  /** Arco na mão (pode mirar e atirar). */
  get bowDrawn(): boolean {
    return this._mode === "bow" && this.bow !== null;
  }

  /** Troca de arma. Retorna false se não houver o que empunhar (ou já estiver nesse modo). */
  setMode(mode: WeaponMode): boolean {
    if (mode === "armed" && !this.hasMelee) return false;
    if (mode === "bow" && !this.bow) return false;
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
      // De mãos vazias, a arma recebida já é empunhada; senão mantém o que está na mão.
      if (this._mode === "unarmed") this._mode = item.kind === "bow" ? "bow" : "armed";
    }
    return { item, equipped: slotEmpty };
  }

  /** Texto curto para o HUD. */
  get label(): string {
    if (this._mode === "unarmed") return "Punhos";
    if (this._mode === "bow") return this.bow?.name ?? "Punhos";
    return [this.sword?.name, this.shield?.name].filter(Boolean).join(" + ");
  }

  /** Atalhos de troca disponíveis, para o HUD (ex.: "[1] Punhos  [2] Espada  [3] Arco"). */
  get switchHint(): string {
    const parts = ["[1] Punhos"];
    if (this.hasMelee) parts.push(`[2] ${this.sword ? "Espada" : "Escudo"}`);
    if (this.bow) parts.push("[3] Arco");
    return parts.join("  ");
  }
}
