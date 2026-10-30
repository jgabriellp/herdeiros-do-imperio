# Herdeiros do Império — guia do projeto

## Visão do jogo
Jogo 3D medieval, modo história, em terceira pessoa, rodando no navegador. Combate de
ação estilo RPG (punhos, chutes, espada, escudo, arco e flecha). Referência de sensação:
The Legend of Zelda — exploração agradável, mira travada no inimigo, golpes legíveis.
Tom: paz leve e com humor (companheiros caricatos); combates intensos. Fases futuras
terão campos de batalha, infiltração e espionagem em palácios.

Formato episódico: cada EPISÓDIO é uma fase, cada TEMPORADA é um arco. Escolhas de um
episódio afetam os seguintes (via flags de história no save).

### Referência de estilo: Medieval Dynasty (registrado pelo usuário em 2026-10-30)
O usuário deseja que o jogo tenha **o mesmo estilo visual e a mesma jogabilidade de Medieval
Dynasty**: estilo visual, jogabilidade, mapas, diálogos etc. Isso vale para as fases de
conteúdo (história, mapas, personagens); a fundação atual continua valendo.

Pontos a decidir com o usuário quando chegar a hora (não decidir sozinho):
- **Câmera**: Medieval Dynasty é jogado principalmente em primeira pessoa; o projeto hoje é em
  terceira pessoa com mira travada estilo Zelda. Manter 3ª pessoa, mudar para 1ª ou ter as duas?
- **Visual**: o estilo é realista (vegetação densa, iluminação natural, ciclo dia/noite,
  estações). No navegador isso exige cuidado com desempenho e assets (PBR, LOD, vegetação
  instanciada); avaliar na Tarefa 12 (cenários .glb).
- **Jogabilidade**: Medieval Dynasty tem sobrevivência, coleta, construção, agricultura e gestão
  de vila. Quais desses sistemas entram, e como convivem com o formato episódico de história e
  combate?
- **Mapas**: mundo aberto contínuo versus fases por episódio (o formato atual).
- **Diálogos**: escolhas em lista com o NPC na tela (estilo Medieval Dynasty) — alinhado com o
  plano de usar ink na Tarefa 11.

## Resumo da história
Um império de vários reinos. O imperador se corrompeu e, com dois reinos aliados, guerreou
contra três reinos mais fracos. Um herói de guerra levou os fracos à vitória; o império
ficou, mas o imperador foi trocado por um homem bom. O herói ganhou terras afastadas e vive
numa fazenda com a esposa grávida.

Temporada 1: o antigo imperador se alia a outros reinos e forma um exército. O herói visita
antigos companheiros, descobre que um grande amigo foi sequestrado e volta à guerra. No
cativeiro, descobre que o filho que julgava morto na primeira guerra está vivo. A temporada
termina com o herói derrotando o antigo imperador e adotando o filho recém-nascido dele.

**Equipamento na história**: o herói abandonou a vida de batalhas e não guardou nada da antiga
armadura. Um amigo (que também vive numa terra recebida de presente) guardou o equipamento para
ele; quando a jornada começar, o herói vai buscá-lo com esse amigo (entrega por NPC/diálogo).
Ao longo da jornada ele acumula armas e equipamentos espalhados pelo mapa no inventário.

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
                         PlayerStateMachine + states/ (Idle, Move, Run, Jump, Attack, HitStun, Dodge,
                         Block, Aim, Dead), PlayerStats, PlayerEquipment (armas na mão + entrega de itens), PlayerVisual (interface) + CapsuleVisual, ThirdPersonCamera, configs
src/engine/combat/       CombatConfig (TODOS os números do combate), CombatTypes (CombatTarget, HitInfo),
                         Hitbox, DamageSystem, TargetLock, HitboxDebugView, ArrowSystem (flechas),
                         arrowAim (direção do disparo), geometry (segmento × cápsula)
src/engine/enemies/      Enemy, EnemyStateMachine + states/ (Idle, Chase, Attack, HitStun, Dead),
                         AttackCoordinator (fichas de ataque), EnemyVisual, EnemyFactory, EnemyManager,
                         EnemyConfig (tipos, IA, golpe, regras do grupo)
src/engine/progress/     CheckpointSystem, RespawnSystem, EpisodeCompletion
src/engine/items/        ItemConfig (catálogo de itens), ItemMeshes (formas provisórias), PickupSystem
src/engine/ui/           Hud e EnemyHealthBars (Babylon GUI), TargetMarker (3D),
                         MessageOverlay, ControlsHint, DevStatsPanel (DOM)
