import { Engine, Scene } from "@babylonjs/core";
import type { GameConfig, Vec3Data } from "../../shared/types";
import { EpisodeLoader, type LoadedEpisode } from "../episodes/EpisodeLoader";
import { SaveManager } from "../save/SaveManager";
import { MessageOverlay } from "../ui/MessageOverlay";
import { createDebugMarkers } from "../world/DebugMarkers";
import { ProceduralLevelBuilder, type BuiltLevel } from "../world/ProceduralLevelBuilder";
import { CanvasHost } from "./CanvasHost";
import { DevInspector } from "./DevInspector";
import { DisposeStack } from "./DisposeStack";
import { GameError } from "./GameError";
import type { GameEvents } from "./GameEvents";
import { GameLoop } from "./GameLoop";
import { createGameplay } from "./GameplaySystems";
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

    const level = this.buildWorld(scene, episode);
    const spawn = this.restoreProgress(save, episode);
    createGameplay({
      scene,
      host,
      loop,
      disposables: this.disposables,
      shadows: level?.lighting.shadows ?? null,
      manifest,
      spawn,
      playerAttributes: save.current.player,
      encounters: episode.encounters,
      save,
      events,
      devMode: config.mode === "dev",
    });

    if (config.mode === "dev") {
      const inspector = new DevInspector(scene);
      this.disposables.add("devInspector", () => inspector.dispose());
    }

    loop.start();
    await scene.whenReadyAsync();
    this.throwIfDisposed();

    host.canvas.focus();
    events.emit("episodeLoaded", { episodeId: manifest.id, title: manifest.title, version: manifest.version });
  }

  private buildWorld(scene: Scene, episode: LoadedEpisode): BuiltLevel | null {
    const { manifest, level } = episode;
    const built = level?.type === "procedural" ? new ProceduralLevelBuilder(scene).build(level.data) : null;

    if (this.config.mode === "dev") createDebugMarkers(scene, manifest);
    return built;
  }

  /**
   * Registra no save o episódio atual e decide onde o jogador nasce:
   * no checkpoint salvo (se ainda existir neste episódio) ou no spawnPoint.
   */
  private restoreProgress(save: SaveManager, episode: LoadedEpisode): Vec3Data {
    const { manifest } = episode;
    const saved = save.current;
    const savedCheckpoint =
      saved.currentEpisodeId === manifest.id
        ? manifest.checkpoints.find((cp) => cp.id === saved.currentCheckpointId)
        : undefined;

    if (savedCheckpoint) return savedCheckpoint.position;

    save.setCurrent(manifest.id, manifest.checkpoints[0]!.id);
    return manifest.spawnPoint;
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
