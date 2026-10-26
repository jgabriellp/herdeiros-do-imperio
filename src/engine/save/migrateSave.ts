import { SAVE_FORMAT_VERSION, type SaveData, type StoryFlagValue } from "../../shared/types";
import { createDefaultSave } from "./defaultSave";

export type MigrationResult =
  | { ok: true; data: SaveData; migrated: boolean }
  | { ok: false; reason: "newer-version" | "corrupted"; detail: string };

type RawSave = Record<string, unknown>;

/**
 * Migrações em sequência: MIGRATIONS[n] converte um save da versão n para n+1.
 * Ao criar a versão 2 do formato: SAVE_FORMAT_VERSION = 2 e adicionar MIGRATIONS[1].
 */
const MIGRATIONS: Record<number, (save: RawSave) => RawSave> = {};

export function migrateSave(raw: unknown): MigrationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "corrupted", detail: "o save não é um objeto" };
  }
  let save = raw as RawSave;
  let version = save["formatVersion"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return { ok: false, reason: "corrupted", detail: `formatVersion inválido: ${String(version)}` };
  }
  if (version > SAVE_FORMAT_VERSION) {
    return {
      ok: false,
      reason: "newer-version",
      detail: `save na versão ${version}, este jogo entende até a ${SAVE_FORMAT_VERSION}`,
    };
  }

  const startVersion = version;
  while (version < SAVE_FORMAT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { ok: false, reason: "corrupted", detail: `sem migração da versão ${version}` };
    save = step(save);
    version += 1;
  }

  return { ok: true, data: sanitize(save), migrated: version !== startVersion };
}

/** Preenche campos ausentes/inválidos com o padrão, sem descartar o que é válido. */
function sanitize(save: RawSave): SaveData {
  const d = createDefaultSave();
  const player = asObject(save["player"]);
  const equipment = asObject(save["equipment"]);

  return {
    formatVersion: SAVE_FORMAT_VERSION,
    updatedAt: typeof save["updatedAt"] === "string" ? save["updatedAt"] : d.updatedAt,
    completedEpisodes: stringArray(save["completedEpisodes"]),
    currentEpisodeId: stringOrNull(save["currentEpisodeId"]),
    currentCheckpointId: stringOrNull(save["currentCheckpointId"]),
    storyFlags: flags(save["storyFlags"]),
    player: {
      maxHealth: positiveNumber(player["maxHealth"], d.player.maxHealth),
      maxStamina: positiveNumber(player["maxStamina"], d.player.maxStamina),
    },
    equipment: {
      mainHand: stringOrNull(equipment["mainHand"]),
      offHand: stringOrNull(equipment["offHand"]),
      ranged: stringOrNull(equipment["ranged"]),
      owned: stringArray(equipment["owned"]),
    },
  };
}

function asObject(v: unknown): RawSave {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as RawSave) : {};
}
function stringOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function positiveNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
}
function flags(v: unknown): Record<string, StoryFlagValue> {
  const out: Record<string, StoryFlagValue> = {};
  for (const [k, value] of Object.entries(asObject(v))) {
    if (typeof value === "boolean" || typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
      out[k] = value;
    }
  }
  return out;
}
