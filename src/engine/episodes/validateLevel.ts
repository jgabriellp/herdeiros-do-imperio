import type { ObstacleDef, PickupDef, ProceduralLevelData } from "../../shared/types";
import { Checker } from "./Checker";
import { EpisodeValidationError } from "./EpisodeErrors";

const POSITIVE = { positive: true } as const;

/** Valida o level.json de uma fase do tipo "procedural". */
export function validateProceduralLevel(raw: unknown, file: string): ProceduralLevelData {
  const c = new Checker();
  const root = c.object(raw, file);
  const p = file;

  c.literal(root, "formatVersion", p, [1]);

  const ground = c.object(root["ground"], `${p}.ground`);
  const sky = c.object(root["sky"], `${p}.sky`);
  const lighting = c.object(root["lighting"], `${p}.lighting`);

  const level: ProceduralLevelData = {
    formatVersion: 1,
    ground: {
      width: c.num(ground, "width", `${p}.ground`, POSITIVE),
      depth: c.num(ground, "depth", `${p}.ground`, POSITIVE),
      color: c.color(ground, "color", `${p}.ground`),
    },
    sky: {
      topColor: c.color(sky, "topColor", `${p}.sky`),
      horizonColor: c.color(sky, "horizonColor", `${p}.sky`),
    },
    lighting: {
      sunDirection: c.vec3(lighting, "sunDirection", `${p}.lighting`),
      sunIntensity: c.num(lighting, "sunIntensity", `${p}.lighting`, { min: 0 }),
      ambientIntensity: c.num(lighting, "ambientIntensity", `${p}.lighting`, { min: 0 }),
    },
    obstacles: c.array(root, "obstacles", p, (v, ip) => readObstacle(c, v, ip)),
  };

  const pickups = c.optArray(root, "pickups", p, (v, ip) => readPickup(c, v, ip));
  if (pickups !== undefined) {
    level.pickups = pickups;
    const seen = new Set<string>();
    for (const pk of pickups) {
      if (pk.id && seen.has(pk.id)) c.fail(`${p}.pickups`, `id de item repetido "${pk.id}"`);
      seen.add(pk.id);
    }
  }

  const sun = level.lighting.sunDirection;
  if (sun.x === 0 && sun.y === 0 && sun.z === 0) {
    c.fail(`${p}.lighting.sunDirection`, "não pode ser (0, 0, 0)");
  }

  if (c.errors.length > 0) throw new EpisodeValidationError(file, c.errors);
  return level;
}

function readPickup(c: Checker, value: unknown, path: string): PickupDef {
  const o = c.object(value, path);
  return { id: c.str(o, "id", path), item: c.str(o, "item", path), position: c.vec3(o, "position", path) };
}

function readObstacle(c: Checker, value: unknown, path: string): ObstacleDef {
  const o = c.object(value, path);
  const shape = c.literal(o, "shape", path, ["box", "cylinder"] as const);
  const position = c.vec3(o, "position", path);
  const color = c.optColor(o, "color", path);
  const mass = c.optNum(o, "mass", path, { min: 0 });

  const base = {
    position,
    ...(color !== undefined && { color }),
    ...(mass !== undefined && { mass }),
  };

  if (shape === "cylinder") {
    return {
      shape,
      ...base,
      diameter: c.num(o, "diameter", path, POSITIVE),
      height: c.num(o, "height", path, POSITIVE),
    };
  }

  const size = c.vec3(o, "size", path);
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) c.fail(`${path}.size`, "todas as dimensões devem ser > 0");
  const rotationY = c.optNum(o, "rotationY", path);
  return { shape, ...base, size, ...(rotationY !== undefined && { rotationY }) };
}
