import type { WearableProps } from "../../types";
import "../../wearables.css";

type HaloVariant = "white" | "purple" | "red" | "green";

const RING: Record<HaloVariant, { stroke: string; glow: string; flicker?: boolean }> = {
  white: { stroke: "#fff6e0", glow: "rgba(255,246,224,0.85)", flicker: true },
  purple: { stroke: "#241129", glow: "rgba(140,60,220,0.75)" },
  red: { stroke: "#ff5a3d", glow: "rgba(255,90,60,0.8)", flicker: true },
  green: { stroke: "#7be89a", glow: "rgba(123,232,154,0.7)", flicker: true },
};

/** Falling ash (purple) or rising embers (red). White and green keep it to
 * the ring's own flicker — simpler, and it reads more clearly at small sizes. */
function Particles({ variant }: { variant: HaloVariant }) {
  if (variant === "purple") {
    return (
      <>
        {[0, 1, 2, 3].map((i) => {
          const x = 40 + i * 7;
          const y = 11;
          return (
            // Static rotate lives on the OUTER group; the animated fall lives
            // on the INNER one. Putting both on one element would let the
            // CSS animation silently replace the static transform.
            <g key={i} transform={`rotate(45 ${x + 1.5} ${y + 1.5})`}>
              <g
                className="wearable-particle-fall"
                style={{ animationDuration: `${2.4 + i * 0.3}s`, animationDelay: `${i * 0.5}s` }}
              >
                <rect x={x} y={y} width={3} height={3} fill="#3a1a45" opacity={0.8} />
              </g>
            </g>
          );
        })}
      </>
    );
  }
  if (variant === "red") {
    return (
      <>
        {[0, 1, 2, 3, 4].map((i) => (
          <circle
            key={i}
            className="wearable-particle-rise"
            style={{ animationDuration: `${2 + i * 0.25}s`, animationDelay: `${i * 0.4}s` }}
            cx={37 + i * 6.5}
            cy={9}
            r={1.4}
            fill={i % 2 ? "#ffb347" : "#ff6a3d"}
          />
        ))}
      </>
    );
  }
  return null;
}

/** Floats well above the head, connected by a faint beam of light so the
 * separation reads clearly at any size, plus a per-colour flourish. */
export function makeHalo(variant: HaloVariant) {
  const ring = RING[variant];
  return function Halo({ state }: WearableProps) {
    const bright = state.mood === "Thriving" ? 1.2 : state.mood === "Critical" ? 0.6 : 1;
    return (
      <g className="wearable-halo">
        <path d="M46 11 L54 11 L58 20 L42 20 Z" fill={ring.stroke} opacity={0.12} />

        <ellipse
          cx={50}
          cy={2}
          rx={17}
          ry={5}
          fill="none"
          stroke={ring.stroke}
          strokeWidth={3}
          opacity={0.95 * bright}
          className={ring.flicker ? "wearable-lightsaber-blade" : undefined}
          style={{ filter: `drop-shadow(0 0 6px ${ring.glow})` }}
        />

        {variant === "purple" && (
          <>
            <path d="M33 2 L29 -1 L29 5 Z" fill={ring.stroke} opacity={0.85} />
            <path d="M67 2 L71 -1 L71 5 Z" fill={ring.stroke} opacity={0.85} />
            <path d="M42 -2 L40 -7 L45 -4 Z" fill={ring.stroke} opacity={0.85} />
            <path d="M58 -2 L60 -7 L55 -4 Z" fill={ring.stroke} opacity={0.85} />
          </>
        )}

        <Particles variant={variant} />
      </g>
    );
  };
}