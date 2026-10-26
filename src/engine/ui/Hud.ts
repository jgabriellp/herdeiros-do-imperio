import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import type { Scene } from "@babylonjs/core";

const FONT = "Georgia, 'Times New Roman', serif";
const GOLD = "#f3d27a";
const PARCHMENT = "#f3e9d2";
const HEALTH_COLOR = "#c0392b";
const STAMINA_COLOR = "#7cb342";
/** Stamina insuficiente para esquivar: barra muda de cor para avisar. */
const STAMINA_LOW_COLOR = "#e67e22";

export interface HudPlayerStats {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
}

/** Barra com fundo, moldura e preenchimento proporcional. */
class Bar {
  readonly root: Rectangle;
  private readonly fill: Rectangle;
  private lastRatio = -1;

  constructor(name: string, width: number, height: number, color: string) {
    this.root = new Rectangle(`${name}Bar`);
    this.root.width = `${width}px`;
    this.root.height = `${height}px`;
    this.root.thickness = 2;
    this.root.color = "#e8d9b0";
    this.root.background = "#1a1410cc";
    this.root.cornerRadius = 3;
    this.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

    this.fill = new Rectangle(`${name}Fill`);
    this.fill.thickness = 0;
    this.fill.background = color;
    this.fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.root.addControl(this.fill);
  }

  set(ratio: number, color?: string): void {
    const r = Math.max(0, Math.min(1, ratio));
    if (color && this.fill.background !== color) this.fill.background = color;
    if (Math.abs(r - this.lastRatio) < 0.001) return;
    this.lastRatio = r;
    this.fill.width = `${(r * 100).toFixed(2)}%`;
  }
}

/** Texto que aparece e some sozinho (alpha), com tempos em segundos. */
class FadingText {
  readonly block: TextBlock;
  private remaining = 0;
  private fadeOut = 0.6;

  constructor(name: string, fontSize: number, color: string) {
    this.block = new TextBlock(name, "");
    this.block.fontFamily = FONT;
    this.block.fontSize = fontSize;
    this.block.color = color;
    this.block.outlineWidth = Math.max(3, fontSize / 9);
    this.block.outlineColor = "#000000";
    this.block.alpha = 0;
    this.block.resizeToFit = true;
  }

  show(text: string, seconds: number, fadeOut = 0.6): void {
    this.block.text = text;
    this.remaining = seconds;
    this.fadeOut = fadeOut;
    this.block.alpha = 1;
  }

  /** Mostra até `hide()`. */
  hold(text: string): void {
    this.show(text, Infinity);
  }

  hide(): void {
    this.remaining = 0;
    this.block.alpha = 0;
  }

  update(dt: number): void {
    if (this.remaining === Infinity || this.block.alpha === 0) return;
    this.remaining -= dt;
    this.block.alpha = Math.max(0, Math.min(1, this.remaining / this.fadeOut));
  }
}

/**
 * HUD do jogo com Babylon GUI: vida e stamina do jogador,
 * mensagens centrais (episódio concluído, morte) e avisos curtos (checkpoint).
 */
export class Hud {
  readonly ui: AdvancedDynamicTexture;
  private readonly health: Bar;
  private readonly stamina: Bar;
  private readonly healthText: TextBlock;
  private readonly title: FadingText;
  private readonly subtitle: FadingText;
  private readonly toast: FadingText;
  private readonly veil: Rectangle;
  private veilTarget = 0;

  constructor(scene: Scene, private readonly staminaLowThreshold: number) {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("hud", true, scene);

    // Escurecimento da tela (morte).
    this.veil = new Rectangle("hudVeil");
    this.veil.thickness = 0;
    this.veil.background = "#000000";
    this.veil.alpha = 0;
    this.veil.isHitTestVisible = false;
    this.ui.addControl(this.veil);

    // Barras no canto superior esquerdo.
    const bars = new StackPanel("hudBars");
    bars.isVertical = true;
    bars.width = "280px";
    bars.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    bars.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    bars.left = "24px";
    bars.top = "20px";
    bars.spacing = 6;
    this.ui.addControl(bars);

    this.health = new Bar("health", 260, 20, HEALTH_COLOR);
    this.healthText = new TextBlock("healthText", "");
    this.healthText.fontFamily = FONT;
    this.healthText.fontSize = 13;
    this.healthText.color = PARCHMENT;
    this.health.root.addControl(this.healthText);
    bars.addControl(this.health.root);

    this.stamina = new Bar("stamina", 200, 10, STAMINA_COLOR);
    bars.addControl(this.stamina.root);

    // Mensagens centrais.
    const center = new StackPanel("hudCenter");
    center.isVertical = true;
    center.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    center.top = "-40px";
    this.ui.addControl(center);
    this.title = new FadingText("hudTitle", 54, GOLD);
    this.subtitle = new FadingText("hudSubtitle", 22, PARCHMENT);
    center.addControl(this.title.block);
    center.addControl(this.subtitle.block);

    // Aviso curto no alto da tela.
    this.toast = new FadingText("hudToast", 24, PARCHMENT);
    this.toast.block.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.toast.block.top = "70px";
    this.ui.addControl(this.toast.block);
  }

  /** Mensagem grande no centro por alguns segundos. */
  announce(title: string, subtitle: string, seconds: number): void {
    this.title.show(title, seconds, 1);
    this.subtitle.show(subtitle, seconds, 1);
  }

  notify(text: string, seconds = 2.5): void {
    this.toast.show(text, seconds);
  }

  showDeath(title: string, subtitle: string): void {
    this.title.hold(title);
    this.subtitle.hold(subtitle);
    this.veilTarget = 0.55;
  }

  hideDeath(): void {
    this.title.hide();
    this.subtitle.hide();
    this.veilTarget = 0;
  }

  update(dt: number, stats: HudPlayerStats): void {
    this.health.set(stats.health / stats.maxHealth);
    const text = `${Math.ceil(stats.health)} / ${stats.maxHealth}`;
    if (this.healthText.text !== text) this.healthText.text = text;
    this.stamina.set(
      stats.stamina / stats.maxStamina,
      stats.stamina < this.staminaLowThreshold ? STAMINA_LOW_COLOR : STAMINA_COLOR,
    );

    this.title.update(dt);
    this.subtitle.update(dt);
    this.toast.update(dt);
    // Escurecimento suave (independente de FPS).
    this.veil.alpha += (this.veilTarget - this.veil.alpha) * Math.min(1, dt * 3);
  }

  dispose(): void {
    this.ui.dispose();
  }
}
