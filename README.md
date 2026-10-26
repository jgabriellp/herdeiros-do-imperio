# Herdeiros do Império

Jogo 3D medieval de ação em terceira pessoa para navegador, lançado em episódios.
Babylon.js + Havok + TypeScript + Vite.

## Como rodar

```bash
npm install
npm run dev       # servidor de desenvolvimento (http://localhost:5173)
npm run build     # checagem de tipos + build de produção em dist/
npm run preview   # serve o build de produção
```

Escolha o episódio pela URL: `http://localhost:5173/?ep=s00e00` (padrão: `s00e00`).

## Controles (estado atual)

| Tecla / ação          | Efeito                                   |
| --------------------- | ---------------------------------------- |
| Arrastar com o mouse  | Girar a câmera (câmera de teste)         |
| Roda do mouse         | Zoom                                     |
| F9                    | Abrir/fechar o Inspector (só em dev)     |

Os controles do personagem e do combate chegam nas próximas tarefas.

## Estrutura de pastas

```
src/main.ts           lançador: lê ?ep=, consulta o catálogo e chama startGame
src/engine/           motor único, sem lógica de episódio
src/shared/types/     tipos puros (config, eventos, save, manifesto)
public/episodes/      pacotes de conteúdo (um por pasta) + catalog.json
```

Mais detalhes de arquitetura em [CLAUDE.md](CLAUDE.md).

## Como criar um pacote de episódio

1. Crie a pasta `public/episodes/sTTeEE-nome-curto/`.
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
     "spawnPoint": { "x": 0, "y": 1, "z": 0 },
     "level": { "type": "procedural", "file": "level.json" },
     "encounters": "encounters.json",
     "checkpoints": [{ "id": "start", "position": { "x": 0, "y": 1, "z": 0 } }]
   }
   ```
   - `id` deve ser `sTTeEE` e bater com `season`/`episode`.
   - `level` e `encounters` são opcionais. Sem `level`, o episódio aparece como "em produção".
   - `requires` é apenas informativo para quem abre o jogo; o motor não bloqueia.
   - Caminhos de arquivo são relativos à pasta do pacote.
3. Crie o `level.json` (tipo `procedural`). Veja o exemplo em `s00e00-sandbox/level.json`:
   chão (`ground`), cores do céu (`sky`), sol e luz ambiente (`lighting`) e `obstacles`.
   Cada obstáculo é `box` (com `size`) ou `cylinder` (com `diameter` e `height`).
   `position` é o **centro** do objeto, `mass > 0` o torna dinâmico, e cores são `"#rrggbb"`.
4. Crie o `encounters.json` com a lista `enemies` (`id`, `type`, `position`,
   `stats: { health, damage, speed }`).
5. Registre o episódio em `public/episodes/catalog.json`:
   `{ "id": "s01e02", "folder": "s01e02-nome-curto" }`.
6. Abra `?ep=s01e02`. Erros de validação aparecem no console e na tela, com o caminho exato
   do campo problemático.
