import type { Scene, ShadowGenerator } from "@babylonjs/core";
import type { EncountersData, EpisodeManifest, PickupDef, PlayerAttributes, Vec3Data } from "../../shared/types";
import { computeArrowShot } from "../combat/arrowAim";
import { ArrowSystem } from "../combat/ArrowSystem";
import { DEFAULT_COMBAT_CONFIG } from "../combat/CombatConfig";
import { DamageSystem } from "../combat/DamageSystem";
import { HitboxDebugView } from "../combat/HitboxDebugView";
import { EnemyManager } from "../enemies/EnemyManager";
import { PickupSystem } from "../items/PickupSystem";
import { DEFAULT_CAMERA_CONFIG } from "../player/CameraConfig";
import { Player } from "../player/Player";
import { PlayerEquipment } from "../player/PlayerEquipment";
import { ThirdPersonCamera } from "../player/ThirdPersonCamera";
import { CheckpointSystem } from "../progress/CheckpointSystem";
import { EpisodeCompletion } from "../progress/EpisodeCompletion";
import { RespawnSystem } from "../progress/RespawnSystem";
import type { SaveManager } from "../save/SaveManager";
import { ControlsHint } from "../ui/ControlsHint";
import { DevStatsPanel } from "../ui/DevStatsPanel";
import { EnemyHealthBars } from "../ui/EnemyHealthBars";
import { Hud } from "../ui/Hud";
import { TargetMarker } from "../ui/TargetMarker";
import { CameraShake } from "../vfx/CameraShake";
import { HitStop } from "../vfx/HitStop";
import { createImpactFeedback } from "../vfx/ImpactFeedback";
import { ImpactParticles } from "../vfx/ImpactParticles";
import type { CanvasHost } from "./CanvasHost";
import { DevHotkeys } from "./DevHotkeys";
import type { DisposeStack } from "./DisposeStack";
import type { GameEvents } from "./GameEvents";
import type { GameLoop } from "./GameLoop";
import { DEFAULT_INPUT_SETTINGS, DEFAULT_KEYBOARD_MOUSE_BINDINGS } from "./input/InputBindings";
import { InputManager } from "./input/InputManager";
import { KeyboardMouseSource } from "./input/KeyboardMouseSource";

const CONTROLS_HINT = [
  "Clique para jogar",
  "WASD mover · Shift correr · Espaço pular · Mouse câmera · Roda zoom",
  "Clique golpe (combo x3) · F chute · C esquiva · Botão direito bloquear (escudo) ou mirar (arco)",
  "1 punhos · 2 espada e escudo · 3 arco (segure o clique para puxar a corda)",
  "Q / botão do meio travar mira · Esc soltar o mouse",
];

export interface GameplayDeps {
  scene: Scene;
  host: CanvasHost;
  loop: GameLoop;
  disposables: DisposeStack;
  shadows: ShadowGenerator | null;
  manifest: EpisodeManifest;
  /** Onde o jogador começa (checkpoint salvo ou spawn do manifesto). */
  spawn: Vec3Data;
  playerAttributes: PlayerAttributes;
  encounters: EncountersData;
  /** Itens do mapa (level.json). */
  pickups: readonly PickupDef[];
  save: SaveManager;
  events: GameEvents;
  devMode: boolean;
}

/**
 * Cria e liga os sistemas de jogo de um episódio (input, jogador, câmera, combate,
 * inimigos, efeitos, HUD, progresso, ferramentas de dev) e registra cada um
 * no GameLoop e no DisposeStack.
 */
