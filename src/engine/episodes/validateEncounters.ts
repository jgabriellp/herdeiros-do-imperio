import type { EncountersData, EnemySpawnDef } from "../../shared/types";
import { Checker } from "./Checker";
import { EpisodeValidationError } from "./EpisodeErrors";

/** Valida o encounters.json. */
export function validateEncounters(raw: unknown, file: string): EncountersData {
  const c = new Checker();
  const root = c.object(raw, file);

  c.literal(root, "formatVersion", file, [1]);
  const enemies = c.array(root, "enemies", file, (v, ip) => readEnemy(c, v, ip));

  const seen = new Set<string>();
  for (const e of enemies) {
    if (e.id && seen.has(e.id)) c.fail(`${file}.enemies`, `id de inimigo repetido "${e.id}"`);
    seen.add(e.id);
  }

  if (c.errors.length > 0) throw new EpisodeValidationError(file, c.errors);
  return { formatVersion: 1, enemies };
}

function readEnemy(c: Checker, value: unknown, path: string): EnemySpawnDef {
  const o = c.object(value, path);
  const stats = c.object(o["stats"], `${path}.stats`);
  const sp = `${path}.stats`;
  const facing = c.optNum(o, "facing", path);
  return {
    ...(facing !== undefined && { facing }),
    id: c.str(o, "id", path),
    type: c.str(o, "type", path),
    position: c.vec3(o, "position", path),
    stats: {
      health: c.num(stats, "health", sp, { positive: true }),
      damage: c.num(stats, "damage", sp, { min: 0 }),
      speed: c.num(stats, "speed", sp, { min: 0 }),
    },
  };
}
