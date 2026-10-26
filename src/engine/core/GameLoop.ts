import type { AbstractEngine, Scene } from "@babylonjs/core";

export type UpdateFn = (deltaSeconds: number) => void;

/** Evita saltos enormes após a aba ficar em segundo plano. */
const MAX_DELTA_SECONDS = 0.1;

/** Render loop com lista de sistemas atualizados por deltaTime (em segundos). */
export class GameLoop {
  private readonly updaters = new Set<UpdateFn>();
  private readonly renderFrame = (): void => this.frame();
  private running = false;

  constructor(
    private readonly engine: AbstractEngine,
    private readonly scene: Scene,
  ) {}

  /** Retorna função para remover o sistema. */
  add(fn: UpdateFn): () => void {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
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
    for (const update of this.updaters) update(dt);
    this.scene.render();
  }
}
