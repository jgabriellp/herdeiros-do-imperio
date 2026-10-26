/**
 * Cria o canvas dentro do container e o mantém do tamanho do container
 * (não da janela: na plataforma o jogo pode não ocupar a tela inteira).
 */
export class CanvasHost {
  /** Raiz do jogo dentro do container; overlays de DOM são filhos dela. */
  readonly root: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  private readonly observer: ResizeObserver;
  private resizeHandler: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hdi-root";
    Object.assign(this.root.style, { position: "relative", width: "100%", height: "100%", overflow: "hidden" });

    this.canvas = document.createElement("canvas");
    this.canvas.className = "hdi-canvas";
    Object.assign(this.canvas.style, { width: "100%", height: "100%", display: "block", outline: "none" });
    // Necessário para o canvas receber foco e eventos de teclado.
    this.canvas.tabIndex = 0;

    this.root.appendChild(this.canvas);
    container.appendChild(this.root);

    this.observer = new ResizeObserver(() => this.resizeHandler?.());
    this.observer.observe(container);
  }

  /** Registra quem deve reagir ao redimensionamento (ex.: engine.resize). */
  onResize(handler: () => void): void {
    this.resizeHandler = handler;
  }

  dispose(): void {
    this.observer.disconnect();
    this.resizeHandler = null;
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    this.root.remove();
  }
}
