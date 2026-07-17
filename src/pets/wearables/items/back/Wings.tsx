import type { WearableProps } from "../../types";
import "../../wearables.css";

type FeatherSpec = { angle: number; length: number; width: number };

// Positive angles: for the right wing this rotates CLOCKWISE, swinging each
// feather up and OUTWARD, away from the body. Negative would swing them back
// toward the body's centre, where the opaque body shape hides them entirely
// — that was the original bug.
const FEATHERS: FeatherSpec[] = [
  { angle: 78, length: 24, width: 4.6 },
  { angle: 62, length: 29, width: 5.4 },
  { angle: 46, length: 32, width: 6 },
  { angle: 30, length: 28, width: 5.4 },
  { angle: 14, length: 22, width: 4.4 },
];

function featherPath(length: number, width: number): string {
  return `M0 0 Q${width} ${-length * 0.45} 0 ${-length} Q${-width} ${-length * 0.45} 0 0 Z`;
}

function Wing({ side, shoulderX }: { side: "left" | "right"; shoulderX: number }) {
  const mirror = side === "left" ? -1 : 1;
  return (
    <g transform={`translate(${shoulderX} 46)`}>
      {FEATHERS.map((f, i) => (
        <path
          key={i}
          d={featherPath(f.length, f.width)}
          fill="#fbf7ee"
          opacity={0.5 + i * 0.06}
          stroke="#e8e0d0"
          strokeWidth={0.4}
          transform={`rotate(${mirror * f.angle})`}
        />
      ))}
      {/* an occasional feather breaking loose — static position + rotate on
          the outer group, the fall animation on the inner one */}
      <g transform={`translate(${mirror * -20} -18) rotate(${mirror * 20})`}>
        <g
          className="wearable-particle-fall"
          style={{ animationDuration: "5.5s", animationDelay: side === "left" ? "1.2s" : "3s" }}
        >
          <path d="M0 0 Q3 4 0 9 Q-3 4 0 0 Z" fill="#fbf7ee" opacity={0.7} />
        </g>
      </g>
    </g>
  );
}

/** A pair of layered, feathered angel wings — rendered behind the body so
 * they read as sprouting from it — that occasionally shed a single drifting
 * feather from each wingtip. */
export function Wings(_props: WearableProps) {
  return (
    <g className="wearable-wings">
      <Wing side="left" shoulderX={24} />
      <Wing side="right" shoulderX={76} />
    </g>
  );
}