import type {
  EquipmentData,
  PlayerAttributes,
  SaveData,
  SaveProvider,
  StoryFlagValue,
} from "../../shared/types";
import type { GameEvents } from "../core/GameEvents";
import { createDefaultSave } from "./defaultSave";
import { migrateSave } from "./migrateSave";

/**
 * Dono do save em memória. Toda alteração passa por aqui:
 * atualiza o dado, grava pelo SaveProvider e emite "saveChanged".
 */
export class SaveManager {
  private data: SaveData = createDefaultSave();
  /** false quando o save existente é de uma versão mais nova: não sobrescrevemos. */
  private canPersist = true;
  private writeQueue: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(
    private readonly provider: SaveProvider,
    private readonly events: GameEvents,
  ) {}

  get current(): Readonly<SaveData> {
    return this.data;
  }

  async load(): Promise<void> {
    let raw: unknown;
    try {
      raw = await this.provider.load();
    } catch (err) {
      console.error("[SaveManager] falha ao ler o save; começando um novo.", err);
      raw = null;
    }
    if (raw === null) {
      this.data = createDefaultSave();
      return;
    }

    const result = migrateSave(raw);
    if (result.ok) {
      this.data = result.data;
      if (result.migrated) this.persist();
      return;
    }

    this.data = createDefaultSave();
    if (result.reason === "newer-version") {
      // Proteção contra perda de dados: um jogo antigo não apaga um save mais novo.
      this.canPersist = false;
      console.error(`[SaveManager] ${result.detail}. O progresso desta sessão NÃO será salvo.`);
    } else {
      console.error(`[SaveManager] save corrompido (${result.detail}); começando um novo.`);
    }
  }

  setCurrent(episodeId: string, checkpointId: string): void {
    this.mutate((d) => {
      d.currentEpisodeId = episodeId;
      d.currentCheckpointId = checkpointId;
    });
  }

  markEpisodeCompleted(episodeId: string): void {
    if (this.data.completedEpisodes.includes(episodeId)) return;
    this.mutate((d) => d.completedEpisodes.push(episodeId));
  }

  getFlag(key: string): StoryFlagValue | undefined {
    return this.data.storyFlags[key];
  }

  setFlag(key: string, value: StoryFlagValue): void {
    if (this.data.storyFlags[key] === value) return;
    this.mutate((d) => {
      d.storyFlags[key] = value;
    });
  }

  setPlayerAttributes(attrs: Partial<PlayerAttributes>): void {
    this.mutate((d) => Object.assign(d.player, attrs));
  }

  setEquipment(equipment: Partial<EquipmentData>): void {
    this.mutate((d) => Object.assign(d.equipment, equipment));
  }

  /** Aguarda as gravações pendentes. */
  async flush(): Promise<void> {
    await this.writeQueue;
  }

  async dispose(): Promise<void> {
    await this.flush();
    this.disposed = true;
  }

  private mutate(change: (draft: SaveData) => void): void {
    if (this.disposed) return;
    // Trabalha numa cópia para que quem recebeu o save anterior não o veja mudar.
    const draft = structuredClone(this.data);
    change(draft);
    draft.updatedAt = new Date().toISOString();
    this.data = draft;
    this.persist();
    this.events.emit("saveChanged", { save: this.data });
  }

  /** Grava em fila para que gravações assíncronas nunca cheguem fora de ordem. */
  private persist(): void {
    if (!this.canPersist) return;
    const snapshot = this.data;
    this.writeQueue = this.writeQueue
      .then(() => this.provider.save(snapshot))
      .catch((err: unknown) => console.error("[SaveManager] falha ao gravar o save:", err));
  }
}
