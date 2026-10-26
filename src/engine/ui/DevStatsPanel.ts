/**
 * Modo dev: painel de texto com estado do jogador, vida, stamina e alvo.
 * Fica no canto superior direito (o HUD do jogo ocupa o esquerdo).
 */
export class DevStatsPanel {
  private readonly el: HTMLPreElement;
  private lastText = "";

  constructor(parent: HTMLElement) {
    this.el = document.createElement("pre");
    this.el.className = "hdi-dev-stats";
    Object.assign(this.el.style, {
      position: "absolute",
      top: "8px",
      right: "8px",
      margin: "0",
      padding: "6px 10px",
      borderRadius: "4px",
      background: "rgba(0, 0, 0, 0.55)",
      color: "#d8f0c8",
      font: "12px/1.4 Consolas, monospace",
      pointerEvents: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    parent.appendChild(this.el);
  }

  /** Só mexe no DOM quando o texto muda. */
  show(lines: readonly string[]): void {
    const text = lines.join("\n");
    if (text === this.lastText) return;
    this.lastText = text;
    this.el.textContent = text;
  }

  dispose(): void {
    this.el.remove();
  }
}
