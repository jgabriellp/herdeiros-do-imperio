# Herdeiros do Império

Jogo 3D medieval de ação em terceira pessoa para navegador, lançado em episódios.
Babylon.js 9 + física Havok + TypeScript (strict) + Vite.

Um **motor único** (`src/engine`) carrega **pacotes de episódio** (`public/episodes/`).
Episódios são só dados: nenhuma lógica de episódio fica no motor.

## Como rodar

Requer Node.js 20 ou mais novo.

```bash
npm install
npm run dev       # servidor de desenvolvimento (http://localhost:5173)
npm run build     # checagem de tipos + build de produção em dist/
npm run preview   # serve o build de produção
```

Escolha o episódio pela URL: `http://localhost:5173/?ep=s00e00` (padrão: `s00e00`).

| Episódio | Pasta                          | Situação                                   |
| -------- | ------------------------------ | ------------------------------------------ |
| `s00e00` | `s00e00-sandbox`               | Campo de Treino: teste de mecânicas        |
| `s01e01` | `s01e01-vandalos-na-colheita`  | Só o manifesto (aparece "em produção")     |

## Controles

Clique no jogo para capturar o mouse; Esc solta.

| Tecla / ação          | Efeito                                                     |
| --------------------- | ---------------------------------------------------------- |
| W A S D / setas       | Andar (relativo à câmera)                                  |
| Shift                 | Correr                                                     |
| Espaço                | Pular                                                      |
| Mouse                 | Girar a câmera                                             |
| Roda do mouse         | Aproximar/afastar a câmera                                 |
| Botão esquerdo        | Soco; clique de novo no ritmo para um combo de 3           |
| F                     | Chute (mais lento, mais dano, empurra)                     |
| C                     | Esquiva (breve invulnerabilidade, gasta stamina)           |
| Q / botão do meio     | Travar/destravar a mira no inimigo à frente; sem alvo, recentraliza a câmera |

A esquiva fica no **C**, e não no Ctrl, porque Ctrl+W fecha a aba do navegador e a página
não consegue impedir.

### Atalhos de desenvolvimento (só em `npm run dev`)

| Tecla | Efeito                                      |
| ----- | ------------------------------------------- |
| F6    | Derrotar todos os inimigos (testa a conclusão do episódio) |
| F7    | Mostrar/ocultar as hitboxes dos golpes      |
| F8    | Simular um golpe no jogador                 |
| F9    | Abrir/fechar o Inspector do Babylon         |

No modo dev também aparecem: o painel de estado (canto superior direito), marcadores do spawn
(anel verde) e dos checkpoints (discos azuis), e o log de todos os eventos no console.
No console, `herdeiros.switchEpisode("s01e01")` troca de episódio sem recarregar a página.

## O que o sandbox testa

1. Ande até a arena: passar pelo disco azul salva o checkpoint ("Checkpoint salvo").
2. Os três vândalos (fraco, rápido e bruto) atacam; no máximo dois por vez, os outros rondam.
   Antes de cada golpe a clava brilha em amarelo: hora de esquivar.
3. Se a vida acabar, você renasce no último checkpoint.
4. Derrote todos: aparece "Episódio concluído", o episódio fica marcado no save e o evento
   `episodeCompleted` é emitido.

Para recomeçar do zero, apague a chave `herdeiros-do-imperio:save` do localStorage.

## Estrutura de pastas

```
src/
  main.ts                 lançador local: lê ?ep=, consulta o catálogo, monta o GameConfig e chama startGame
  engine/
    startGame.ts          ponto de entrada único do motor
    core/                 Game (ciclo de vida), GameplaySystems (liga os sistemas), GameLoop, GameEvents,
                          CanvasHost, Physics, CollisionLayers, input/ (InputManager e fontes de input)
    character/            CharacterMotor: física de personagem (jogador e inimigos)
    player/               Player, máquina de estados (states/), câmera em 3ª pessoa, visual da cápsula
    combat/               CombatConfig (todos os números), Hitbox, DamageSystem, TargetLock
    enemies/              Enemy, IA (states/), AttackCoordinator, EnemyFactory, EnemyConfig (tipos)
    progress/             checkpoints, morte/renascimento, conclusão do episódio
    vfx/                  hit stop, partículas de impacto, tremida de câmera
    ui/                   HUD (Babylon GUI), barras dos inimigos, marcador da mira, mensagens
    world/                montagem da fase procedural (céu, luz, chão, obstáculos)
    episodes/             EpisodeLoader e validação dos JSONs
    save/                 SaveManager, LocalSaveProvider, migrações
  shared/types/           tipos puros (sem Babylon): GameConfig, eventos, save, manifesto
public/episodes/
  catalog.json            id do episódio → pasta (lido só pelo main.ts)
  s00e00-sandbox/         manifest.json, level.json, encounters.json
  s01e01-vandalos-na-colheita/  manifest.json
```

