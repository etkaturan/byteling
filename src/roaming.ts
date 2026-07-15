// The roaming brain. Design principle: a well-mannered cat, not a screensaver.
// The pet mostly rests, wanders occasionally, hugs screen edges, and always
// yields to the user. All decisions live here — App.tsx just drives the loop.

export type RoamMode = "still" | "calm" | "playful";

export type Vec = { x: number; y: number };

type Config = {
  /** Idle time before the pet even considers wandering. */
  idleBeforeRoamMs: number;
  /** Pixels per frame while travelling. */
  speed: number;
  /** How long it sits still between wanders. */
  restMsMin: number;
  restMsMax: number;
  /** Chance a rest ends in a wander rather than another rest. */
  wanderChance: number;
};

const CONFIGS: Record<Exclude<RoamMode, "still">, Config> = {
  calm: {
    idleBeforeRoamMs: 45_000,
    speed: 1.2,
    restMsMin: 20_000,
    restMsMax: 60_000,
    wanderChance: 0.5,
  },
  playful: {
    idleBeforeRoamMs: 15_000,
    speed: 2.2,
    restMsMin: 4_000,
    restMsMax: 14_000,
    wanderChance: 0.85,
  },
};

export function configFor(mode: RoamMode): Config | null {
  return mode === "still" ? null : CONFIGS[mode];
}

/** What the brain is doing right now. */
type Phase = "resting" | "travelling";

export type RoamDecision =
  | { move: false }
  | { move: true; step: Vec; arrived: boolean };

/**
 * The roaming state machine. One instance per session; App.tsx calls tick()
 * each frame and applies the returned step. All timing/decision logic is here.
 */
export class RoamBrain {
  private phase: Phase = "resting";
  private restUntil = 0;
  private target: Vec | null = null;
  private cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
    // Start with a short rest so it doesn't bolt the instant you launch.
    this.restUntil = Date.now() + 3_000;
  }

  /** Swap config when the user changes mode without losing position state. */
  setConfig(cfg: Config) {
    this.cfg = cfg;
  }

  /** The user grabbed the pet — abandon the plan and settle. */
  interrupt() {
    this.phase = "resting";
    this.target = null;
    this.restUntil = Date.now() + 8_000;
  }

  private beginRest(now: number) {
    this.phase = "resting";
    this.target = null;
    const { restMsMin, restMsMax } = this.cfg;
    this.restUntil = now + restMsMin + Math.random() * (restMsMax - restMsMin);
  }

  /**
   * Pick somewhere to go. Edges only — the pet stays out of the working area
   * in the middle of the screen. Won't pick somewhere it already is.
   */
  private pickTarget(pos: Vec, screen: Vec, petSize: Vec): Vec {
    const margin = 10;
    const maxX = Math.max(margin, screen.x - petSize.x - margin);
    const maxY = Math.max(margin, screen.y - petSize.y - margin);

    for (let attempt = 0; attempt < 8; attempt++) {
      const edge = Math.floor(Math.random() * 4);
      const t = Math.random();
      let candidate: Vec;
      switch (edge) {
        case 0:
          candidate = { x: margin + t * (maxX - margin), y: margin };
          break;
        case 1:
          candidate = { x: maxX, y: margin + t * (maxY - margin) };
          break;
        case 2:
          candidate = { x: margin + t * (maxX - margin), y: maxY };
          break;
        default:
          candidate = { x: margin, y: margin + t * (maxY - margin) };
      }
      if (Math.hypot(candidate.x - pos.x, candidate.y - pos.y) > 150) {
        return candidate;
      }
    }
    // Fallback: opposite corner-ish.
    return { x: maxX - pos.x, y: maxY - pos.y };
  }

  /**
   * Advance one frame. Returns the step to apply, or {move:false} to hold.
   * `blocked` covers all the rails (user dragging, fullscreen, not idle).
   */
  tick(pos: Vec, screen: Vec, petSize: Vec, blocked: boolean): RoamDecision {
    const now = Date.now();

    if (blocked) {
      // Don't advance the plan while blocked — just wait.
      return { move: false };
    }

    if (this.phase === "resting") {
      if (now < this.restUntil) return { move: false };
      // Rest is over. Wander, or settle in for another one?
      if (Math.random() > this.cfg.wanderChance) {
        this.beginRest(now);
        return { move: false };
      }
      this.target = this.pickTarget(pos, screen, petSize);
      this.phase = "travelling";
    }

    if (!this.target) {
      this.beginRest(now);
      return { move: false };
    }

    const dx = this.target.x - pos.x;
    const dy = this.target.y - pos.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 6) {
      this.beginRest(now);
      return { move: true, step: { x: 0, y: 0 }, arrived: true };
    }

    // Ease out as it arrives so it doesn't stop dead.
    const ease = 0.35 + 0.65 * Math.min(1, dist / 180);
    const speed = this.cfg.speed * ease;
    return {
      move: true,
      step: { x: (dx / dist) * speed, y: (dy / dist) * speed },
      arrived: false,
    };
  }
}