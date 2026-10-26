import type { CheckpointDef, Vec3Data } from "../../shared/types";
import type { GameEvents } from "../core/GameEvents";
import type { SaveManager } from "../save/SaveManager";

/** Distância (horizontal) para ativar um checkpoint ao passar por ele. */
const ACTIVATION_RADIUS = 2;

/**
 * Checkpoints do manifesto: passar perto de um checkpoint novo salva o progresso
 * e emite "checkpointReached". Também diz onde o jogador renasce.
 */
export class CheckpointSystem {
  constructor(
    private readonly episodeId: string,
    private readonly checkpoints: readonly CheckpointDef[],
    private readonly fallbackSpawn: Vec3Data,
    private readonly save: SaveManager,
    private readonly events: GameEvents,
    private readonly onReached: (checkpoint: CheckpointDef) => void,
  ) {}

  /** Posição do último checkpoint salvo neste episódio (ou o spawn). */
  get respawnPoint(): Vec3Data {
    const id = this.save.current.currentCheckpointId;
    return this.checkpoints.find((cp) => cp.id === id)?.position ?? this.fallbackSpawn;
  }

  update(playerFeet: Readonly<Vec3Data>, playerAlive: boolean): void {
    if (!playerAlive) return;
    const currentId = this.save.current.currentCheckpointId;
    for (const cp of this.checkpoints) {
      if (cp.id === currentId) continue;
      const dx = cp.position.x - playerFeet.x;
      const dz = cp.position.z - playerFeet.z;
      if (dx * dx + dz * dz > ACTIVATION_RADIUS * ACTIVATION_RADIUS) continue;
      if (Math.abs(cp.position.y - playerFeet.y) > ACTIVATION_RADIUS) continue;

      this.save.setCurrent(this.episodeId, cp.id);
      this.events.emit("checkpointReached", { episodeId: this.episodeId, checkpointId: cp.id });
      this.onReached(cp);
      return;
    }
  }
}
