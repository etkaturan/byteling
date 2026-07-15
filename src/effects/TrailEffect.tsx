import { useEffect, useRef, useState } from "react";

type Mote = {
  id: number;
  /** Position within the overlay, in px, relative to the pet's center. */
  x: number;
  y: number;
  /** Drift velocity — motes keep moving after they're born. */
  dx: number;
  dy: number;
  born: number;
  size: number;
};

type Props = {
  /** Pet velocity — motes spawn only while moving, and drift opposite it. */
  vx: number;
  vy: number;
  /** Trail color (the pet's hue). */
  color: string;
  /** Off switch. */
  enabled?: boolean;
};

const LIFE_MS = 700;
const SPAWN_SPEED = 2.5; // min velocity before motes appear
const MAX_MOTES = 24;

/**
 * A glowing mote trail. Renderer-independent: it only reads velocity, so it
 * works for any pet. Motes spawn behind the pet and fade as they drift.
 */
function TrailEffect({ vx, vy, color, enabled = true }: Props) {
  const [motes, setMotes] = useState<Mote[]>([]);
  const nextId = useRef(0);
  const raf = useRef<number | null>(null);
  const vel = useRef({ vx: 0, vy: 0 });

  // Keep the latest velocity readable inside the animation loop.
  vel.current = { vx, vy };

  useEffect(() => {
    if (!enabled) {
      setMotes([]);
      return;
    }

    let lastSpawn = 0;
    const tick = () => {
      const now = performance.now();
      const { vx: cvx, vy: cvy } = vel.current;
      const speed = Math.hypot(cvx, cvy);

      setMotes((prev) => {
        // Age out dead motes and drift the living ones.
        let next = prev
          .filter((m) => now - m.born < LIFE_MS)
          .map((m) => ({ ...m, x: m.x + m.dx, y: m.y + m.dy }));

        // Spawn while moving, throttled so we don't flood.
        if (speed > SPAWN_SPEED && now - lastSpawn > 28 && next.length < MAX_MOTES) {
          lastSpawn = now;
          const jitter = () => (Math.random() - 0.5) * 14;
          next = next.concat({
            id: nextId.current++,
            x: jitter(),
            y: jitter(),
            // Drift opposite the pet's motion, with a little randomness.
            dx: -cvx * 0.06 + (Math.random() - 0.5) * 0.4,
            dy: -cvy * 0.06 + (Math.random() - 0.5) * 0.4,
            born: now,
            size: 3 + Math.random() * 4,
          });
        }
        return next;
      });

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [enabled]);

  if (!enabled || motes.length === 0) return null;

  const now = performance.now();
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {motes.map((m) => {
        const age = (now - m.born) / LIFE_MS;
        const opacity = Math.max(0, 1 - age) * 0.7;
        const scale = 1 - age * 0.5;
        return (
          <div
            key={m.id}
            style={{
              position: "absolute",
              left: m.x,
              top: m.y,
              width: m.size,
              height: m.size,
              borderRadius: "50%",
              background: color,
              opacity,
              transform: `scale(${scale})`,
              boxShadow: `0 0 ${m.size * 2}px ${color}`,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </div>
  );
}

export default TrailEffect;