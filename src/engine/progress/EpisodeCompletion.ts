import type { GameEvents } from "../core/GameEvents";
import type { SaveManager } from "../save/SaveManager";

/**
 * Regra de conclusão do episódio (por enquanto: derrotar todos os inimigos).
 * Ao concluir: marca no save, emite "episodeCompleted" e avisa quem mostra a mensagem.
 */
export class EpisodeCompletion {
  private done = false;

  constructor(
    private readonly episodeId: string,
    private readonly save: SaveManager,
    private readonly events: GameEvents,
    private readonly onCompleted: () => void,
  ) {}

  get completed(): boolean {
    return this.done;
  }

  update(enemiesSpawned: number, enemiesAlive: number): void {
    // Episódio sem inimigos não conclui por esta regra (precisará de outra condição).
    if (this.done || enemiesSpawned === 0 || enemiesAlive > 0) return;
    this.done = true;
    this.save.markEpisodeCompleted(this.episodeId);
    this.events.emit("episodeCompleted", { episodeId: this.episodeId });
    this.onCompleted();
  }
}
