/**
 * Modo dev: atalhos de teste (ex.: F7 hitboxes, F8 simular golpe).
 * Ouvidos na janela, como o F9 do Inspector.
 */
export class DevHotkeys {
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const action = this.actions.get(e.code);
    if (!action) return;
    e.preventDefault();
    action();
  };

  constructor(private readonly actions: Map<string, () => void>) {
    window.addEventListener("keydown", this.onKeyDown);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
  }
}
