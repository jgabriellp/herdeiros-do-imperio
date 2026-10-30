import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type AbstractMesh,
  type Mesh,
  type Scene,
  type ShadowGenerator,
} from "@babylonjs/core";
import { damp } from "../core/mathUtils";
import { getItem } from "../items/ItemConfig";
import { createItemMesh, type ItemMesh } from "../items/ItemMeshes";
import type { PlayerVisual, PlayerVisualState, VisualAction } from "./PlayerVisual";

const BODY_COLOR = Color3.FromHexString("#3d5a80");
const INDICATOR_COLOR = Color3.FromHexString("#f2c14e");
const LIMB_COLOR = Color3.FromHexString("#e0b48a");
const HIT_FLASH_COLOR = new Color3(0.9, 0.15, 0.1);
/** Inclinação máxima para frente ao correr (radianos): dá leitura de aceleração. */
const MAX_LEAN = 0.12;
const LEAN_SHARPNESS = 10;
const DEATH_FALL_DURATION = 0.6;
/** Transparência durante os i-frames da esquiva (leitura de "intocável"). */
const INVULNERABLE_VISIBILITY = 0.45;

/** Posições locais (pés = origem, +Z = frente) dos membros nas poses dos golpes. */
const FIST = { restZ: 0.15, pullZ: -0.05, reachZ: 0.75, height: 1.15, side: 0.22, finisherHeight: 1.3 };
const FOOT = { restY: 0.35, restZ: 0.1, kneeY: 0.6, kneeZ: 0.05, kickY: 0.7, kickZ: 0.9, side: 0.12 };

/**
 * Espada: um "ombro" (pivô) gira a lâmina; rotation.x = inclinação (+ para baixo),
 * rotation.y = lado (+ direita). A mão fica à frente do ombro.
 */
const SWORD = {
  shoulder: { x: 0.3, y: 1.25, z: 0.05 },
  handForward: 0.35,
  idle: { pitch: 0.75, yaw: 0.35 },
  slashPitch: 0.15,
  slashWide: 1.5,
  overheadRaised: -1.5,
  overheadDown: 0.9,
};
/** Escudo: no braço esquerdo, erguido na frente ao bloquear, nas costas se guardado. */
const SHIELD = {
  arm: { x: -0.42, y: 1.0, z: 0.12, yaw: -0.5 },
  raised: { x: -0.06, y: 1.15, z: 0.5 },
  back: { x: 0, y: 1.0, z: -0.4 },
  impactPush: 0.12,
};

/**
 * Visual provisório: cápsula com "visor" indicando a frente, e punho/pé que
 * aparecem nos golpes. Animação procedural simples, só para dar leitura clara
 * de preparação → golpe → recuperação até chegarem os modelos Mixamo.
 */
export class CapsuleVisual implements PlayerVisual {
  readonly root: TransformNode;
  readonly shadowCasters: readonly AbstractMesh[];
  private readonly body: TransformNode;
  private readonly fist: Mesh;
  private readonly foot: Mesh;
  private readonly bodyMaterial: StandardMaterial;
  private readonly materials: StandardMaterial[] = [];
  private readonly bodyMeshes: Mesh[];
  private lean = 0;
  private cameraVisibility = 1;
  private actionVisibility = 1;
  // Equipamento visível (recriado quando o que está na mão muda).
  private readonly swordPivot: TransformNode;
  private sword: ItemMesh | null = null;
  private shield: ItemMesh | null = null;
  private swordId: string | null = null;
  private shieldId: string | null = null;

  constructor(
    private readonly scene: Scene,
    height: number,
    radius: number,
    private readonly shadows: ShadowGenerator | null = null,
  ) {
    this.root = new TransformNode("playerVisual", scene);
    // Pivô nos pés: inclinar o corpo gira a partir do chão, como uma pessoa.
    this.body = new TransformNode("playerBody", scene);
    this.body.parent = this.root;

    this.bodyMaterial = this.material(scene, "playerBodyMat", BODY_COLOR);
    const capsule = MeshBuilder.CreateCapsule("playerCapsule", { height, radius, tessellation: 16 }, scene);
    capsule.parent = this.body;
    capsule.position.y = height / 2;
    capsule.material = this.bodyMaterial;

    const visor = MeshBuilder.CreateBox("playerFacing", { width: radius * 1.2, height: 0.14, depth: 0.2 }, scene);
    visor.parent = this.body;
    visor.position.set(0, height * 0.8, radius * 0.85);
    visor.material = this.material(scene, "playerFacingMat", INDICATOR_COLOR, true);

    const limbMat = this.material(scene, "playerLimbMat", LIMB_COLOR);
    this.fist = MeshBuilder.CreateSphere("playerFist", { diameter: 0.24, segments: 8 }, scene);
    this.foot = MeshBuilder.CreateSphere("playerFoot", { diameter: 0.28, segments: 8 }, scene);
    for (const limb of [this.fist, this.foot]) {
      limb.parent = this.body;
      limb.material = limbMat;
      limb.setEnabled(false);
    }

    this.swordPivot = new TransformNode("playerSwordPivot", scene);
    this.swordPivot.parent = this.body;
    this.swordPivot.position.set(SWORD.shoulder.x, SWORD.shoulder.y, SWORD.shoulder.z);

    this.bodyMeshes = [capsule, visor, this.fist, this.foot];
    for (const m of this.bodyMeshes) m.isPickable = false;
    this.shadowCasters = this.bodyMeshes;
  }