export function createGameplay(deps: GameplayDeps): void {
  const { scene, host, loop, disposables, manifest } = deps;
  const combat = DEFAULT_COMBAT_CONFIG;

  const input = new InputManager();
  input.addSource(new KeyboardMouseSource(host.canvas, DEFAULT_KEYBOARD_MOUSE_BINDINGS, DEFAULT_INPUT_SETTINGS));
  disposables.add("input", () => input.dispose());

  const damage = new DamageSystem();
  disposables.add("damageSystem", () => damage.dispose());

  const hud = new Hud(scene, combat.dodge.staminaCost);
  disposables.add("hud", () => hud.dispose());

  // Equipamento vem do save; é por ele que o jogador recebe itens (mapa hoje, NPCs depois).
  const equipment = new PlayerEquipment(deps.save);

  // Flechas: projéteis que passam pelo mesmo DamageSystem dos golpes.
  const arrows = new ArrowSystem(scene, damage, combat.bow);
  disposables.add("arrows", () => arrows.dispose());

  // Criados depois do jogador, mas usados pelos callbacks dele.
  let camera: ThirdPersonCamera | null = null;
  let respawn: RespawnSystem | null = null;
  let shooter: Player | null = null;
  const player = new Player({
    scene,
    input,
    damage,
    combat,
    attributes: deps.playerAttributes,
    equipment,
    spawn: deps.spawn,
    shadows: deps.shadows,
    events: {
      onRecenterRequest: (yaw) => camera?.recenter(yaw),
      onWeaponChanged: (label) => hud.notify(label, 1.2),
    },
    onDied: () => respawn?.playerDied(),
    onFireArrow: (charge, aimed) => {
      if (!shooter || !camera) return;
      arrows.spawn(
        computeArrowShot({
          charge,
          aimed,
          bow: combat.bow,
          power: equipment.bow?.powerMultiplier ?? 1,
          feet: shooter.feetPosition,
          facingYaw: shooter.motor.facingYaw,
          cameraPosition: camera.position,
          cameraDirection: camera.aimDirection,
          lockTarget: shooter.lock.target,
          arrows,
        }),
      );
    },
  });
  shooter = player;
  disposables.add("player", () => player.dispose());

  // Inimigos depois do jogador: a IA precisa saber quem perseguir.
  const enemies = new EnemyManager({ scene, shadows: deps.shadows, damage, player });
  disposables.add("enemies", () => enemies.dispose());
  enemies.spawnAll(deps.encounters.enemies);

  const cam = new ThirdPersonCamera(scene, player.motor, input, DEFAULT_CAMERA_CONFIG, player.motor.facingYaw);
  camera = cam;
  disposables.add("camera", () => cam.dispose());

  // --- impacto: hit stop, partículas e tremida a cada acerto ---
  const hitStop = new HitStop(scene);
  disposables.add("hitStop", () => hitStop.dispose());
  loop.setFreezeSource(() => hitStop.frozen);
  const particles = new ImpactParticles(scene);
  disposables.add("impactParticles", () => particles.dispose());
  const shake = new CameraShake();
  cam.setShakeSource(shake);
  const stopFeedback = damage.onHit(createImpactFeedback(combat, hitStop, particles, shake));

  // --- progresso: checkpoints, morte/renascimento, conclusão do episódio ---
  const checkpoints = new CheckpointSystem(
    manifest.id,
    manifest.checkpoints,
    manifest.spawnPoint,
    deps.save,
    deps.events,
    (cp) => {
      player.controller.setRespawnPoint(cp.position);
      hud.notify("Checkpoint salvo");
    },
  );
  player.controller.setRespawnPoint(checkpoints.respawnPoint);

  respawn = new RespawnSystem(combat.death.respawnDelay, {
    onDeath: () => hud.showDeath("Você caiu", "Voltando ao último checkpoint..."),
    respawnPoint: () => checkpoints.respawnPoint,
    respawn: (point) => {
      player.respawn(point);
      enemies.resetAliveToSpawn();
      cam.snapBehind(player.motor.facingYaw);
      hud.hideDeath();
      hud.notify("De volta ao checkpoint");
    },
  });

  const pickups = new PickupSystem(scene, manifest.id, deps.pickups, deps.save, (itemId) => {
    const result = equipment.grant(itemId);
    if (!result) return;
    hud.notify(result.equipped ? `Você pegou: ${result.item.name}` : `${result.item.name} foi para o inventário`, 3);
  });
  disposables.add("pickups", () => pickups.dispose());

  const completion = new EpisodeCompletion(manifest.id, deps.save, deps.events, () =>
    hud.announce("Episódio concluído", manifest.title, 6),
  );

  // --- marcador da mira, barras de vida flutuantes, dica de controles ---
  const marker = new TargetMarker(scene);
  disposables.add("targetMarker", () => marker.dispose());
  const enemyBars = new EnemyHealthBars(hud.ui);
  disposables.add("enemyHealthBars", () => enemyBars.dispose());
  const hint = new ControlsHint(host.root, host.canvas, CONTROLS_HINT);
  disposables.add("controlsHint", () => hint.dispose());

  const removers = [
    stopFeedback,
    loop.add((dt) => input.update(dt), "input"),
    loop.add((dt) => hitStop.update(dt), "input"),
    loop.add((dt) => player.update(dt, cam.yaw), "update"),
    loop.add((dt) => enemies.update(dt), "update"),
    loop.add((dt) => arrows.update(dt), "update"),
    loop.add((dt) => {
      if (player.isAlive) pickups.update(dt, player.feetPosition);
      checkpoints.update(player.feetPosition, player.isAlive);
      respawn?.update(dt);
      completion.update(enemies.spawnedCount, enemies.aliveCount);
    }, "update"),
    loop.add((dt) => {
      shake.update(dt);
      cam.update(dt, player.lock.target, player.isAiming);
      player.fadeForCamera(cam.distance, DEFAULT_CAMERA_CONFIG.fadeStartDistance, DEFAULT_CAMERA_CONFIG.fadeEndDistance);
      marker.update(dt, player.lock.target);
      enemyBars.update(enemies.all);
      hud.setWeapon(equipment.label, equipment.canSwitch ? equipment.switchHint : "");
      hud.setAim(player.isAiming, player.machine.aimState.currentCharge);
      hud.update(dt, player.stats);
    }, "late"),
  ];

  if (deps.devMode) removers.push(...createDevTools(deps, player, enemies));
  disposables.add("loopSystems", () => removers.forEach((remove) => remove()));
}

/** Painel de estado, hitboxes (F7), golpe simulado no jogador (F8) e matar todos os inimigos (F6). */
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
        "F6",
        () => {
          // Atalho para testar a conclusão do episódio sem lutar.
          for (const e of enemies.all) {
            e.receiveHit({ damage: 9999, directionX: 0, directionZ: 1, knockback: 0, hitStun: 0, heavy: false });
          }
        },
      ],
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
        `arma:    ${player.equipment.label} (${player.equipment.mode})`,
        `mira:    ${player.isAiming ? `sim · tensão ${(player.machine.aimState.currentCharge * 100).toFixed(0)}%` : "não"}`,
        `alvo:    ${lock.target ? `${lock.target.id}` : "-"}`,
        `inimigos vivos: ${enemies.aliveCount} · atacando: ${enemies.coordinator.activeAttackers}`,
        ...enemies.all.map((e) => `  ${e.id}: ${e.currentHealth.toFixed(0)}/${e.stats.health} ${e.stateLabel}`),
        "F6 matar inimigos · F7 hitboxes · F8 levar golpe · F9 inspector",
      ]);
    }, "late"),
  ];
}
