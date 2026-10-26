import {
  MANIFEST_FORMAT_VERSION,
  type CheckpointDef,
  type EpisodeManifest,
  type LevelRef,
  type LevelType,
} from "../../shared/types";
import { Checker } from "./Checker";
import { EpisodeValidationError } from "./EpisodeErrors";

const EPISODE_ID = { re: /^s\d{2}e\d{2}$/, hint: '"sTTeEE", ex.: "s01e01"' };
const SEMVER = { re: /^\d+\.\d+\.\d+$/, hint: 'semver, ex.: "0.1.0"' };
const LEVEL_TYPES: readonly LevelType[] = ["procedural"];
const KNOWN_KEYS = [
  "formatVersion", "id", "season", "episode", "title", "description", "version",
  "requires", "spawnPoint", "level", "encounters", "checkpoints",
] as const;

const FILE = "manifest.json";

/** Valida o manifest.json. Lança EpisodeValidationError listando todos os problemas. */
export function validateManifest(raw: unknown, warnings: string[]): EpisodeManifest {
  const c = new Checker();
  const root = c.object(raw, FILE);
  const p = FILE;

  c.literal(root, "formatVersion", p, [MANIFEST_FORMAT_VERSION]);
  c.warnUnknownKeys(root, p, KNOWN_KEYS, warnings);

  const manifest: EpisodeManifest = {
    formatVersion: MANIFEST_FORMAT_VERSION,
    id: c.str(root, "id", p, EPISODE_ID),
    season: c.num(root, "season", p, { integer: true, min: 0 }),
    episode: c.num(root, "episode", p, { integer: true, min: 0 }),
    title: c.str(root, "title", p),
    version: c.str(root, "version", p, SEMVER),
    spawnPoint: c.vec3(root, "spawnPoint", p),
    checkpoints: c.array(root, "checkpoints", p, (v, ip) => readCheckpoint(c, v, ip)),
  };

  const description = c.optStr(root, "description", p);
  if (description !== undefined) manifest.description = description;

  const requires = c.optArray(root, "requires", p, (v, ip) => {
    if (typeof v !== "string" || !EPISODE_ID.re.test(v)) c.fail(ip, `esperado id de episódio ${EPISODE_ID.hint}`);
    return String(v);
  });
  if (requires !== undefined) manifest.requires = requires;

  if (root["level"] !== undefined) manifest.level = readLevelRef(c, root["level"], `${p}.level`);

  const encounters = c.optRelativePath(root, "encounters", p);
  if (encounters !== undefined) manifest.encounters = encounters;

  checkConsistency(c, manifest);

  if (c.errors.length > 0) throw new EpisodeValidationError(FILE, c.errors);
  return manifest;
}

function readCheckpoint(c: Checker, value: unknown, path: string): CheckpointDef {
  const o = c.object(value, path);
  return { id: c.str(o, "id", path), position: c.vec3(o, "position", path) };
}

function readLevelRef(c: Checker, value: unknown, path: string): LevelRef {
  const o = c.object(value, path);
  return { type: c.literal(o, "type", path, LEVEL_TYPES), file: c.relativePath(o, "file", path) };
}

function checkConsistency(c: Checker, m: EpisodeManifest): void {
  const seen = new Set<string>();
  for (const cp of m.checkpoints) {
    if (cp.id && seen.has(cp.id)) c.fail(`${FILE}.checkpoints`, `id de checkpoint repetido "${cp.id}"`);
    seen.add(cp.id);
  }
  if (m.checkpoints.length === 0) c.fail(`${FILE}.checkpoints`, "deve ter pelo menos um checkpoint");

  // O id precisa bater com temporada/episódio para evitar pacotes trocados.
  const expectedId = `s${String(m.season).padStart(2, "0")}e${String(m.episode).padStart(2, "0")}`;
  if (m.id && EPISODE_ID.re.test(m.id) && m.id !== expectedId) {
    c.fail(`${FILE}.id`, `"${m.id}" não corresponde a season=${m.season}, episode=${m.episode} (esperado "${expectedId}")`);
  }
  if (m.requires?.includes(m.id)) c.fail(`${FILE}.requires`, "o episódio não pode exigir a si mesmo");
}
