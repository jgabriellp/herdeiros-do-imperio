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
src/engine/core/         Game (carregamento e ciclo de vida), GameplaySystems (monta e liga os
                         sistemas de jogo), GameEvents, GameLoop (fases input→update→late),
                         CanvasHost, Physics, CollisionLayers, DisposeStack, GameError,
                         DevInspector (F9), DevHotkeys (F7/F8), mathUtils
src/engine/core/input/   InputManager, InputSource (interface), KeyboardMouseSource, InputBindings
src/engine/episodes/     EpisodeLoader (único que busca arquivos de episódio) + validadores
src/engine/world/        montagem de fase: ProceduralLevelBuilder, SkyDome, LevelLighting, DebugMarkers
src/engine/save/         SaveManager, LocalSaveProvider, migrateSave, defaultSave
src/engine/character/    CharacterMotor (física de personagem: jogador E inimigos), CharacterConfig
src/engine/player/       Player (montagem + alvo de combate), PlayerController (orquestra o quadro),
                         PlayerStateMachine + states/ (Idle, Move, Run, Jump, Attack, HitStun, Dodge),
                         PlayerStats, PlayerVisual (interface) + CapsuleVisual, ThirdPersonCamera, configs
src/engine/combat/       CombatConfig (TODOS os números do combate), CombatTypes (CombatTarget, HitInfo),
                         Hitbox, DamageSystem, TargetLock, HitboxDebugView
src/engine/enemies/      Enemy (passivo por ora), EnemyVisual, EnemyFactory, EnemyManager, EnemyConfig (tipos)
src/engine/ui/           MessageOverlay, ControlsHint, DevStatsPanel (DOM), TargetMarker (3D);
                         HUD (Babylon GUI) virá na Tarefa 5
src/engine/vfx/          vazia até a Tarefa 5
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

### Decisões registradas (Tarefa 2)
- **Posições de spawn, checkpoint e inimigos = posição dos PÉS** (y=0 = no chão).
  Convenção compatível com modelos .glb, cuja origem fica nos pés.
- **Física do personagem**: `PhysicsCharacterController` do Havok (degraus até 0,35 m,
  rampas até 50°, empurra caixas). `keepContactTolerance` reduzido para 0,02: com o padrão
  (0,1) o personagem flutuava até 10 cm após uma queda.
- **Separação em camadas**: `PlayerMotor` (corpo: aceleração, gravidade, pulo com coyote time
  e buffer, rotação) recebe um `MoveIntent` e não lê input. `PlayerController` traduz input
  em intenção. Assim a máquina de estados do combate (Tarefa 3) e a IA comandam o mesmo motor.
- **Visual isolado**: `PlayerVisual` (origem nos pés, +Z = frente, `update(estado)` para futuras
  animações, `setVisibility`). Trocar a cápsula por .glb = nova classe + uma linha em `Player.ts`.
- **Integração vertical pela média da velocidade do quadro**: a altura do pulo é a mesma em
  qualquer FPS (medido: 1,40 m para `jumpHeight` 1,4 a ~20 e ~30 FPS).
- **Input em ações**: o jogo consulta `isDown/wasPressed("jump")`, `move`, `look` (já em radianos),
  `zoom`. Teclado ouvido no **canvas** (não na janela) para não capturar digitação da página
  da plataforma. Gamepad = nova classe `GamepadSource implements InputSource`, registrada com
  `input.addSource(...)` no `Game`; nada mais muda.
- **Câmera**: raycast Havok contra a camada `WORLD` (caixas dinâmicas são `PROP` e não empurram
  a câmera; jogador é `PLAYER`). Aproxima na hora quando bloqueada, volta suave. O personagem
  fica transparente quando a câmera encosta nele.
- **Chão físico**: caixa de 1 m de espessura com topo em y=0 (um plano de espessura zero
  deixava o personagem alguns centímetros acima do chão).
- **Queda infinita**: abaixo de `fallRespawnY` (-30) o jogador volta ao spawn (provisório até a
  morte/checkpoint da Tarefa 5).
- Atenção para a Tarefa 3: **Ctrl+W fecha a aba** do navegador e não pode ser bloqueado; a esquiva
  em Ctrl precisa considerar isso.