  update(state: PlayerVisualState, dt: number): void {
    const targetLean = state.grounded && !state.action ? Math.min(state.speedRatio / 2, 1) * MAX_LEAN : 0;
    this.lean += (targetLean - this.lean) * damp(LEAN_SHARPNESS, dt);

    // Pose neutra; a ação (se houver) sobrescreve o que precisar.
    this.body.rotation.set(this.lean, 0, 0);
    this.body.scaling.set(1, 1, 1);
    this.fist.setEnabled(false);
    this.foot.setEnabled(false);
    this.bodyMaterial.emissiveColor.set(0, 0, 0);
    this.actionVisibility = 1;

    this.syncGear(state.gear.sword, state.gear.shield);
    this.poseGear(state);

    if (state.action) this.applyAction(state.action);
    this.refreshVisibility();
  }

  setVisibility(visibility: number): void {
    this.cameraVisibility = visibility;
    this.refreshVisibility();
  }

  dispose(): void {
    this.sword?.dispose();
    this.shield?.dispose();
    this.root.dispose(false, true);
    for (const m of this.materials) m.dispose();
  }

  private applyAction(action: VisualAction): void {
    switch (action.kind) {
      case "punch":
        return this.posePunch(action.comboIndex, action.phase, action.phaseProgress);
      case "kick":
        return this.poseKick(action.phase, action.phaseProgress);
      case "sword":
        return this.poseSword(action.comboIndex, action.phase, action.phaseProgress);
      case "block":
        // Firma o corpo atrás do escudo; o tranco inclina para trás.
        this.body.rotation.x = 0.08 - 0.15 * action.impact;
        return;
      case "dodge": {
        // Agacha no meio do movimento e inclina para o lado da esquiva.
        const arc = Math.sin(action.progress * Math.PI);
        this.body.scaling.y = 1 - 0.3 * arc;
        this.body.rotation.x = action.localZ * 0.6 * arc;
        this.body.rotation.z = -action.localX * 0.6 * arc;
        if (action.invulnerable) this.actionVisibility = INVULNERABLE_VISIBILITY;
        return;
      }
      case "hitStun":
        this.body.rotation.x = -0.35 * (1 - action.progress);
        if (action.progress < 0.3) this.bodyMaterial.emissiveColor.copyFrom(HIT_FLASH_COLOR);
        return;
      case "dead": {
        // Cai de costas.
        const fall = Math.min(1, action.elapsed / DEATH_FALL_DURATION);
        this.body.rotation.x = -(Math.PI / 2) * fall * fall;
        if (action.elapsed < 0.15) this.bodyMaterial.emissiveColor.copyFrom(HIT_FLASH_COLOR);
        return;
      }
    }
  }

  private posePunch(comboIndex: number, phase: string, p: number): void {
    const finisher = comboIndex >= 2;
    const side = finisher ? 0 : comboIndex % 2 === 0 ? FIST.side : -FIST.side;
    let z: number;
    let twist: number;
    if (phase === "windup") {
      z = lerp(FIST.restZ, FIST.pullZ, p);
      twist = -Math.sign(side || 1) * 0.25 * p;
    } else if (phase === "active") {
      z = lerp(FIST.pullZ, FIST.reachZ, easeOut(p));
      twist = Math.sign(side || 1) * 0.3;
    } else {
      z = lerp(FIST.reachZ, FIST.restZ, p);
      twist = Math.sign(side || 1) * 0.3 * (1 - p);
    }
    const height = finisher ? lerp(FIST.height, FIST.finisherHeight, phase === "windup" ? 0 : 1) : FIST.height;
    this.fist.position.set(side, height, z);
    this.fist.setEnabled(true);
    this.body.rotation.y = twist;
    if (finisher && phase !== "recovery") this.body.rotation.x = 0.12;
  }

  private poseKick(phase: string, p: number): void {
    let y: number;
    let z: number;
    if (phase === "windup") {
      y = lerp(FOOT.restY, FOOT.kneeY, p);
      z = lerp(FOOT.restZ, FOOT.kneeZ, p);
      this.body.rotation.x = -0.1 * p;
    } else if (phase === "active") {
      y = lerp(FOOT.kneeY, FOOT.kickY, easeOut(p));
      z = lerp(FOOT.kneeZ, FOOT.kickZ, easeOut(p));
      this.body.rotation.x = -0.2;
    } else {
      y = lerp(FOOT.kickY, FOOT.restY, p);
      z = lerp(FOOT.kickZ, FOOT.restZ, p);
      this.body.rotation.x = -0.2 * (1 - p);
    }
    this.foot.position.set(FOOT.side, y, z);
    this.foot.setEnabled(true);
  }