src/engine/vfx/          HitStop, ImpactParticles, CameraShake, ImpactFeedback (liga tudo ao onHit)
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
- Inimigos são criados de `encounters.json` via `EnemyFactory` (tipo desconhecido = erro claro
  `INVALID_EPISODE`).
- O jogador já é um `CombatTarget` (facção "player"); morte/renascimento: Tarefa 5.
- **Ferramentas de dev** (só `mode: "dev"`): painel de estado (canto superior esquerdo),
  F7 mostra hitboxes, F8 simula um golpe no jogador.

### Decisões registradas (Tarefa 4)
- **IA por máquina de estados** (mesmo padrão do jogador): Idle → Chase → Attack, HitStun, Dead.
  Chase tem dois modos: "avançando" (tem a vez de atacar) e "ronda" (anda de lado em volta do
  jogador a ~4,5 m esperando a vez). Não criei um estado extra para a ronda.
- **AttackCoordinator** ("fichas"): no máximo 2 com a vez ao mesmo tempo e 0,8 s entre o início de
  dois ataques. A ficha é devolvida ao terminar o golpe, ao ser atingido, ao morrer, ou se não
  alcançar o jogador em 4 s. Depois de atacar, espera 1,2–2,4 s (aleatório) para pedir de novo.
- **Aviso do ataque**: preparação de 0,6 s com a clava erguida brilhando em amarelo e o corpo
  pulsando em laranja (fica aceso nos últimos 20%). Na preparação o inimigo ainda gira devagar
  para o jogador: esquivar para o lado no tempo certo funciona. Golpe do jogador interrompe a
  preparação (HitStun).
- **Alerta de grupo**: inimigo parado entra na luta se um aliado a até 12 m já estiver lutando.
- **Separação**: inimigos se afastam uns dos outros (raio 1,6 m) para não se amontoarem.
- **Hit stop**: todo acerto (do jogador ou no jogador) congela a fase "update" do GameLoop e a
  física (`scene.physicsEnabled = false`) por 60 ms (90 ms em golpes fortes). Input e câmera
  continuam em tempo real, então nenhum toque se perde durante a pausa.
- Dano do golpe do inimigo vem de `stats.damage` do encounters.json; tempos/alcance/empurrão vêm
  do tipo em `EnemyConfig`.

### Decisões registradas (Tarefa 5)
- **Feedback de impacto** centralizado em `vfx/ImpactFeedback` (inscrito em `DamageSystem.onHit`):
  hit stop + faíscas em todo acerto; poeira e tremida de câmera em golpes fortes (`heavy`:
  3º soco e chute); tremida leve quando o jogador é atingido. Partículas usam pool (4 sistemas
  de cada) e textura gerada em código. A tremida usa tempo real (continua no hit stop).
- **HUD em Babylon GUI**: vida (com número) e stamina no canto superior esquerdo; a barra de
  stamina fica laranja quando não dá para esquivar. Barras de vida dos inimigos ligadas a um nó
  acima da cabeça, visíveis só quando o inimigo está lutando ou ferido. Painel de dev foi para o
  canto superior direito.
- **Checkpoint**: passar a 2 m de um checkpoint do manifesto diferente do atual → `save.setCurrent`,
  evento `checkpointReached` e aviso "Checkpoint salvo". O ponto de renascimento e o de "caiu do
  mundo" passam a ser o último checkpoint.
- **Morte**: novo estado `Dead` do jogador (não estava na lista original, mas é necessário).
  Tela escurece com "Você caiu"; após 2,5 s renasce no último checkpoint salvo com vida e
  stamina cheias e 2 s de invulnerabilidade. Inimigos vivos voltam às posições iniciais
  (mantendo a vida perdida); mortos continuam mortos.
- **Conclusão**: quando todos os inimigos criados estão mortos → `save.markEpisodeCompleted`,
  evento `episodeCompleted` e mensagem "Episódio concluído" (com o título do episódio). Episódio
  sem inimigos não conclui por esta regra (vai precisar de outra condição no futuro).
- Pasta nova `engine/progress/` para as regras de progresso (não são combate nem carregamento).
- F6 (dev) derrota todos os inimigos para testar a conclusão.

