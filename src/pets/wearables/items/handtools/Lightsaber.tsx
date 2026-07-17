import type { WearableProps } from "../../types";
import "../../wearables.css";

const COLORS: Record<string, { blade: string; glow: string }> = {
  blue: { blade: "#eaf7ff", glow: "#4fb3ff" },
  green: { blade: "#eafff0", glow: "#4bdf6a" },
  red: { blade: "#fff0f0", glow: "#ff4d4d" },
  purple: { blade: "#f6ecff", glow: "#a94dff" },
};

/** A held blade, reaching well past the body, with a flickering glow. One
 * implementation parameterized by colour, so all four variants share exactly
 * the same geometry and behaviour. */
export function makeLightsaber(color: keyof typeof COLORS) {
  const c = COLORS[color];
  return function Lightsaber({ state }: WearableProps) {
    const tilt = Math.max(-22, Math.min(22, state.vx * 1.1));
    return (
      <g
        className="wearable-lightsaber"
        style={{
          transformOrigin: "76px 64px",
          transform: `rotate(${20 + tilt}deg)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <rect x={73.5} y={58} width={4.5} height={13} rx={1.4} fill="#6c6c74" />
        <rect x={74.2} y={58.5} width={1.2} height={12} rx={0.6} fill="#3c3c42" />
        <g className="wearable-lightsaber-blade">
          <rect x={74.6} y={4} width={3.4} height={55} rx={1.6} fill={c.blade} />
          <rect
            x={73.6}
            y={2}
            width={5.4}
            height={59}
            rx={2.4}
            fill={c.glow}
            opacity={0.5}
            style={{ filter: `drop-shadow(0 0 7px ${c.glow})` }}
          />
        </g>
      </g>
    );
  };
}