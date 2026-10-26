import type { EncountersData, EpisodeManifest, ProceduralLevelData } from "../../shared/types";
import { GameError } from "../core/GameError";
import { validateEncounters } from "./validateEncounters";
import { validateProceduralLevel } from "./validateLevel";
import { validateManifest } from "./validateManifest";

export const MANIFEST_FILE = "manifest.json";

export interface LoadedEpisode {
  manifest: EpisodeManifest;
  /** Ausente quando o episódio ainda não tem fase (só manifesto). */
  level?: { type: "procedural"; data: ProceduralLevelData };
  encounters: EncountersData;
}

/**
 * Único ponto do motor que busca arquivos de episódio.
 * Tudo é resolvido a partir da URL base recebida no GameConfig
 * (hoje uma pasta local; no futuro, um CDN com acesso protegido).
 */
export class EpisodeLoader {
  private readonly baseUrl: URL;
  private readonly abort = new AbortController();

  constructor(assetBaseUrl: string) {
    // Garante a barra final para que caminhos relativos fiquem DENTRO da pasta.
    const normalized = assetBaseUrl.endsWith("/") ? assetBaseUrl : `${assetBaseUrl}/`;
    this.baseUrl = new URL(normalized, document.baseURI);
  }

  /** URL absoluta de um arquivo do pacote. */
  resolve(relativePath: string): string {
    return new URL(relativePath, this.baseUrl).href;
  }

  async load(expectedEpisodeId: string): Promise<LoadedEpisode> {
    const warnings: string[] = [];
    const manifest = validateManifest(await this.fetchJson(MANIFEST_FILE, "EPISODE_NOT_FOUND"), warnings);

    if (manifest.id !== expectedEpisodeId) {
      throw new GameError(
        "INVALID_EPISODE",
        `O manifesto em ${this.resolve(MANIFEST_FILE)} é do episódio "${manifest.id}", mas foi pedido "${expectedEpisodeId}".`,
      );
    }

    const loaded: LoadedEpisode = { manifest, encounters: { formatVersion: 1, enemies: [] } };

    if (manifest.level) {
      // Novo tipo de fase (ex.: "glb") = novo case aqui, sem mudar o formato do manifesto.
      switch (manifest.level.type) {
        case "procedural": {
          const file = manifest.level.file;
          loaded.level = { type: "procedural", data: validateProceduralLevel(await this.fetchJson(file), file) };
          break;
        }
      }
    }

    if (manifest.encounters) {
      const file = manifest.encounters;
      loaded.encounters = validateEncounters(await this.fetchJson(file), file);
    }

    for (const w of warnings) console.warn(`[EpisodeLoader] ${w}`);
    return loaded;
  }

  /** Cancela downloads em andamento (usado no dispose). */
  cancel(): void {
    this.abort.abort();
  }

  private async fetchJson(relativePath: string, notFoundCode: "EPISODE_NOT_FOUND" | "INVALID_EPISODE" = "INVALID_EPISODE"): Promise<unknown> {
    const url = this.resolve(relativePath);
    let response: Response;
    try {
      response = await fetch(url, { signal: this.abort.signal });
    } catch (err) {
      if (this.abort.signal.aborted) throw err;
      throw new GameError(notFoundCode, `Falha de rede ao baixar ${url}: ${String(err)}`);
    }
    if (!response.ok) {
      throw new GameError(notFoundCode, `Arquivo não encontrado: ${url} (HTTP ${response.status})`);
    }
    const text = await response.text();
    try {
      return JSON.parse(text) as unknown;
    } catch (err) {
      // Servidores de SPA (inclusive o Vite em dev) respondem HTML para arquivos inexistentes.
      const looksLikeHtml = text.trimStart().startsWith("<");
      throw new GameError(
        looksLikeHtml ? notFoundCode : "INVALID_EPISODE",
        looksLikeHtml
          ? `Arquivo não encontrado: ${url} (o servidor respondeu HTML em vez de JSON)`
          : `${relativePath} não é um JSON válido (${url}): ${(err as Error).message}`,
      );
    }
  }
}
