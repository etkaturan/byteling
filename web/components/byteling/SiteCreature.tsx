"use client";

import "./SiteCreature.css";

export type Species = {
  family: "Aerial" | "Grounded";
  life_stage: "Hatchling" | "Adult" | "Elder";
  build: "Slight" | "Sturdy" | "Mighty";
  hue: number;
  limbs: number;
  markings: number;
  liveliness: number;
};

export type Mood = "Thriving" | "Content" | "Uneasy" | "Unwell" | "Critical";

type Props = {
  species: Species;
  mood?: Mood;
  size?: number;
  vx?: number;
  vy?: number;
};

const STAGE_SCALE: Record<Species["life_stage"], number> = {
  Hatchling: 0.72,
  Adult: 0.92,
  Elder: 1.0,
};

const BUILD_SCALE: Record<Species["build"], number> = {
  Slight: 0.85,
  Sturdy: 1.0,
  Mighty: 1.15,
};

const MOOD_ANIM: Record<Mood, string> = {
  Thriving: "mood-thriving",
  Content: "mood-content",
  Uneasy: "mood-uneasy",
  Unwell: "mood-unwell",
  Critical: "mood-critical",
};

/**
 * The real creature from the desktop app, ported unchanged. Same procedural
 * shapes, same glow layering, same mood animations — the site hero IS the
 * product, not a drawing of it.
 */
export default function SiteCreature({
  species,
  mood = "Content",
  size = 200,
  vx = 0,
  vy = 0,
}: Props) {
  const { family, life_stage, build, hue, limbs, markings, liveliness } =
    species;

  const sat = life_stage === "Elder" ? 45 : 68;
  const light = life_stage === "Elder" ? 52 : 58;
  const body = `hsl(${hue}, ${sat}%, ${light}%)`;
  const bodyDark = `hsl(${hue}, ${sat}%, ${light - 16}%)`;
  const glow = `hsl(${hue}, 90%, 65%)`;

  const scale = STAGE_SCALE[life_stage] * BUILD_SCALE[build];
  const eyeR = life_stage === "Hatchling" ? 6 : life_stage === "Elder" ? 4 : 5;
  const speed = (1 / liveliness).toFixed(2);

  const vmag = Math.min(Math.hypot(vx, vy), 40);
  const limbTrail = Math.max(-14, Math.min(14, vx * 0.8));
  const skew = Math.max(-18, Math.min(18, vx * 0.8));
  const leanX = Math.max(-8, Math.min(8, vx * 0.25));
  const stretch = 1 + Math.min(vmag / 60, 0.2);

  const limbEls = Array.from({ length: limbs }, (_, i) => {
    if (family === "Grounded") {
      const spread = 44;
      const topX =
        50 - spread / 2 + (limbs === 1 ? spread / 2 : (spread * i) / (limbs - 1));
      const footX = topX - limbTrail;
      return (
        <path
          key={i}
          className="limb leg"
          d={`M${topX - 2.5} 74 L${topX + 2.5} 74 L${footX + 2.5} 86 L${footX - 2.5} 86 Z`}
          fill={bodyDark}
          style={{ transition: "d 0.08s ease-out" }}
        />
      );
    }
    const side = i % 2 === 0 ? -1 : 1;
    const tier = Math.floor(i / 2);
    const y = 44 + tier * 12;
    const baseX = 50 + side * 30;
    return (
      <ellipse
        key={i}
        className="limb fin"
        cx={baseX - limbTrail * 0.4}
        cy={y}
        rx={10}
        ry={5}
        fill={bodyDark}
        transform={`rotate(${side * 20} ${baseX} ${y})`}
      />
    );
  });

  const spots = Array.from({ length: markings }, (_, i) => {
    const angle = (i / markings) * Math.PI * 2 + 0.6;
    const r = 12;
    return (
      <circle
        key={i}
        cx={50 + Math.cos(angle) * r}
        cy={48 + Math.sin(angle) * r}
        r={2.6}
        fill={bodyDark}
        opacity={0.6}
      />
    );
  });

  const bodyShape =
    family === "Grounded" ? (
      <path
        d="M50 20 C70 20 78 36 78 52 C78 70 66 78 50 78 C34 78 22 70 22 52 C22 36 30 20 50 20 Z"
        fill={body}
        stroke={bodyDark}
        strokeWidth={1.5}
      />
    ) : (
      <path
        d="M50 16 C68 16 76 34 74 52 C72 68 62 80 50 80 C38 80 28 68 26 52 C24 34 32 16 50 16 Z"
        fill={body}
        stroke={bodyDark}
        strokeWidth={1.5}
      />
    );

  return (
    <svg
      className={`creature ${MOOD_ANIM[mood]}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={
        {
          "--speed": `${speed}s`,
          "--glow": glow,
          overflow: "visible",
        } as React.CSSProperties
      }
    >
      <g
        className="creature-motion"
        style={{
          transformOrigin: "50px 70px",
          transform: `translateX(${leanX}px) skewX(${skew}deg) scale(${stretch}, ${2 - stretch})`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <g
          className="creature-body"
          style={
            {
              transformOrigin: "50px 50px",
              "--s": scale,
            } as React.CSSProperties
          }
        >
          <ellipse
            className="aura"
            cx="50"
            cy="50"
            rx="34"
            ry="34"
            fill={glow}
            opacity="0.18"
          />
          {limbEls}
          {bodyShape}
          {spots}
          <g className="eyes">
            <circle className="eye" cx={42} cy={48} r={eyeR} fill="#15151d" />
            <circle className="eye" cx={58} cy={48} r={eyeR} fill="#15151d" />
            <circle cx={43.5} cy={46} r={eyeR / 3} fill="#fff" opacity="0.9" />
            <circle cx={59.5} cy={46} r={eyeR / 3} fill="#fff" opacity="0.9" />
          </g>
        </g>
      </g>
    </svg>
  );
}