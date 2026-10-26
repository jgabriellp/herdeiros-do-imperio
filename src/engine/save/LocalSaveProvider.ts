import type { SaveData, SaveProvider } from "../../shared/types";

const DEFAULT_KEY = "herdeiros-do-imperio:save";

/**
 * Save no localStorage. Se o armazenamento falhar (modo privado, cota, bloqueio),
 * o jogo continua usando uma cópia em memória durante a sessão.
 */
export class LocalSaveProvider implements SaveProvider {
  private memoryFallback: string | null = null;
  private storageBroken = false;

  constructor(private readonly key: string = DEFAULT_KEY) {}

  async load(): Promise<unknown | null> {
    const text = this.read();
    if (text === null) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      console.warn("[LocalSaveProvider] save salvo não é JSON válido; ignorando.");
      return null;
    }
  }

  async save(data: SaveData): Promise<void> {
    const text = JSON.stringify(data);
    this.memoryFallback = text;
    if (this.storageBroken) return;
    try {
      localStorage.setItem(this.key, text);
    } catch (err) {
      this.markBroken(err);
    }
  }

  async clear(): Promise<void> {
    this.memoryFallback = null;
    try {
      localStorage.removeItem(this.key);
    } catch (err) {
      this.markBroken(err);
    }
  }

  private read(): string | null {
    if (this.storageBroken) return this.memoryFallback;
    try {
      return localStorage.getItem(this.key) ?? this.memoryFallback;
    } catch (err) {
      this.markBroken(err);
      return this.memoryFallback;
    }
  }

  private markBroken(err: unknown): void {
    if (!this.storageBroken) {
      console.warn("[LocalSaveProvider] localStorage indisponível; o progresso fica só nesta sessão.", err);
    }
    this.storageBroken = true;
  }
}
