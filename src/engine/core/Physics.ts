import { HavokPlugin, Vector3, type Scene } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
// O Vite resolve a URL final do .wasm (dev e build).
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { GameError } from "./GameError";

const GRAVITY = new Vector3(0, -9.81, 0);

type HavokModule = Awaited<ReturnType<typeof HavokPhysics>>;

// O módulo WASM é carregado uma vez e reaproveitado entre episódios;
// cada jogo cria (e destrói) o seu próprio mundo físico via HavokPlugin.
let havokModule: Promise<HavokModule> | null = null;

function loadHavok(): Promise<HavokModule> {
  havokModule ??= HavokPhysics({ locateFile: () => havokWasmUrl }).catch((err: unknown) => {
    havokModule = null; // permite tentar de novo
    throw new GameError("ENGINE_INIT", `Falha ao carregar a física Havok: ${String(err)}`, { cause: err });
  });
  return havokModule;
}

/**
 * Liga a física Havok na cena. O mundo é liberado junto com scene.dispose().
 * Retorna null se a cena foi descartada enquanto o WASM carregava.
 */
export async function enablePhysics(scene: Scene): Promise<HavokPlugin | null> {
  const hk = await loadHavok();
  if (scene.isDisposed) return null;
  const plugin = new HavokPlugin(true, hk);
  scene.enablePhysics(GRAVITY, plugin);
  return plugin;
}
