import type { ButtonAction, InputFrame, InputSource } from "./InputTypes";

function emptyFrame(): InputFrame {
  return { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, zoom: 0, buttons: new Set() };
}

/**
 * Junta todas as fontes de input num único quadro por frame e oferece
 * consultas no vocabulário do jogo (ações), não de teclas.
 * Deve rodar na fase "input" do GameLoop, antes de quem consome.
 */
export class InputManager {
  private current = emptyFrame();
  private previous = emptyFrame();
  private readonly sources: InputSource[] = [];

  addSource(source: InputSource): void {
    this.sources.push(source);
  }

  update(dt: number): void {
    // Reaproveita os objetos para não gerar lixo a cada quadro.
    const frame = this.previous;
    this.previous = this.current;
    this.current = frame;
    frame.move.x = frame.move.y = frame.look.x = frame.look.y = frame.zoom = 0;
    frame.buttons.clear();

    for (const source of this.sources) source.contribute(frame, dt);

    // Diagonal no teclado não pode ser mais rápida que reto; analógico parcial é preservado.
    const len = Math.hypot(frame.move.x, frame.move.y);
    if (len > 1) {
      frame.move.x /= len;
      frame.move.y /= len;
    }
  }

  /** Eixo de movimento: x = direita, y = frente, comprimento <= 1. */
  get move(): Readonly<{ x: number; y: number }> {
    return this.current.move;
  }

  /** Rotação de câmera deste quadro, em radianos. */
  get look(): Readonly<{ x: number; y: number }> {
    return this.current.look;
  }

  get zoom(): number {
    return this.current.zoom;
  }

  isDown(action: ButtonAction): boolean {
    return this.current.buttons.has(action);
  }

  /** Verdadeiro só no quadro em que o botão foi apertado. */
  wasPressed(action: ButtonAction): boolean {
    return this.current.buttons.has(action) && !this.previous.buttons.has(action);
  }

  wasReleased(action: ButtonAction): boolean {
    return !this.current.buttons.has(action) && this.previous.buttons.has(action);
  }

  dispose(): void {
    for (const source of this.sources) source.dispose();
    this.sources.length = 0;
  }
}
