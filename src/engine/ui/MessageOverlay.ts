export type OverlayKind = "info" | "error";

/** Mensagem em DOM sobre o canvas (erros de carregamento, avisos). */
export class MessageOverlay {
  private readonly el: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "hdi-overlay";
    Object.assign(this.el.style, {
      position: "absolute",
      inset: "0",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "rgba(10, 8, 6, 0.82)",
      color: "#f3e9d2",
      font: "16px/1.5 Georgia, 'Times New Roman', serif",
      textAlign: "center",
      whiteSpace: "pre-line",
      pointerEvents: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    parent.appendChild(this.el);
  }

  show(title: string, detail: string, kind: OverlayKind = "info"): void {
    this.el.replaceChildren();
    const box = document.createElement("div");
    box.style.maxWidth = "640px";

    const h = document.createElement("div");
    h.textContent = title;
    Object.assign(h.style, { fontSize: "22px", marginBottom: "8px", color: kind === "error" ? "#ff9b85" : "#f3d27a" });

    const p = document.createElement("div");
    p.textContent = detail;
    p.style.opacity = "0.85";

    box.append(h, p);
    this.el.appendChild(box);
    this.el.style.display = "flex";
  }

  hide(): void {
    this.el.style.display = "none";
  }

  dispose(): void {
    this.el.remove();
  }
}
