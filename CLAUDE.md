# Herdeiros do Império — guia do projeto

## Visão do jogo
Jogo 3D medieval, modo história, em terceira pessoa, rodando no navegador. Combate de
ação estilo RPG (punhos, chutes, espada, escudo, arco e flecha). Referência de sensação:
The Legend of Zelda — exploração agradável, mira travada no inimigo, golpes legíveis.
Tom: paz leve e com humor (companheiros caricatos); combates intensos. Fases futuras
terão campos de batalha, infiltração e espionagem em palácios.

Formato episódico: cada EPISÓDIO é uma fase, cada TEMPORADA é um arco. Escolhas de um
episódio afetam os seguintes (via flags de história no save).

## Resumo da história
Um império de vários reinos. O imperador se corrompeu e, com dois reinos aliados, guerreou
contra três reinos mais fracos. Um herói de guerra levou os fracos à vitória; o império
ficou, mas o imperador foi trocado por um homem bom. O herói ganhou terras afastadas e vive
numa fazenda com a esposa grávida.

Temporada 1: o antigo imperador se alia a outros reinos e forma um exército. O herói visita
antigos companheiros, descobre que um grande amigo foi sequestrado e volta à guerra. No
cativeiro, descobre que o filho que julgava morto na primeira guerra está vivo. A temporada
termina com o herói derrotando o antigo imperador e adotando o filho recém-nascido dele.

## Stack
Babylon.js 9 (core, loaders, gui, inspector), Havok (`@babylonjs/havok`), TypeScript strict
(TS 7), Vite 8. Sem React/frameworks de UI. **Não adicionar bibliotecas sem perguntar ao
usuário** (inkjs para diálogos virá depois).

## Arquitetura

### Princípio central
UM motor único (`src/engine`). Episódios são **pacotes de conteúdo** (`public/episodes/<pasta>`)
que o motor carrega. **Nenhuma lógica específica de episódio dentro do motor**: tudo que
varia entre episódios vem de dados (JSON). Ex.: a fase "procedural" é montada por um
construtor genérico a partir do `level.json`; não existe "gerador do sandbox".

### Pastas
```
src/main.ts              lançador local (papel da plataforma futura): ?ep= → catálogo → GameConfig → startGame
src/engine/startGame.ts  ponto de entrada único do motor
src/engine/core/         Game (ciclo de vida), GameEvents, GameLoop, CanvasHost, Physics,
                         DisposeStack, GameError, DevInspector (F9), DevOrbitCamera (provisória)
src/engine/episodes/     EpisodeLoader (único que busca arquivos de episódio) + validadores
src/engine/world/        montagem de fase: ProceduralLevelBuilder, SkyDome, LevelLighting, DebugMarkers
src/engine/save/         SaveManager, LocalSaveProvider, migrateSave, defaultSave
src/engine/ui/           MessageOverlay (DOM); HUD (Babylon GUI) virá na Tarefa 5
src/engine/{player,combat,enemies,vfx}/  vazias até as Tarefas 2–5
src/shared/types/        tipos puros (sem Babylon), reaproveitáveis pela plataforma:
                         GameConfig/GameHandle, eventos, save, manifesto/level/encounters
public/episodes/catalog.json   id → pasta; lido SÓ pelo main.ts
```

### Fronteira com a plataforma futura (regras obrigatórias)
1. **Configuração injetada**: `startGame(config: GameConfig): GameHandle`. `GameConfig` =
   `episodeId`, `assetBaseUrl`, `saveProvider`, `mode` (`dev`|`production`), `container`.
   O motor **nunca** lê a URL da página nem o localStorage diretamente.
2. **Nada de caminhos fixos**: todo arquivo de episódio passa pelo `EpisodeLoader`, que
   resolve caminhos relativos a `assetBaseUrl` (futuramente um CDN protegido). Proibido
   escrever `"/episodes/..."` no motor. Caminhos dentro dos JSONs são relativos à pasta do
   pacote (sem `/` inicial, sem `..`, sem URL absoluta) — o validador rejeita.
3. **Eventos para fora**: `GameEvents` tipado: `episodeLoaded`, `checkpointReached`,
   `saveChanged`, `episodeCompleted`, `fatalError` (com `code`). Em modo dev, todos são
   logados no console. `startGame` retorna `{ events: { on, off }, dispose() }` — quem está
   fora só escuta, não emite. `startGame` retorna imediatamente e todos os eventos são
   emitidos depois do retorno, então se inscrever logo após a chamada é seguro.
