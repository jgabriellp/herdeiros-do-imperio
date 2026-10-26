import type { Scene } from "@babylonjs/core";

const TOGGLE_KEY = "F9";

/**
 * Abre/fecha o Inspector do Babylon com F9. Só deve ser criado em modo dev.
 * O pacote é importado sob demanda, então não pesa no carregamento normal.
 */
export class DevInspector {
  private token: { dispose(): Promise<void>; readonly isDisposed: boolean } | null = null;
  private loading = false;
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== TOGGLE_KEY) return;
    e.preventDefault();
    void this.toggle();
  };

  constructor(private readonly scene: Scene) {
    window.addEventListener("keydown", this.onKeyDown);
  }

  private async toggle(): Promise<void> {
    if (this.loading) return;
    if (this.token && !this.token.isDisposed) {
      await this.token.dispose();
      this.token = null;
      return;
    }
    // Builds de produção não incluem o Inspector (~15 MB): o Vite remove este import.
    if (!import.meta.env.DEV) {
      console.warn("[DevInspector] Inspector disponível apenas no servidor de desenvolvimento (npm run dev).");
      return;
    }
    this.loading = true;
    try {
      const { ShowInspector } = await import("@babylonjs/inspector");
      if (this.scene.isDisposed) return;
      this.token = ShowInspector(this.scene);
    } catch (err) {
      console.error("[DevInspector] não foi possível abrir o Inspector:", err);
    } finally {
      this.loading = false;
    }
  }

  async dispose(): Promise<void> {
    window.removeEventListener("keydown", this.onKeyDown);
    if (this.token && !this.token.isDisposed) await this.token.dispose();
    this.token = null;
  }
}
