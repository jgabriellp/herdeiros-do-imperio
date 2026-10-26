/**
 * Dica de controles exibida enquanto o mouse não está capturado (pointer lock).
 * Some ao clicar no jogo; volta quando o jogador aperta Esc.
 */
export class ControlsHint {
  private readonly el: HTMLDivElement;
  private readonly onLockChange = (): void => this.refresh();

  constructor(
    parent: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    lines: readonly string[],
  ) {
    this.el = document.createElement("div");
    this.el.className = "hdi-controls-hint";
    Object.assign(this.el.style, {
      position: "absolute",
      left: "50%",
      bottom: "24px",
      transform: "translateX(-50%)",
      padding: "10px 16px",
      borderRadius: "6px",
      background: "rgba(10, 8, 6, 0.6)",
      color: "#f3e9d2",
      font: "14px/1.5 Georgia, 'Times New Roman', serif",
      textAlign: "center",
      pointerEvents: "none",
      whiteSpace: "pre-line",
    } satisfies Partial<CSSStyleDeclaration>);
    this.el.textContent = lines.join("\n");
    parent.appendChild(this.el);

    document.addEventListener("pointerlockchange", this.onLockChange);
    this.refresh();
  }

  private refresh(): void {
    this.el.style.display = document.pointerLockElement === this.canvas ? "none" : "block";
  }

  dispose(): void {
    document.removeEventListener("pointerlockchange", this.onLockChange);
    this.el.remove();
  }
}
