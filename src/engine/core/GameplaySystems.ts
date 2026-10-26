import type { Scene, ShadowGenerator } from "@babylonjs/core";
import type { EncountersData, PlayerAttributes, Vec3Data } from "../../shared/types";
import { DEFAULT_COMBAT_CONFIG } from "../combat/CombatConfig";
import { DamageSystem } from "../combat/DamageSystem";
import { HitboxDebugView } from "../combat/HitboxDebugView";
import { EnemyManager } from "../enemies/EnemyManager";
import { DEFAULT_CAMERA_CONFIG } from "../player/CameraConfig";
import { Player } from "../player/Player";
import { ThirdPersonCamera } from "../player/ThirdPersonCamera";
import { ControlsHint } from "../ui/ControlsHint";
import { DevStatsPanel } from "../ui/DevStatsPanel";
import { TargetMarker } from "../ui/TargetMarker";
import { HitStop } from "../vfx/HitStop";
import type { CanvasHost } from "./CanvasHost";
import { DevHotkeys } from "./DevHotkeys";
import type { DisposeStack } from "./DisposeStack";
import type { GameLoop } from "./GameLoop";
import { DEFAULT_INPUT_SETTINGS, DEFAULT_KEYBOARD_MOUSE_BINDINGS } from "./input/InputBindings";
import { InputManager } from "./input/InputManager";
import { KeyboardMouseSource } from "./input/KeyboardMouseSource";

const CONTROLS_HINT = [
  "Clique para jogar",
  "WASD mover · Shift correr · Espaço pular · Mouse câmera · Roda zoom",
  "Clique soco (combo x3) · F chute · C esquiva · Q / botão do meio travar mira · Esc soltar o mouse",
];

export interface GameplayDeps {
  scene: Scene;
  host: CanvasHost;
  loop: GameLoop;
  disposables: DisposeStack;
  shadows: ShadowGenerator | null;
  spawn: Vec3Data;
  playerAttributes: PlayerAttributes;
  encounters: EncountersData;
  devMode: boolean;
}

/**
 * Cria e liga os sistemas de jogo de um episódio (input, jogador, câmera,
 * combate, inimigos, ferramentas de dev) e registra cada um no GameLoop e no DisposeStack.
 */
export function createGameplay(deps: GameplayDeps): void {
  const { scene, host, loop, disposables } = deps;
  const combat = DEFAULT_COMBAT_CONFIG;

  const input = new InputManager();
  input.addSource(new KeyboardMouseSource(host.canvas, DEFAULT_KEYBOARD_MOUSE_BINDINGS, DEFAULT_INPUT_SETTINGS));
  disposables.add("input", () => input.dispose());

  const damage = new DamageSystem();
  disposables.add("damageSystem", () => damage.dispose());

  // A câmera é criada depois do jogador, mas o jogador pode pedir recentralização a qualquer momento.
  let camera: ThirdPersonCamera | null = null;
  const player = new Player({
    scene,
    input,
    damage,
    combat,
    attributes: deps.playerAttributes,
    spawn: deps.spawn,
    shadows: deps.shadows,
    events: { onRecenterRequest: (yaw) => camera?.recenter(yaw) },
  });
  disposables.add("player", () => player.dispose());

  // Inimigos depois do jogador: a IA precisa saber quem perseguir.
  const enemies = new EnemyManager({ scene, shadows: deps.shadows, damage, player });
  disposables.add("enemies", () => enemies.dispose());
  enemies.spawnAll(deps.encounters.enemies);

  // Hit stop: todo acerto (do jogador ou nele) congela a lógica por um instante.
  const hitStop = new HitStop(scene);
  disposables.add("hitStop", () => hitStop.dispose());
  loop.setFreezeSource(() => hitStop.frozen);
  const stopOnHit = damage.onHit((e) => hitStop.trigger(e.hit.heavy ? combat.hitStop.heavy : combat.hitStop.light));

  const cam = new ThirdPersonCamera(scene, player.motor, input, DEFAULT_CAMERA_CONFIG, player.motor.facingYaw);
  camera = cam;
  disposables.add("camera", () => cam.dispose());

  const marker = new TargetMarker(scene);
  disposables.add("targetMarker", () => marker.dispose());

  const hint = new ControlsHint(host.root, host.canvas, CONTROLS_HINT);
  disposables.add("controlsHint", () => hint.dispose());

  const removers = [
    stopOnHit,
    loop.add((dt) => input.update(dt), "input"),
    loop.add((dt) => hitStop.update(dt), "input"),
    loop.add((dt) => player.update(dt, cam.yaw), "update"),
    loop.add((dt) => enemies.update(dt), "update"),
    loop.add((dt) => {
      cam.update(dt, player.lock.target);
      player.fadeForCamera(cam.distance, DEFAULT_CAMERA_CONFIG.fadeStartDistance, DEFAULT_CAMERA_CONFIG.fadeEndDistance);
      marker.update(dt, player.lock.target);
    }, "late"),
  ];

  if (deps.devMode) removers.push(...createDevTools(deps, player, enemies));
  disposables.add("loopSystems", () => removers.forEach((remove) => remove()));
}

/** Painel de estado, hitboxes (F7) e golpe simulado no jogador (F8). */
function createDevTools(deps: GameplayDeps, player: Player, enemies: EnemyManager): (() => void)[] {
  const { scene, host, disposables } = deps;

  const hitboxView = new HitboxDebugView(scene, player.hitbox);
  disposables.add("hitboxDebugView", () => hitboxView.dispose());

  const panel = new DevStatsPanel(host.root);
  disposables.add("devStatsPanel", () => panel.dispose());

  const hotkeys = new DevHotkeys(
    new Map([
      ["F7", () => (hitboxView.enabled = !hitboxView.enabled)],
      [
        "F8",
        () => {
          // Golpe vindo da frente do jogador: testa HitStun, empurrão e i-frames da esquiva.
          const yaw = player.motor.facingYaw;
          const outcome = player.receiveHit({
            damage: 10,
            directionX: -Math.sin(yaw),
            directionZ: -Math.cos(yaw),
            knockback: 6,
            hitStun: 0.4,
            heavy: false,
          });
          console.info(`[dev] golpe simulado no jogador: ${outcome}`);
        },
      ],
    ]),
  );
  disposables.add("devHotkeys", () => hotkeys.dispose());

  return [
    deps.loop.add(() => {
      hitboxView.update();
      const { stats, machine, lock } = player;
      const state = machine.current.name;
      panel.show([
        `estado:  ${state === "Attack" ? `Attack (${machine.attackState.currentAttack})` : state}`,
        `vida:    ${stats.health.toFixed(0)} / ${stats.maxHealth}`,
        `stamina: ${stats.stamina.toFixed(0)} / ${stats.maxStamina}`,
        `invuln.: ${player.isInvulnerable ? "sim" : "não"}`,
        `alvo:    ${lock.target ? `${lock.target.id}` : "-"}`,
        `inimigos vivos: ${enemies.aliveCount} · atacando: ${enemies.coordinator.activeAttackers}`,
        ...enemies.all.map((e) => `  ${e.id}: ${e.currentHealth.toFixed(0)}/${e.stats.health} ${e.stateLabel}`),
        "F7 hitboxes · F8 levar golpe · F9 inspector",
      ]);
    }, "late"),
  ];
}
