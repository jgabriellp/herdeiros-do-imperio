import type { HexColor, Vec3Data } from "../../shared/types";

export type JsonObject = Record<string, unknown>;

interface NumberRules {
  min?: number;
  /** Exige valor > 0. */
  positive?: boolean;
  integer?: boolean;
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value === undefined) return "ausente";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return typeof value;
}

/**
 * Leitor de JSON que acumula erros com o caminho do campo
 * (ex.: "checkpoints[0].position.x: esperado número, recebido string").
 * Em caso de erro, devolve valores neutros para a validação continuar
 * e listar todos os problemas de uma vez.
 */
export class Checker {
  readonly errors: string[] = [];

  fail(path: string, message: string): void {
    this.errors.push(`${path}: ${message}`);
  }

  object(value: unknown, path: string): JsonObject {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as JsonObject;
    }
    this.fail(path, `esperado objeto, recebido ${describe(value)}`);
    return {};
  }

  str(obj: JsonObject, key: string, path: string, pattern?: { re: RegExp; hint: string }): string {
    const value = obj[key];
    if (typeof value !== "string" || value.length === 0) {
      this.fail(`${path}.${key}`, `esperado texto não vazio, recebido ${describe(value)}`);
      return "";
    }
    if (pattern && !pattern.re.test(value)) {
      this.fail(`${path}.${key}`, `formato inválido "${value}" (esperado ${pattern.hint})`);
    }
    return value;
  }

  optStr(obj: JsonObject, key: string, path: string): string | undefined {
    return obj[key] === undefined ? undefined : this.str(obj, key, path);
  }

  num(obj: JsonObject, key: string, path: string, rules: NumberRules = {}): number {
    const value = obj[key];
    const full = `${path}.${key}`;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      this.fail(full, `esperado número, recebido ${describe(value)}`);
      return 0;
    }
    if (rules.integer && !Number.isInteger(value)) this.fail(full, `esperado inteiro, recebido ${value}`);
    if (rules.positive && value <= 0) this.fail(full, `esperado valor > 0, recebido ${value}`);
    if (rules.min !== undefined && value < rules.min) {
      this.fail(full, `esperado valor >= ${rules.min}, recebido ${value}`);
    }
    return value;
  }

  optNum(obj: JsonObject, key: string, path: string, rules: NumberRules = {}): number | undefined {
    return obj[key] === undefined ? undefined : this.num(obj, key, path, rules);
  }

  literal<T extends string | number>(obj: JsonObject, key: string, path: string, allowed: readonly T[]): T {
    const value = obj[key];
    if (!allowed.includes(value as T)) {
      const list = allowed.map((a) => JSON.stringify(a)).join(", ");
      this.fail(`${path}.${key}`, `esperado um de [${list}], recebido ${describe(value)}`);
      return allowed[0]!;
    }
    return value as T;
  }

  vec3(obj: JsonObject, key: string, path: string): Vec3Data {
    const o = this.object(obj[key], `${path}.${key}`);
    const p = `${path}.${key}`;
    return { x: this.num(o, "x", p), y: this.num(o, "y", p), z: this.num(o, "z", p) };
  }

  color(obj: JsonObject, key: string, path: string): HexColor {
    return this.str(obj, key, path, { re: /^#[0-9a-fA-F]{6}$/, hint: '"#rrggbb"' });
  }

  optColor(obj: JsonObject, key: string, path: string): HexColor | undefined {
    return obj[key] === undefined ? undefined : this.color(obj, key, path);
  }

  array<T>(obj: JsonObject, key: string, path: string, item: (value: unknown, itemPath: string) => T): T[] {
    const value = obj[key];
    if (!Array.isArray(value)) {
      this.fail(`${path}.${key}`, `esperado lista, recebido ${describe(value)}`);
      return [];
    }
    return value.map((v, i) => item(v, `${path}.${key}[${i}]`));
  }

  optArray<T>(
    obj: JsonObject,
    key: string,
    path: string,
    item: (value: unknown, itemPath: string) => T,
  ): T[] | undefined {
    return obj[key] === undefined ? undefined : this.array(obj, key, path, item);
  }

  /** Caminho relativo seguro dentro do pacote (sem "/", "..", nem URL absoluta). */
  relativePath(obj: JsonObject, key: string, path: string): string {
    const value = this.str(obj, key, path);
    if (value && (/^[a-z]+:/i.test(value) || value.startsWith("/") || value.split("/").includes(".."))) {
      this.fail(`${path}.${key}`, `"${value}" deve ser um caminho relativo dentro da pasta do episódio`);
    }
    return value;
  }

  optRelativePath(obj: JsonObject, key: string, path: string): string | undefined {
    return obj[key] === undefined ? undefined : this.relativePath(obj, key, path);
  }

  /** Avisa sobre chaves desconhecidas (provável erro de digitação), sem invalidar. */
  warnUnknownKeys(obj: JsonObject, path: string, known: readonly string[], warnings: string[]): void {
    for (const key of Object.keys(obj)) {
      if (!known.includes(key)) warnings.push(`${path}.${key}: campo desconhecido, será ignorado`);
    }
  }
}
