import { PhysicsEngineV2, PhysicsRaycastResult, Vector3, type Scene } from "@babylonjs/core";
import { CollisionLayers } from "../core/CollisionLayers";
import type { PerceptionConfig } from "./EnemyConfig";

/** O que o inimigo precisa saber do jogador para percebê-lo. */
export interface StealthTarget {
  readonly feetPosition: Readonly<Vector3>;
  readonly isAlive: boolean;
  /** Raio (m) do barulho dos passos neste quadro (0 = silencioso). */
  readonly footstepNoiseRadius: number;
  /** Agachado: mais difícil de ver. */
  readonly stealthVisionRangeFactor: number;
  readonly stealthDetectionTimeFactor: number;
}

/** Um corpo no chão que pode ser encontrado. */
export interface Corpse {
  readonly feetPosition: Readonly<Vector3>;
}

/** Corpo do inimigo dono da percepção (olhos e direção). */
export interface PerceiverBody {
  readonly feetPosition: Readonly<Vector3>;
  readonly facingYaw: number;
}

/** O que bloqueia a visão: cenário e objetos (não personagens). */
const SIGHT_BLOCKERS = CollisionLayers.WORLD | CollisionLayers.PROP;
/** Altura do ponto observado no jogador (peito) e num corpo caído. */
const PLAYER_CHEST = 1.1;
const CORPSE_HEIGHT = 0.3;

/**
 * Percepção de um inimigo: visão (cone + alcance + linha de visão) e audição.
 * Mantém um medidor de certeza 0..1 sobre o jogador e o último ponto suspeito.
 * Quem decide o que fazer (investigar, alertar) é o Enemy, a partir destes dados.
 */
export class Perception {
  /** Certeza de que há alguém ali: ≥ suspiciousThreshold = desconfiado; 1 = alerta. */
  meter = 0;
  /** Vê o jogador neste quadro. */
  seesPlayer = false;
  /** Segundos desde a última vez que viu o jogador. */
  timeSinceSeen = Infinity;
  readonly lastSeenPlayer = new Vector3();
  /** Ponto suspeito mais recente (barulho, corpo, vulto) ainda não tratado. */
  private pendingStimulus: Vector3 | null = null;
  private readonly knownCorpses = new Set<Corpse>();
  private readonly eye = new Vector3();
  private readonly point = new Vector3();
  private readonly hit = new PhysicsRaycastResult();

  constructor(
    private readonly scene: Scene,
    private readonly config: PerceptionConfig,
    private readonly self: PerceiverBody,
    private readonly player: StealthTarget,
  ) {}

  get suspicious(): boolean {
    return this.meter >= this.config.suspiciousThreshold;
  }

  get certain(): boolean {
    return this.meter >= 1;
  }

  /**
   * @param alerted já em combate: só acompanha se vê o jogador (para perdê-lo de vista).
   * @param corpses corpos de aliados para encontrar.
   */
  update(dt: number, alerted: boolean, corpses: Iterable<Corpse>): void {
    const cfg = this.config;
    const p = this.player.feetPosition;
    this.seesPlayer = false;

    if (this.player.isAlive) {
      this.point.set(p.x, p.y + PLAYER_CHEST, p.z);
      const range = cfg.visionRange * this.player.stealthVisionRangeFactor;
      const dist = this.canSee(this.point, range);
      if (dist !== null) {
        this.seesPlayer = true;
        this.timeSinceSeen = 0;
        this.lastSeenPlayer.copyFrom(p);
        if (!alerted) {
          // Mais perto = certeza mais rápida; agachado demora mais.
          const t = Math.min(1, Math.max(0, (dist - cfg.peripheralRange) / Math.max(0.01, range - cfg.peripheralRange)));
          const detectTime = (cfg.detectTimeNear + (cfg.detectTimeFar - cfg.detectTimeNear) * t) * this.player.stealthDetectionTimeFactor;
          this.meter = Math.min(1, this.meter + dt / detectTime);
          if (this.suspicious) this.setStimulus(p);
        }
      }
    }
    if (!this.seesPlayer) {
      this.timeSinceSeen += dt;
      if (!alerted) this.meter = Math.max(0, this.meter - cfg.decayPerSecond * dt);
    }

    // Passos: ouvir o jogador dá uma direção para investigar (mas não certeza).
    if (!alerted && this.player.isAlive && this.player.footstepNoiseRadius > 0) {
      const d = Vector3.Distance(this.self.feetPosition, p);
      if (d <= this.player.footstepNoiseRadius) this.hearNoise(p);
    }

    // Corpos de aliados à vista: desconfia e vai ver (cada corpo é "encontrado" uma vez).
    if (!alerted) {
      for (const corpse of corpses) {
        if (this.knownCorpses.has(corpse)) continue;
        const c = corpse.feetPosition;
        this.point.set(c.x, c.y + CORPSE_HEIGHT, c.z);
        if (this.canSee(this.point, cfg.visionRange) === null) continue;
        this.knownCorpses.add(corpse);
        this.raiseToSuspicious(c);
      }
    }
  }

  /** Ouviu um barulho em `at`: fica desconfiado e quer investigar o ponto. */
  hearNoise(at: Readonly<Vector3>): void {
    this.raiseToSuspicious(at);
  }

  /** Sabe exatamente onde o jogador está (foi atingido, ouviu o grito de um aliado). */
  becomeCertain(playerAt: Readonly<Vector3>): void {
    this.meter = 1;
    this.timeSinceSeen = 0;
    this.lastSeenPlayer.copyFrom(playerAt);
    this.pendingStimulus = null;
  }

  /** Esquece tudo (ex.: voltou ao posto quando o jogador renasceu). */
  reset(): void {
    this.meter = 0;
    this.seesPlayer = false;
    this.timeSinceSeen = Infinity;
    this.pendingStimulus = null;
  }

  /** Retira o ponto suspeito pendente (cada estímulo é tratado uma vez). */
  takeStimulus(): Vector3 | null {
    const s = this.pendingStimulus;
    this.pendingStimulus = null;
    return s;
  }

  /** Distância até `target` se ele estiver visível (cone/alcance/linha de visão); senão null. */
  private canSee(target: Readonly<Vector3>, range: number): number | null {
    const cfg = this.config;
    const f = this.self.feetPosition;
    this.eye.set(f.x, f.y + cfg.eyeHeight, f.z);
    const dx = target.x - this.eye.x;
    const dz = target.z - this.eye.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range) return null;
    if (dist > cfg.peripheralRange) {
      const yaw = this.self.facingYaw;
      const dot = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / Math.max(dist, 1e-6);
      if (dot < Math.cos((cfg.visionHalfAngleDeg * Math.PI) / 180)) return null;
    }
    const physics = this.scene.getPhysicsEngine();
    if (physics instanceof PhysicsEngineV2) {
      physics.raycastToRef(this.eye, target as Vector3, this.hit, { collideWith: SIGHT_BLOCKERS });
      if (this.hit.hasHit) return null;
    }
    return dist;
  }

  private raiseToSuspicious(at: Readonly<Vector3>): void {
    this.meter = Math.max(this.meter, this.config.suspiciousThreshold + 0.05);
    this.setStimulus(at);
  }

  private setStimulus(at: Readonly<Vector3>): void {
    if (!this.pendingStimulus) this.pendingStimulus = new Vector3();
    this.pendingStimulus.copyFrom(at);
  }
}