### Decisões registradas (Tarefa 6)
- **Bloqueio no botão direito** (segurado); **parry fica para depois** (decisões do usuário).
- **Itens**: catálogo em `items/ItemConfig.ts` (como os tipos de inimigo). Episódios referenciam
  pelo id. `PlayerEquipment.grant(itemId)` é o **único** caminho para dar um item ao jogador:
  entra no inventário (`equipment.owned`) e é equipado se o slot estiver vazio (a 1ª arma já é
  empunhada). Hoje usado pelos pickups; na Tarefa 11, pelo amigo/NPCs nos diálogos.
- **Pickups**: lista opcional `pickups` no `level.json` (`id`, `item`, `position` da base).
  Passar a até 1,4 m pega (folga para itens sobre pedestais sólidos). Pegos ficam em
  `save.collectedPickups` como `"episodeId/pickupId"` e não reaparecem. Item desconhecido =
  erro `INVALID_EPISODE`. No sandbox: pedestais atrás do início, fora do alcance dos inimigos.
- **Save v2**: adicionou `collectedPickups`. Primeira migração real (v1 → v2), testada com um
  save v1 antigo: progresso preservado.
- **Troca de arma**: 1 = punhos, 2 = arma (espada e/ou escudo). Só em Idle/Move/Run/Block.
  Guardadas, espada e escudo aparecem nas costas.
- **Espada**: combo próprio (`sword1-3` em `CombatConfig`, inicia por `swordComboStarter`); dano
  × `damageMultiplier` da espada. Cortes 1 e 2 varrem a hitbox num arco de 110° (`sweepDeg`,
  sentidos opostos); o 3º é de cima para baixo (golpe forte).
- **Bloqueio** (estado `Block`): anda a 2,2 m/s encarando o alvo travado ou para onde a câmera
  olha. Golpe a até 70° da frente = sem dano, gasta `max(10, dano × 1,5 × escudo)` de stamina,
  empurrão reduzido (35%), faíscas azuis. Sem stamina: **guarda quebrada** (sem dano, atordoado
  0,8 s). Inimigo cujo golpe é bloqueado recua (`blockedRecoil` no tipo). Golpes pelos lados/costas
  passam. Novos resultados de golpe: `blocked` e `guardBreak`.
- Botão direito não abre o menu do navegador (`contextmenu` bloqueado no canvas).

### Decisões registradas (Tarefa 7)
- **Arco**: item `arco_curto` (slot `ranged`), tecla **3**; com o arco na mão, espada e escudo vão
  para as costas. Modos de arma agora: `unarmed`, `armed`, `bow`. Ao receber uma arma de mãos
  vazias, ela é empunhada; senão o modo atual é mantido. **Flechas infinitas por enquanto.**
- **Mira** (estado `Aim`, botão direito segurado; o mesmo botão bloqueia quando há escudo na mão):
  câmera vai para o ombro direito (2,8 m, 0,85 m de deslocamento, FOV 0,78, mouse a 60%), ignora a
  trava, corpo acompanha a câmera, anda a 2,4 m/s. Segurar o clique puxa a corda (0,8 s até 100%);
  soltar com tensão ≥ 20% dispara; 0,3 s para encaixar a próxima. Retícula com anel que fecha com a
  tensão (dourado no máximo). Sem mirar, clique = tiro rápido (tensão 45%) no alvo travado ou à frente.
- **Flechas** (`ArrowSystem`): projéteis com gravidade (9 m/s²), velocidade 20–48 m/s e dano 10–30
  conforme a tensão (× multiplicador do arco). Colisão com cenário por raycast Havok (WORLD+PROP):
  crava e some após 8 s; com personagens por segmento × cápsula. Acerto passa por
  `DamageSystem.applyDirect` (mesmo hit stop/faíscas). Máx. 40 na cena. A direção é calculada para
  o ponto sob a retícula **com compensação da queda** (a flecha cai onde a retícula aponta).
  Testado: abates mirados a 16,6 m e 20,4 m. **Confirmado pelo usuário**: não quer mira mais
  realista (sem o jogador compensar a queda).
- **Abate furtivo** (`HitInfo.stealthKill`): alvo **desprevenido** (estado Idle) morre na hora,
  inclusive o bruto, e **em silêncio**. **Só com flecha** (confirmado pelo usuário): soco/espada em
  inimigo desprevenido causam dano normal e ele grita.
