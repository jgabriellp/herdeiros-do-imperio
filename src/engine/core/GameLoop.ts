import type { AbstractEngine, Scene } from "@babylonjs/core";

export type UpdateFn = (deltaSeconds: number) => void;

/**
 * Fases executadas a cada quadro, nesta ordem, antes de scene.render():
 *  - input:  leitura dos dispositivos (InputManager)
 *  - update: lógica de jogo (jogador, inimigos)
 *  - late:   o que depende das posições finais do quadro (câmera)
 */
export type UpdatePhase = "input" | "update" | "late";
const PHASES: readonly UpdatePhase[] = ["input", "update", "late"];

/** Evita saltos enormes após a aba ficar em segundo plano. */
const MAX_DELTA_SECONDS = 0.1;

/** Render loop com sistemas atualizados por deltaTime (em segundos). */
export class GameLoop {
  private readonly phases = new Map<UpdatePhase, Set<UpdateFn>>(PHASES.map((p) => [p, new Set()]));
  private readonly renderFrame = (): void => this.frame();
  private running = false;

  constructor(
    private readonly engine: AbstractEngine,
    private readonly scene: Scene,
  ) {}

  /** Retorna função para remover o sistema. */
  add(fn: UpdateFn, phase: UpdatePhase = "update"): () => void {
    const set = this.phases.get(phase)!;
    set.add(fn);
    return () => set.delete(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.engine.runRenderLoop(this.renderFrame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.engine.stopRenderLoop(this.renderFrame);
  }

  private frame(): void {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, MAX_DELTA_SECONDS);
    for (const phase of PHASES) {
      for (const update of this.phases.get(phase)!) update(dt);
    }
    this.scene.render();
  }
}
