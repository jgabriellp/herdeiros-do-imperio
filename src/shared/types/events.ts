import type { SaveData } from "./save";

export type FatalErrorCode =
  | "EPISODE_NOT_FOUND"
  | "INVALID_EPISODE"
  | "EPISODE_EMPTY"
  | "ENGINE_INIT"
  | "UNKNOWN";

/** Eventos que o motor emite para fora (plataforma, main.ts). */
export interface GameEventMap {
  episodeLoaded: { episodeId: string; title: string; version: string };
  checkpointReached: { episodeId: string; checkpointId: string };
  saveChanged: { save: Readonly<SaveData> };
  episodeCompleted: { episodeId: string };
  fatalError: { code: FatalErrorCode; message: string };
}

export type GameEventName = keyof GameEventMap;

export const GAME_EVENT_NAMES: readonly GameEventName[] = [
  "episodeLoaded",
  "checkpointReached",
  "saveChanged",
  "episodeCompleted",
  "fatalError",
];

export type GameEventListener<K extends GameEventName> = (payload: GameEventMap[K]) => void;

/** Lado "somente escuta" do emissor, exposto a quem está fora do motor. */
export interface GameEventSource {
  /** Retorna uma função que cancela a inscrição. */
  on<K extends GameEventName>(name: K, listener: GameEventListener<K>): () => void;
  off<K extends GameEventName>(name: K, listener: GameEventListener<K>): void;
}
