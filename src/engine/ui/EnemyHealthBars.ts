import { Control, Rectangle, type AdvancedDynamicTexture } from "@babylonjs/gui";
import type { TransformNode } from "@babylonjs/core";

/** O que a barra flutuante precisa saber de um inimigo. */
export interface HealthBarSubject {
  readonly isAlive: boolean;
  readonly isEngaged: boolean;
  readonly currentHealth: number;
  readonly maxHealth: number;
  readonly headAnchor: TransformNode;
}

const WIDTH = 64;
const HEIGHT = 8;

interface BarControls {
  root: Rectangle;
  fill: Rectangle;
  lastRatio: number;
}

/**
 * Barras de vida flutuando sobre os inimigos (Babylon GUI ligada a um nó 3D).
 * Aparecem quando o inimigo está lutando ou ferido; somem ao morrer.
 */
export class EnemyHealthBars {
  private readonly bars = new Map<HealthBarSubject, BarControls>();

  constructor(private readonly ui: AdvancedDynamicTexture) {}

  /** Sincroniza com a lista atual de inimigos (cria/remove barras conforme preciso). */
  update(subjects: readonly HealthBarSubject[]): void {
    for (const [subject, bar] of this.bars) {
      if (!subjects.includes(subject)) this.remove(subject, bar);
    }
    for (const subject of subjects) {
      const bar = this.bars.get(subject) ?? this.create(subject);
      const visible = subject.isAlive && (subject.isEngaged || subject.currentHealth < subject.maxHealth);
      bar.root.isVisible = visible;
      if (!visible) continue;
      const ratio = Math.max(0, subject.currentHealth / subject.maxHealth);
      if (ratio !== bar.lastRatio) {
        bar.lastRatio = ratio;
        bar.fill.width = `${(ratio * 100).toFixed(2)}%`;
      }
    }
  }

  dispose(): void {
    for (const [subject, bar] of this.bars) this.remove(subject, bar);
  }

  private create(subject: HealthBarSubject): BarControls {
    const root = new Rectangle("enemyBar");
    root.width = `${WIDTH}px`;
    root.height = `${HEIGHT}px`;
    root.thickness = 1;
    root.color = "#000000";
    root.background = "#1a1410cc";
    root.isHitTestVisible = false;

    const fill = new Rectangle("enemyBarFill");
    fill.thickness = 0;
    fill.background = "#d9533c";
    fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    root.addControl(fill);

    this.ui.addControl(root);
    root.linkWithMesh(subject.headAnchor);
    const bar = { root, fill, lastRatio: -1 };
    this.bars.set(subject, bar);
    return bar;
  }

  private remove(subject: HealthBarSubject, bar: BarControls): void {
    bar.root.linkWithMesh(null);
    this.ui.removeControl(bar.root);
    bar.root.dispose();
    this.bars.delete(subject);
  }
}
