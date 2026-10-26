import { GAME_EVENT_NAMES } from "../../shared/types";
import type { GameEvents } from "./GameEvents";

/** Modo dev: registra no console todo evento emitido para fora. */
export function attachDevEventLog(events: GameEvents): void {
  for (const name of GAME_EVENT_NAMES) {
    events.on(name, (payload) => console.info(`[GameEvents] ${name}`, payload));
  }
}
