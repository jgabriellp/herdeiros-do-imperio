import { Engine, Scene } from "@babylonjs/core";
import type { GameConfig } from "../../shared/types";
import { EpisodeLoader, type LoadedEpisode } from "../episodes/EpisodeLoader";
import { SaveManager } from "../save/SaveManager";
import { MessageOverlay } from "../ui/MessageOverlay";
import { createDebugMarkers } from "../world/DebugMarkers";
import { ProceduralLevelBuilder } from "../world/ProceduralLevelBuilder";
import { CanvasHost } from "./CanvasHost";
import { DevInspector } from "./DevInspector";
import { createDevOrbitCamera } from "./DevOrbitCamera";
import { DisposeStack } from "./DisposeStack";
import { GameError } from "./GameError";
import type { GameEvents } from "./GameEvents";
import { GameLoop } from "./GameLoop";
import { enablePhysics } from "./Physics";

/** Sinaliza que o boot foi interrompido por um dispose(); não é erro. */
class BootCancelled extends Error {}

/**
 * Uma sessão de jogo de um episódio: cria engine, física, cena e sistemas,
 * e garante que tudo seja liberado no dispose().
 */
export class Game {
  private readonly disposables = new DisposeStack();
  private disposePromise: Promise<void> | null = null;
  private overlay: MessageOverlay | null = null;
  private loop: GameLoop | null = null;

  constructor(
    private readonly config: GameConfig,
    private readonly events: GameEvents,
  ) {}

  private get disposed(): boolean {
    return this.disposePromise !== null;
  }

  async start(): Promise<void> {
    try {
      await this.boot();
    } catch (err) {
      if (err instanceof BootCancelled || this.disposed) return;
      this.fail(err);
    }
  }

  dispose(): Promise<void> {
    this.disposePromise ??= (async () => {
      await this.disposables.disposeAll();
      this.events.clear();
    })();
    return this.disposePromise;
  }

  private async boot(): Promise<void> {
    const { config, events } = this;
    const isDev = config.mode === "dev";

    const host = new CanvasHost(config.container);
    this.disposables.add("canvas", () => host.dispose());
    this.overlay = new MessageOverlay(host.root);

    let engine: Engine;
    try {
      engine = new Engine(host.canvas, true, { stencil: true, adaptToDeviceRatio: true });
    } catch (err) {
      throw new GameError("ENGINE_INIT", `Não foi possível iniciar o WebGL: ${String(err)}`, { cause: err });
    }
    this.disposables.add("engine", () => engine.dispose());
    host.onResize(() => engine.resize());

    const scene = new Scene(engine);
    // Ao descartar a cena, o mundo físico (Havok) também é descartado.
    this.disposables.add("scene", () => scene.dispose());

    const loop = new GameLoop(engine, scene);
    this.loop = loop;
    this.disposables.add("gameLoop", () => loop.stop());

    const loader = new EpisodeLoader(config.assetBaseUrl);
    this.disposables.add("episodeLoader", () => loader.cancel());

    const save = new SaveManager(config.saveProvider, events);
    this.disposables.add("saveManager", () => save.dispose());

    // Física, save e arquivos do episódio carregam em paralelo.
    const [, , episode] = await Promise.all([
      enablePhysics(scene),
      save.load(),
      loader.load(config.episodeId),
    ]);
    this.throwIfDisposed();

    const { manifest } = episode;
    if (!episode.level) {
      throw new GameError(
        "EPISODE_EMPTY",
        `"${manifest.title}" (${manifest.id}) ainda não tem uma fase jogável.`,
      );
    }

    this.buildWorld(scene, host.canvas, episode);

    if (isDev) {
      const inspector = new DevInspector(scene);
      this.disposables.add("devInspector", () => inspector.dispose());
    }

    this.restoreProgress(save, episode);

    loop.start();
    await scene.whenReadyAsync();
    this.throwIfDisposed();

    host.canvas.focus();
    events.emit("episodeLoaded", { episodeId: manifest.id, title: manifest.title, version: manifest.version });
  }

  private buildWorld(scene: Scene, canvas: HTMLCanvasElement, episode: LoadedEpisode): void {
    const { manifest, level } = episode;
    if (level?.type === "procedural") new ProceduralLevelBuilder(scene).build(level.data);

    createDevOrbitCamera(scene, canvas, manifest.spawnPoint);

    if (this.config.mode === "dev") {
      createDebugMarkers(scene, manifest);
      // Inimigos serão criados na Tarefa 4; por ora só confirmamos a leitura.
      console.info(`[Game] encounters: ${episode.encounters.enemies.length} inimigo(s) validado(s).`);
    }
  }

  /** Registra no save o episódio atual, mantendo o checkpoint se ele ainda existir. */
  private restoreProgress(save: SaveManager, episode: LoadedEpisode): void {
    const { manifest } = episode;
    const saved = save.current;
    const keepCheckpoint =
      saved.currentEpisodeId === manifest.id &&
      manifest.checkpoints.some((cp) => cp.id === saved.currentCheckpointId);
    const checkpointId = keepCheckpoint ? saved.currentCheckpointId! : manifest.checkpoints[0]!.id;
    if (!keepCheckpoint) save.setCurrent(manifest.id, checkpointId);
  }

  private throwIfDisposed(): void {
    if (this.disposed) throw new BootCancelled();
  }

  private fail(err: unknown): void {
    const code = err instanceof GameError ? err.code : "UNKNOWN";
    const message = err instanceof Error ? err.message : String(err);

    this.loop?.stop();
    if (code === "EPISODE_EMPTY") {
      console.warn(`[Herdeiros] ${message}`);
      this.overlay?.show("Episódio ainda em produção", message);
    } else {
      console.error(`[Herdeiros] Erro fatal (${code}):\n${message}`, err);
      this.overlay?.show("Não foi possível carregar o episódio", message, "error");
    }
    this.events.emit("fatalError", { code, message });
  }
}
