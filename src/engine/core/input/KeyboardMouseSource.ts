import type { InputSettings, KeyboardMouseBindings } from "./InputBindings";
import type { ButtonAction, InputFrame, InputSource } from "./InputTypes";

/**
 * Teclado + mouse. Os eventos de teclado são ouvidos no canvas (não na janela),
 * para não capturar digitação em outras partes da página da plataforma.
 * Clique no canvas ativa o pointer lock; Esc (do navegador) solta.
 */
export class KeyboardMouseSource implements InputSource {
  private readonly keysDown = new Set<string>();
  /** Teclas apertadas desde o último quadro, mesmo que já soltas (toques rápidos não se perdem). */
  private readonly keysTapped = new Set<string>();
  private readonly boundCodes: Set<string>;
  private lookX = 0;
  private lookY = 0;
  private zoomSteps = 0;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.boundCodes.has(e.code)) return;
    e.preventDefault(); // evita rolagem da página com Espaço/setas
    this.keysDown.add(e.code);
    this.keysTapped.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };
  private readonly onBlur = (): void => this.reset();
  private readonly onMouseDown = (): void => {
    this.canvas.focus();
    if (!this.isLocked) this.requestLock();
  };
  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.isLocked) return;
    this.lookX += e.movementX;
    this.lookY += e.movementY;
  };
  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.zoomSteps += Math.sign(e.deltaY);
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly bindings: KeyboardMouseBindings,
    private readonly settings: InputSettings,
  ) {
    this.boundCodes = new Set([
      ...bindings.forward,
      ...bindings.back,
      ...bindings.left,
      ...bindings.right,
      ...Object.values(bindings.buttons).flat(),
    ]);
    canvas.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("blur", this.onBlur);
    canvas.addEventListener("mousedown", this.onMouseDown);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    document.addEventListener("mousemove", this.onMouseMove);
  }

  get isLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  contribute(frame: InputFrame): void {
    frame.move.x += this.axis(this.bindings.right) - this.axis(this.bindings.left);
    frame.move.y += this.axis(this.bindings.forward) - this.axis(this.bindings.back);

    const s = this.settings.mouseSensitivity;
    frame.look.x += this.lookX * s;
    frame.look.y += this.lookY * s * (this.settings.invertY ? -1 : 1);
    frame.zoom += this.zoomSteps;
    this.lookX = this.lookY = this.zoomSteps = 0;

    for (const [action, codes] of Object.entries(this.bindings.buttons) as [ButtonAction, string[]][]) {
      if (codes.some((c) => this.keysDown.has(c) || this.keysTapped.has(c))) frame.buttons.add(action);
    }
    this.keysTapped.clear();
  }

  reset(): void {
    this.keysDown.clear();
    this.keysTapped.clear();
    this.lookX = this.lookY = this.zoomSteps = 0;
  }

  dispose(): void {
    this.canvas.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("mousemove", this.onMouseMove);
    if (this.isLocked) document.exitPointerLock();
    this.reset();
  }

  private axis(codes: string[]): number {
    return codes.some((c) => this.keysDown.has(c)) ? 1 : 0;
  }

  private requestLock(): void {
    try {
      // Pode ser rejeitado (ex.: logo após Esc o navegador exige um intervalo).
      Promise.resolve(this.canvas.requestPointerLock()).catch(() => undefined);
    } catch {
      // Navegadores antigos lançam de forma síncrona; o jogo segue sem lock.
    }
  }
}
