import type { WearableProps } from "../../types";

/** Attaches at the back of the body and swings opposite travel, like the
 * limbs do. Rendered BEHIND the body (see PetView's back/front split) and
 * reaches past the body's own left edge, so the tip genuinely pokes out. */
export function Tail({ state }: WearableProps) {
  const lag = Math.max(-18, Math.min(18, state.vx * 0.9));
  const tipX = 8 - lag;
  const tipY = 58 + Math.max(-6, Math.min(6, state.vy * 0.5));
  return (
    <g className="wearable-tail">
      <path
        d={`M28 60 Q${(28 + tipX) / 2} 70 ${tipX} ${tipY}`}
        fill="none"
        stroke={`hsl(${state.hue}, 55%, 34%)`}
        strokeWidth={6.5}
        strokeLinecap="round"
        style={{ transition: "d 0.1s ease-out" }}
      />
      <circle
        cx={tipX}
        cy={tipY}
        r={4.2}
        fill={`hsl(${state.hue}, 55%, 34%)`}
        style={{ transition: "cx 0.1s ease-out, cy 0.1s ease-out" }}
      />
    </g>
  );
}