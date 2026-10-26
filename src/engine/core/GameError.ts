import type { FatalErrorCode } from "../../shared/types";

/** Erro com código, convertido no evento "fatalError". */
export class GameError extends Error {
  readonly code: FatalErrorCode;

  constructor(code: FatalErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GameError";
    this.code = code;
  }
}
