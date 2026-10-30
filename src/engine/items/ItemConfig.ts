/**
 * Catálogo de itens conhecidos pelo motor. Episódios referenciam itens pelo id
 * (pickups no level.json hoje; diálogos/NPCs no futuro).
 */

export type ItemSlot = "mainHand" | "offHand" | "ranged";

export interface SwordItem {
  kind: "sword";
  slot: "mainHand";
  name: string;
  /** Multiplica o dano dos golpes de espada do CombatConfig. */
  damageMultiplier: number;
  /** Visual provisório. */
  bladeLength: number;
  bladeColor: string;
}

export interface ShieldItem {
  kind: "shield";
  slot: "offHand";
  name: string;
  /** Multiplica a stamina gasta ao bloquear (menor = escudo melhor). */
  blockCostMultiplier: number;
  /** Visual provisório. */
  diameter: number;
  color: string;
}

export interface BowItem {
  kind: "bow";
  slot: "ranged";
  name: string;
  /** Multiplica dano e velocidade das flechas do CombatConfig.bow. */
  powerMultiplier: number;
  /** Visual provisório. */
  height: number;
  color: string;
}

export type ItemDef = SwordItem | ShieldItem | BowItem;

export const ITEMS: Record<string, ItemDef> = {
  espada_simples: {
    kind: "sword",
    slot: "mainHand",
    name: "Espada Simples",
    damageMultiplier: 1,
    bladeLength: 0.9,
    bladeColor: "#c9ced6",
  },
  arco_curto: {
    kind: "bow",
    slot: "ranged",
    name: "Arco Curto",
    powerMultiplier: 1,
    height: 1.1,
    color: "#6b4423",
  },
  escudo_madeira: {
    kind: "shield",
    slot: "offHand",
    name: "Escudo de Madeira",
    blockCostMultiplier: 1,
    diameter: 0.62,
    color: "#7a5230",
  },
};

export function getItem(id: string | null): ItemDef | null {
  return id ? (ITEMS[id] ?? null) : null;
}
