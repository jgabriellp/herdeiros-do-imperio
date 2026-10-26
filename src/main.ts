/**
 * Lançador local: faz hoje o papel que a plataforma web fará no futuro.
 * Lê ?ep= da URL, resolve a pasta do episódio pelo catálogo, monta o GameConfig
 * e chama startGame. O motor não conhece o catálogo nem a URL da página.
 */
import { startGame } from "./engine/startGame";
import { LocalSaveProvider } from "./engine/save/LocalSaveProvider";
import type { GameConfig, GameHandle } from "./shared/types";

const EPISODES_ROOT = `${import.meta.env.BASE_URL}episodes/`;
const DEFAULT_EPISODE = "s00e00";

interface CatalogEntry {
  id: string;
  folder: string;
}

async function resolveEpisodeBaseUrl(episodeId: string): Promise<string> {
  const response = await fetch(`${EPISODES_ROOT}catalog.json`);
  if (!response.ok) throw new Error(`catalog.json não encontrado (HTTP ${response.status})`);
  const catalog = (await response.json()) as { episodes?: CatalogEntry[] };
  const entry = catalog.episodes?.find((e) => e.id === episodeId);
  if (!entry) {
    const known = catalog.episodes?.map((e) => e.id).join(", ") ?? "nenhum";
    throw new Error(`Episódio "${episodeId}" não está no catálogo. Disponíveis: ${known}`);
  }
  return `${EPISODES_ROOT}${entry.folder}/`;
}

function showLauncherError(container: HTMLElement, message: string): void {
  console.error(`[main] ${message}`);
  const el = document.createElement("pre");
  el.className = "launcher-error";
  el.textContent = message;
  container.replaceChildren(el);
}

async function launch(container: HTMLElement, episodeId: string): Promise<GameHandle | null> {
  let assetBaseUrl: string;
  try {
    assetBaseUrl = await resolveEpisodeBaseUrl(episodeId);
  } catch (err) {
    showLauncherError(container, (err as Error).message);
    return null;
  }
  // Pré-requisitos (manifest.requires) seriam checados aqui; em dev, nenhuma verificação.
  const config: GameConfig = {
    episodeId,
    assetBaseUrl,
    saveProvider: new LocalSaveProvider(),
    mode: import.meta.env.DEV ? "dev" : "production",
    container,
  };
  return startGame(config);
}

const container = document.getElementById("app");
if (!container) throw new Error('Elemento #app não encontrado no index.html');

const episodeId = new URLSearchParams(location.search).get("ep") ?? DEFAULT_EPISODE;
let handle = await launch(container, episodeId);

if (import.meta.env.DEV) {
  // Ferramenta de teste do ciclo de vida: trocar de episódio sem recarregar a página.
  Object.assign(window, {
    herdeiros: {
      get handle() {
        return handle;
      },
      async switchEpisode(id: string) {
        await handle?.dispose();
        container.replaceChildren();
        handle = await launch(container, id);
      },
    },
  });
}

// Evita jogos duplicados quando o Vite recarrega este módulo (HMR).
import.meta.hot?.dispose(() => handle?.dispose());