4. **Ciclo de vida**: `dispose()` libera tudo (render loop, inspector, listeners, cena +
   física, engine, canvas, ResizeObserver, pointer lock) via `DisposeStack` (ordem inversa
   de criação). É idempotente e seguro mesmo no meio do carregamento. Em dev,
   `herdeiros.switchEpisode("s01e01")` no console testa trocar de episódio sem recarregar.
5. Tipos de `GameConfig`, eventos, save e manifesto ficam em `src/shared/types`.

### Decisões registradas (Tarefa 1)
- **`formatVersion: 1`** no manifesto, no level.json, no encounters.json e no save, para
  migrações futuras.
- **Fase em arquivo próprio**: `"level": { "type": "procedural", "file": "level.json" }`.
  O campo `type` existe para entrarem outros tipos (ex.: `"glb"` para cenários modelados)
  sem mudar o formato: novo tipo = novo `case` no `EpisodeLoader` + novo construtor em `world/`.
- **catalog.json** (id → pasta) é lido apenas pelo `main.ts`, que passa o `assetBaseUrl`
  pronto. O motor nunca conhece o catálogo.
- **`GameConfig.container: HTMLElement`**: o canvas acompanha o tamanho do **container**
  (ResizeObserver no container), não da janela. `dispose()` remove o canvas e desconecta
  o observer.
- **`description` e `requires` opcionais** no manifesto. O motor apenas lê e valida
  `requires`; **não** verifica pré-requisitos. Quem inicia o jogo (main.ts hoje, a
  plataforma no futuro) decide se o episódio pode abrir. Em dev, nenhuma verificação é feita.
- Manifesto sem `level` = episódio ainda sem conteúdo: o motor mostra aviso e emite
  `fatalError` com código `EPISODE_EMPTY` (é o caso do s01e01 por enquanto).
- O id do manifesto precisa bater com `GameConfig.episodeId` e com `season`/`episode`.
- Save: `SaveProvider` é assíncrono (pronto para nuvem). `SaveManager` migra versões
  antigas, preenche campos ausentes, e **não sobrescreve** um save de versão mais nova.
  `LocalSaveProvider` cai para memória se o localStorage falhar.
- O Inspector só entra no build de dev (`import.meta.env.DEV`); em produção o import é
  removido (economiza ~15 MB). Exige também `mode: "dev"`.
- Babylon importado pelo barrel `@babylonjs/core` (bundle principal ~5 MB). Otimizar com
  imports profundos é possível mais tarde, se necessário.

## Convenções
- Classes pequenas, responsabilidade única. Comentários em português nas partes não óbvias.
- Toda lógica de movimento usa deltaTime em segundos (`GameLoop.add(dt => ...)`).
- Valores de jogo (tempos, dano, velocidades) em configs/dados, nunca hardcoded na lógica.
- Recursos com ciclo de vida se registram no `DisposeStack` do `Game`.
- Erros fatais: lançar `GameError(code, mensagem)`; o `Game` converte em overlay + evento.
- JSON de episódio: validado ao carregar com mensagens que indicam o caminho do campo.
- Nomes de pacotes: `sTTeEE-nome-curto` (ex.: `s01e01-vandalos-na-colheita`).
- Fluxo: uma tarefa por vez; ao final, `npm run build`, instruções de teste, commit,
  atualizar este arquivo e esperar confirmação do usuário.

## Estado atual
- [x] **Tarefa 1 — Fundação**: Vite + TS, startGame/GameConfig/GameEvents/dispose, Havok,
  EpisodeLoader + validação, fase procedural do sandbox (chão, sol com sombras, ambiente,
  céu, muros, pilares, caixas dinâmicas), Inspector F9 (dev), SaveManager + LocalSaveProvider.
  Câmera atual é a `DevOrbitCamera` provisória (arrastar para girar, roda para zoom).
- [ ] Tarefa 2 — Personagem e câmera
- [ ] Tarefa 3 — Combate básico
- [ ] Tarefa 4 — Inimigos a partir de dados
- [ ] Tarefa 5 — Feedback, HUD e checkpoint

## Próximas fases (não implementar sem pedido; apenas não bloquear)
Espada e escudo com bloqueio, arco com mira por cima do ombro, troca de armas, modelos e
animações Mixamo com blend, diálogos com inkjs lendo/escrevendo flags do save, NPCs e
companheiros, cenários .glb CC0, menu principal e seleção de episódio, conteúdo do s01e01.
Plataforma web e pagamentos ficam para muito depois.
