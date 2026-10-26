import type { GameEventSource } from "./events";
import type { SaveProvider } from "./save";

export type GameMode = "dev" | "production";

/** Tudo que o motor precisa receber de quem o inicia. O motor não lê URL nem localStorage. */
export interface GameConfig {
  /** Id do episódio, ex.: "s00e00". Deve bater com o id do manifesto. */
  episodeId: string;
  /** URL base da pasta do pacote do episódio (onde está o manifest.json). */
  assetBaseUrl: string;
  saveProvider: SaveProvider;
  mode: GameMode;
  /** Elemento onde o canvas é montado. O canvas acompanha o tamanho dele. */
  container: HTMLElement;
}

/** Retorno de startGame. */
export interface GameHandle {
  events: GameEventSource;
  /** Encerra o jogo e libera todos os recursos. Pode ser chamado mais de uma vez. */
  dispose(): Promise<void>;
}
