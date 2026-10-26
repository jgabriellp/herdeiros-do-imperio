import type { GameConfig, GameHandle } from "../shared/types";
import { attachDevEventLog } from "./core/devEventLog";
import { Game } from "./core/Game";
import { GameEvents } from "./core/GameEvents";

/**
 * Ponto de entrada único do motor.
 *
 * Retorna imediatamente; o carregamento continua em segundo plano.
 * Todos os eventos (inclusive "episodeLoaded" e "fatalError") são emitidos
 * depois deste retorno, então quem chamou pode se inscrever com segurança.
 */
export function startGame(config: GameConfig): GameHandle {
  const events = new GameEvents();
  if (config.mode === "dev") attachDevEventLog(events);

  const game = new Game(config, events);
  void game.start();

  return {
    // Só o lado de escuta: quem está fora não emite eventos do motor.
    events: {
      on: (name, listener) => events.on(name, listener),
      off: (name, listener) => events.off(name, listener),
    },
    dispose: () => game.dispose(),
  };
}