  /** Recria espada/escudo quando o item na mão muda. */
  private syncGear(swordId: string | null, shieldId: string | null): void {
    if (swordId !== this.swordId) {
      this.sword?.dispose();
      const item = getItem(swordId);
      this.sword = item ? this.attachItem(createItemMesh(this.scene, item, "playerSword")) : null;
      this.swordId = swordId;
    }
    if (shieldId !== this.shieldId) {
      this.shield?.dispose();
      const item = getItem(shieldId);
      this.shield = item ? this.attachItem(createItemMesh(this.scene, item, "playerShield")) : null;
      this.shieldId = shieldId;
    }
  }

  private attachItem(item: ItemMesh): ItemMesh {
    for (const m of item.meshes) this.shadows?.addShadowCaster(m);
    return item;
  }

  /** Pose padrão do equipamento (guardado nas costas, na mão, ou escudo erguido). */
  private poseGear(state: PlayerVisualState): void {
    const drawn = state.gear.drawn;
    if (this.sword) {
      const r = this.sword.root;
      if (drawn) {
        r.parent = this.swordPivot;
        r.position.set(0, 0, SWORD.handForward);
        r.rotation.set(Math.PI / 2, 0, 0); // lâmina para a frente do braço
        this.swordPivot.rotation.set(SWORD.idle.pitch, SWORD.idle.yaw, 0);
      } else {
        // Nas costas, na diagonal, com o cabo acima do ombro direito.
        r.parent = this.body;
        r.position.set(0.12, 1.45, -0.4);
        r.rotation.set(0, 0, Math.PI * 0.8);
      }
    }
    if (this.shield) {
      const r = this.shield.root;
      r.parent = this.body;
      if (!drawn) {
        r.position.set(SHIELD.back.x, SHIELD.back.y, SHIELD.back.z);
        r.rotation.set(0, Math.PI, 0);
      } else if (state.action?.kind === "block") {
        const push = SHIELD.impactPush * state.action.impact;
        r.position.set(SHIELD.raised.x, SHIELD.raised.y, SHIELD.raised.z - push);
        r.rotation.set(0, 0, 0);
      } else {
        r.position.set(SHIELD.arm.x, SHIELD.arm.y, SHIELD.arm.z);
        r.rotation.set(0, SHIELD.arm.yaw, 0);
      }
    }
  }

  /** Golpes 1 e 2: cortes horizontais em sentidos opostos. Golpe 3: corte de cima para baixo. */
  private poseSword(comboIndex: number, phase: string, p: number): void {
    const pivot = this.swordPivot;
    const { idle, slashPitch, slashWide, overheadRaised, overheadDown } = SWORD;
    if (comboIndex >= 2) {
      const pitch =
        phase === "windup"
          ? lerp(idle.pitch, overheadRaised, easeOut(p))
          : phase === "active"
            ? lerp(overheadRaised, overheadDown, easeOut(p))
            : lerp(overheadDown, idle.pitch, p);
      pivot.rotation.set(pitch, 0, 0);
      if (phase !== "recovery") this.body.rotation.x = phase === "active" ? 0.18 : -0.08;
      return;
    }
    // Primeiro corte: da direita para a esquerda; segundo: o contrário.
    const dir = comboIndex % 2 === 0 ? 1 : -1;
    const yaw =
      phase === "windup"
        ? lerp(idle.yaw, dir * slashWide, easeOut(p))
        : phase === "active"
          ? lerp(dir * slashWide, -dir * slashWide * 0.8, easeOut(p))
          : lerp(-dir * slashWide * 0.8, idle.yaw, p);
    const pitch = phase === "recovery" ? lerp(slashPitch, idle.pitch, p) : slashPitch;
    pivot.rotation.set(pitch, yaw, 0);
    this.body.rotation.y = -yaw * 0.25; // o tronco acompanha o corte
  }

  private refreshVisibility(): void {
    const v = this.cameraVisibility * this.actionVisibility;
    for (const mesh of this.bodyMeshes) mesh.visibility = v;
    for (const item of [this.sword, this.shield]) {
      if (item) for (const mesh of item.meshes) mesh.visibility = v;
    }
  }

  private material(scene: Scene, name: string, color: Color3, glow = false): StandardMaterial {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = color;
    mat.specularColor = new Color3(0.15, 0.15, 0.15);
    if (glow) mat.emissiveColor = color.scale(0.35);
    this.materials.push(mat);
    return mat;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
