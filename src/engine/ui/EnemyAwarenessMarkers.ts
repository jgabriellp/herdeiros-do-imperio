import { TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import type { TransformNode } from "@babylonjs/core";

/** O que o indicador precisa saber de um inimigo. */
export interface AwarenessSubject {
  readonly isAlive: boolean;
  readonly awareness: "unaware" | "suspicious" | "alert";
  /** Medidor de certeza 0..1 (desprevenido começando a notar algo). */
  readonly perception: { readonly meter: number };
  readonly alertAge: number;
  readonly headAnchor: TransformNode;
}

/** "!" aparece por este tempo ao entrar em alerta. */
const ALERT_SHOW_TIME = 1.6;
/** Acima da barra de vida. */
const OFFSET_Y = -26;
const SUSPICIOUS_COLOR = "#f3d27a";
const ALERT_COLOR = "#ff5a3c";

/**
 * Indicadores de consciência sobre a cabeça dos inimigos:
 * - "?" fraco crescendo: está começando a notar algo;
 * - "?" amarelo: desconfiado, investigando;
 * - "!" vermelho: acabou de descobrir o jogador (some depois de um instante).
 */
export class EnemyAwarenessMarkers {
  private readonly markers = new Map<AwarenessSubject, TextBlock>();

  constructor(private readonly ui: AdvancedDynamicTexture) {}

  update(subjects: readonly AwarenessSubject[]): void {
    for (const [subject, text] of this.markers) {
      if (!subjects.includes(subject)) this.remove(subject, text);
    }
    for (const s of subjects) {
      const text = this.markers.get(s) ?? this.create(s);
      if (!s.isAlive) {
        text.isVisible = false;
        continue;
      }
      if (s.awareness === "alert") {
        text.isVisible = s.alertAge < ALERT_SHOW_TIME;
        text.text = "!";
        text.color = ALERT_COLOR;
        text.alpha = 1;
      } else if (s.awareness === "suspicious") {
        text.isVisible = true;
        text.text = "?";
        text.color = SUSPICIOUS_COLOR;
        text.alpha = 1;
      } else {
        // Desprevenido notando algo: "?" esmaecido que cresce com o medidor.
        const m = s.perception.meter;
        text.isVisible = m > 0.05;
        text.text = "?";
        text.color = SUSPICIOUS_COLOR;
        text.alpha = Math.min(1, 0.25 + m * 1.5);
      }
    }
  }

  dispose(): void {
    for (const [subject, text] of this.markers) this.remove(subject, text);
  }

  private create(subject: AwarenessSubject): TextBlock {
    const text = new TextBlock("awarenessMarker", "?");
    text.fontFamily = "Georgia, 'Times New Roman', serif";
    text.fontSize = 30;
    text.fontWeight = "bold";
    text.outlineWidth = 5;
    text.outlineColor = "#000000";
    text.width = "40px";
    text.height = "40px";
    text.isHitTestVisible = false;
    text.isVisible = false;
    this.ui.addControl(text);
    text.linkWithMesh(subject.headAnchor);
    text.linkOffsetY = OFFSET_Y;
    this.markers.set(subject, text);
    return text;
  }

  private remove(subject: AwarenessSubject, text: TextBlock): void {
    text.linkWithMesh(null);
    this.ui.removeControl(text);
    text.dispose();
    this.markers.delete(subject);
  }
}
