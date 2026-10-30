/** Ações de botão do jogo. Novas ações (ataque, esquiva...) entram aqui. */
export type ButtonAction =
  | "jump"
  | "run"
  | "attack"
  | "kick"
  | "dodge"
  | "lockOn"
  | "block"
  | "aim"
  | "weaponUnarmed"
  | "weaponArmed"
  | "weaponBow";

/**
 * O que todas as fontes de input produzem a cada quadro, já em unidades do jogo.
 * Isso permite somar teclado+mouse e gamepad sem que o resto do jogo saiba a origem.
 */
export interface InputFrame {
  /** Movimento desejado: x = direita, y = frente. Componentes em [-1, 1]. */
  move: { x: number; y: number };
  /** Rotação de câmera NESTE quadro, em radianos (x = yaw, y = pitch; +y = olhar para baixo). */
  look: { x: number; y: number };
  /** Zoom de câmera neste quadro, em "passos" (+ = afastar). */
  zoom: number;
  /** Ações cujo botão está pressionado. */
  buttons: Set<ButtonAction>;
}

/**
 * Um dispositivo de entrada (teclado+mouse hoje; gamepad depois).
 * Para suportar gamepad: criar GamepadSource implementando esta interface
 * e registrá-la no InputManager. Nada mais precisa mudar.
 */
export interface InputSource {
  /** Acrescenta a contribuição deste dispositivo ao quadro (soma eixos, une botões). */
  contribute(frame: InputFrame, dt: number): void;
  /** Solta tudo (ex.: ao perder o foco). */
  reset(): void;
  dispose(): void;
}