- **Fim do alerta por distância**: o inimigo **grita** ao avistar o jogador ou ao ser ferido; aliados
  desprevenidos a até `alertRadius` (12 m) entram na luta e gritam também (o alerta se propaga).
  A troca de estado acontece antes do grito (senão o eco virava recursão infinita). Visão em cone,
  audição, desconfiança e corpos encontrados: Tarefa 8.

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
- [x] **Tarefa 4 — Inimigos a partir de dados**: IA com Idle/Chase/Attack/HitStun/Dead, aviso
  visual antes do golpe, no máximo 2 atacando por vez (os outros rondam), alerta de grupo,
  knockback + piscar vermelho + hit stop de ~60 ms, 3 inimigos com atributos diferentes.
- [x] **Tarefa 5 — Feedback, HUD e checkpoint**: faíscas/poeira no impacto, tremida nos golpes
  fortes, HUD (vida/stamina) e vida flutuante dos inimigos em Babylon GUI, checkpoints salvos ao
  passar, morte e renascimento no último checkpoint, conclusão do episódio (save + evento +
  mensagem). Ciclo carregar → jogar → salvar → avisar validado no sandbox.

**Fundação concluída.** As próximas tarefas estão abaixo, na ordem proposta. Nenhuma começa
sem aprovação do usuário; a ordem pode mudar se ele pedir.

## Próximas tarefas (roteiro proposto)
- [x] **Tarefa 6 — Espada, escudo, bloqueio e troca de armas**: equipamento e inventário no
  save (v2), itens no mapa (`pickups`), troca 1/2, combo de espada com varredura, bloqueio no
  botão direito com custo de stamina, guarda quebrada e recuo do inimigo, visual da espada e do
  escudo (mão/costas/erguido), arma na HUD. Parry fica para depois.
- [x] **Tarefa 7 — Arco e base da furtividade**: arco no pedestal, tecla 3, mira no botão
  direito (câmera no ombro, retícula), puxar/soltar com tensão, tiro rápido, flechas com gravidade
  que cravam no cenário, abate furtivo silencioso em inimigo desprevenido, alerta por grito no
  lugar do alerta por distância. Flechas infinitas por enquanto.
- [ ] **Tarefa 8 — Percepção e furtividade**
  1. Consciência do inimigo: **desprevenido → desconfiado (?) → alerta (!)**, com indicadores
     sobre a cabeça.
  2. Visão em cone com distância e linha de visão (paredes e pilares bloqueiam).
  3. Audição: ruídos com raio (combate alto; flecha batendo no cenário baixo, vira distração
     que faz o inimigo investigar o ponto).
  4. Desconfiado vai investigar o ponto suspeito; se não achar nada, volta ao normal.
  5. **Agachar com V** (alterna: aperta uma vez agacha, aperta de novo levanta): mais lento,
     menos barulho, mais difícil de ver.
  6. Inimigo que encontra um **companheiro abatido** fica desconfiado (decisão do usuário).
  7. Alerta de grupo passa a exigir ver ou ouvir a luta.
- [ ] **Tarefa 9 — Modelos e animações Mixamo**: `PlayerVisual` (e o visual dos inimigos)
  carregando .glb com blend de animações (parado, andar, correr, pular, golpes, esquiva,
  atordoado, morte, mirar/atirar, agachado) a partir do `PlayerVisualState`. **Depende do
  usuário** baixar os .glb do Mixamo (conta Adobe); a lista exata de animações será passada antes.
- [ ] **Tarefa 10 — Menu principal, seleção de episódio e inventário**: tela inicial, lista de
  episódios do catálogo, episódios concluídos vindos do save e verificação de `requires` feita
  pelo lançador (nunca pelo motor); tela de inventário para escolher qual arma/escudo equipar
  quando houver mais de um.
- [ ] **Tarefa 11 — Diálogos, NPCs e companheiros**: diálogos em ink lendo e escrevendo as
  flags de história do save; NPCs e companheiros caricatos; NPC entregando itens via
  `PlayerEquipment.grant` (o amigo que guardou o equipamento do herói). **Depende de autorização**
  para adicionar a biblioteca `inkjs`.
- [ ] **Tarefa 12 — Cenários .glb com assets CC0**: novo tipo de fase `"glb"` no `level` do
  manifesto (novo `case` no `EpisodeLoader` + construtor em `world/`), com colisores.
- [ ] **Tarefa 13 — Conteúdo do s01e01 "Vândalos na Colheita"**: a fazenda, a colheita, os
  vândalos e as primeiras escolhas gravadas em flags de história.

Fora do escopo por enquanto: plataforma web (login, catálogo, save na nuvem) e pagamentos.
