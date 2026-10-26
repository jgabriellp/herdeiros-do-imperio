import { GameError } from "../core/GameError";

/** Arquivo do pacote com um ou mais campos inválidos. */
export class EpisodeValidationError extends GameError {
  readonly file: string;
  readonly problems: readonly string[];

  constructor(file: string, problems: readonly string[]) {
    super("INVALID_EPISODE", `${file} inválido:\n  - ${problems.join("\n  - ")}`);
    this.name = "EpisodeValidationError";
    this.file = file;
    this.problems = problems;
  }
}
