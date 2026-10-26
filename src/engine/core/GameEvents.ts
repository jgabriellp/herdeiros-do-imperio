import type {
  GameEventListener,
  GameEventMap,
  GameEventName,
  GameEventSource,
} from "../../shared/types";

/** Emissor de eventos tipado. Para fora, só o lado GameEventSource é exposto. */
export class GameEvents implements GameEventSource {
  private readonly listeners = new Map<GameEventName, Set<GameEventListener<never>>>();

  on<K extends GameEventName>(name: K, listener: GameEventListener<K>): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(listener as GameEventListener<never>);
    return () => this.off(name, listener);
  }

  off<K extends GameEventName>(name: K, listener: GameEventListener<K>): void {
    this.listeners.get(name)?.delete(listener as GameEventListener<never>);
  }

  emit<K extends GameEventName>(name: K, payload: GameEventMap[K]): void {
    const set = this.listeners.get(name);
    if (!set) return;
    // Copia para permitir que um listener se desinscreva durante o emit.
    for (const listener of [...set]) {
      try {
        (listener as GameEventListener<K>)(payload);
      } catch (err) {
        // Um listener externo com erro não pode derrubar o motor.
        console.error(`[GameEvents] erro em listener de "${name}":`, err);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