A arquitetura completa e as decisões do projeto estão no [CLAUDE.md](CLAUDE.md).

## Como criar um pacote de episódio

1. Crie a pasta `public/episodes/sTTeEE-nome-curto/` (ex.: `s01e02-ponte-quebrada`).
2. Crie o `manifest.json`:
   ```json
   {
     "formatVersion": 1,
     "id": "s01e02",
     "season": 1,
     "episode": 2,
     "title": "Título do Episódio",
     "description": "Opcional.",
     "version": "0.1.0",
     "requires": ["s01e01"],
     "spawnPoint": { "x": 0, "y": 0, "z": 0 },
     "level": { "type": "procedural", "file": "level.json" },
     "encounters": "encounters.json",
     "checkpoints": [
       { "id": "start", "position": { "x": 0, "y": 0, "z": 0 } },
       { "id": "ponte", "position": { "x": 0, "y": 0, "z": 20 } }
     ]
   }
   ```
   - `id` deve ser `sTTeEE` e bater com `season` e `episode`.
   - `spawnPoint` e `checkpoints[].position` são a posição dos **pés** do jogador (`y: 0` = no chão).
   - Passar a até 2 m de um checkpoint o salva. O jogador renasce no último checkpoint salvo.
   - `level` e `encounters` são opcionais. Sem `level`, o episódio aparece como "em produção".
   - `requires` é informativo para quem abre o jogo (hoje o `main.ts`); o motor não bloqueia.
   - Caminhos de arquivo são relativos à pasta do pacote (sem `/` inicial e sem `..`).
3. Crie o `level.json` (tipo `procedural`); use `s00e00-sandbox/level.json` como exemplo:
   - `ground`: largura, profundidade e cor do chão;
   - `sky`: cor do topo e do horizonte;
   - `lighting`: direção e intensidade do sol, intensidade da luz ambiente;
   - `obstacles`: cada um é `box` (com `size`) ou `cylinder` (com `diameter` e `height`).
     `position` é o **centro** do objeto, `rotationY` é opcional (só em `box`), `mass > 0`
     o torna dinâmico (cai e pode ser empurrado) e cores são `"#rrggbb"`.
4. Crie o `encounters.json`:
   ```json
   {
     "formatVersion": 1,
     "enemies": [
       { "id": "vandalo_1", "type": "vandalo", "position": { "x": 0, "y": 0, "z": 10 },
         "stats": { "health": 60, "damage": 10, "speed": 3.5 } }
     ]
   }
   ```
   Os tipos disponíveis ficam em `src/engine/enemies/EnemyConfig.ts`; hoje existe só `vandalo`.
   O episódio é concluído quando todos os inimigos são derrotados.
5. Registre o episódio em `public/episodes/catalog.json`:
   `{ "id": "s01e02", "folder": "s01e02-ponte-quebrada" }`.
6. Abra `?ep=s01e02`. Erros de validação aparecem no console e na tela, com o caminho exato
   do campo problemático (ex.: `manifest.json.checkpoints[1].position.x: esperado número`).

## Integração futura com a plataforma

O motor não lê a URL nem o localStorage. Quem o inicia passa tudo por `startGame(config)`:

```ts
const game = startGame({
  episodeId: "s00e00",
  assetBaseUrl: "https://cdn.exemplo/episodes/s00e00-sandbox/",
  saveProvider: meuProviderDeNuvem, // implementa SaveProvider
  mode: "production",
  container: document.getElementById("jogo")!,
});
game.events.on("episodeCompleted", ({ episodeId }) => { /* ... */ });
await game.dispose(); // fecha o episódio sem recarregar a página
```

Eventos emitidos: `episodeLoaded`, `checkpointReached`, `saveChanged`, `episodeCompleted`
e `fatalError` (com `code`).
