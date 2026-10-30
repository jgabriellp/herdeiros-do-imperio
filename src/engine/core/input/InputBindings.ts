import type { ButtonAction } from "./InputTypes";

/**
 * Teclas usam KeyboardEvent.code (posição física: funciona em qualquer layout).
 * Botões do mouse: "MouseLeft", "MouseMiddle", "MouseRight".
 * Evite Ctrl: Ctrl+W/T/N são atalhos do navegador que a página não consegue bloquear.
 */
export interface KeyboardMouseBindings {
  forward: string[];
  back: string[];
  left: string[];
  right: string[];
  buttons: Record<ButtonAction, string[]>;
}

export const DEFAULT_KEYBOARD_MOUSE_BINDINGS: KeyboardMouseBindings = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  buttons: {
    jump: ["Space"],
    run: ["ShiftLeft", "ShiftRight"],
    attack: ["MouseLeft"],
    kick: ["KeyF"],
    dodge: ["KeyC"],
    lockOn: ["KeyQ", "MouseMiddle"],
    // Botão direito: bloquear (com escudo) ou mirar (com arco), conforme a arma na mão.
    block: ["MouseRight"],
    aim: ["MouseRight"],
    weaponUnarmed: ["Digit1"],
    weaponArmed: ["Digit2"],
    weaponBow: ["Digit3"],
    // Alterna agachado/em pé (não segura). Ctrl não serve: Ctrl+W fecha a aba.
    crouch: ["KeyV"],
  },
};

export interface InputSettings {
  /** Radianos por pixel de movimento do mouse. */
  mouseSensitivity: number;
  invertY: boolean;
}

export const DEFAULT_INPUT_SETTINGS: InputSettings = {
  mouseSensitivity: 0.0024,
  invertY: false,
};
