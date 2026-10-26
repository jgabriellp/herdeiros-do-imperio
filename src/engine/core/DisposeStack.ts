type Cleanup = () => void | Promise<void>;

/**
 * Registra rotinas de limpeza na ordem em que os recursos são criados
 * e as executa na ordem inversa (o último criado é o primeiro liberado).
 */
export class DisposeStack {
  private readonly cleanups: { label: string; fn: Cleanup }[] = [];

  add(label: string, fn: Cleanup): void {
    this.cleanups.push({ label, fn });
  }

  async disposeAll(): Promise<void> {
    while (this.cleanups.length > 0) {
      const { label, fn } = this.cleanups.pop()!;
      try {
        await fn();
      } catch (err) {
        // Continua liberando o resto mesmo se uma etapa falhar.
        console.error(`[dispose] falha ao liberar "${label}":`, err);
      }
    }
  }
}