### Decisões registradas (Tarefa 3)
- **Esquiva no C** (decisão do usuário): Ctrl+W fecha a aba e não pode ser bloqueado.
  Evitar Ctrl em qualquer binding.
- **Máquina de estados**: cada estado preenche o `MoveIntent` e decide transições; a máquina só
  troca (e zera a intenção na troca, para nada "vazar" para o quadro seguinte). Velocidades de
  golpe/esquiva/empurrão usam `MoveIntent.forcedVelocity` (sem aceleração).
- **Golpes** em 3 fases (preparação → ativa → recuperação) com tempos em `CombatConfig`. Combo: o
  próximo soco pode ser pedido até `chainInputWindow` após a janela ativa e começa após
  `chainCancelAfter` da recuperação. A esquiva cancela a recuperação após `dodgeCancelAfter`.
  O golpe mira: alvo travado > direção do input > frente atual.
- **Hitbox** é uma esfera matemática (não física) contra a cápsula vertical do alvo; cada ativação
  guarda quem já acertou (um acerto por alvo por golpe). `DamageSystem` resolve e notifica `onHit`
  (gancho para VFX/hit stop da Tarefa 4/5).
- **Mira travada**: escolhe o alvo de menor `distância × (1 + 0,5 × ângulo/ânguloMáx)` dentro de
  70° da câmera e 15 m; solta se morrer ou passar de 22 m. Q sem alvo recentraliza a câmera atrás
  do jogador (como no Zelda). Travado: não corre, encara o alvo, A/D fazem strafe em volta dele.
  A trava continua ao levar golpe.
- **Esquiva**: livre = rola na direção do input (ou para frente); travada = passo lateral/recuo
  encarando o alvo. I-frames visíveis (personagem semitransparente).
- **Inimigos já existem (passivos)**: criados de `encounters.json` via `EnemyFactory` (tipo
  desconhecido = erro claro `INVALID_EPISODE`). Recebem dano, empurrão, piscam e morrem (caem, somem
  e saem da cena). IA (Chase/Attack, aviso, 1–2 atacando por vez) e hit stop: Tarefa 4.
- O jogador já é um `CombatTarget` (facção "player"); morte/renascimento: Tarefa 5.
- **Ferramentas de dev** (só `mode: "dev"`): painel de estado (canto superior esquerdo),
  F7 mostra hitboxes, F8 simula um golpe no jogador.

## Convenções
- Classes pequenas, responsabilidade única. Comentários em português nas partes não óbvias.
- Toda lógica de movimento usa deltaTime em segundos (`GameLoop.add(dt => ...)`). Suavizações
  usam `damp(nitidez, dt)` (exponencial, independente de FPS).
- Valores de tuning ficam em arquivos `*Config.ts` (ex.: `PlayerConfig`, `CameraConfig`).
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
- [x] **Tarefa 2 — Personagem e câmera**: cápsula com indicador de frente (visual isolado),
  WASD relativo à câmera com aceleração/desaceleração, Shift corre, Espaço pula (coyote time +
  buffer), rotação suave, câmera 3ª pessoa com pointer lock, suavização, limites verticais,
  zoom na roda e colisão com o cenário, InputManager com fontes plugáveis.
- [x] **Tarefa 3 — Combate básico**: máquina de estados do jogador, combo de 3 socos, chute com
  empurrão, fases de golpe em CombatConfig, um acerto por alvo por golpe, esquiva (C) com
  i-frames e stamina, regeneração de stamina, mira travada (Q / botão do meio) com strafe,
  enquadramento e marcador; inimigos passivos de `encounters.json` como alvos.
- [ ] Tarefa 4 — Inimigos a partir de dados
- [ ] Tarefa 5 — Feedback, HUD e checkpoint

## Próximas fases (não implementar sem pedido; apenas não bloquear)
Espada e escudo com bloqueio, arco com mira por cima do ombro, troca de armas, modelos e
animações Mixamo com blend, diálogos com inkjs lendo/escrevendo flags do save, NPCs e
companheiros, cenários .glb CC0, menu principal e seleção de episódio, conteúdo do s01e01.
Plataforma web e pagamentos ficam para muito depois.
