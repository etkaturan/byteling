import "./Creature.css";

export type Species = {
  family: "Aerial" | "Grounded";
  life_stage: "Hatchling" | "Adult" | "Elder";
  build: "Slight" | "Sturdy" | "Mighty";
  hue: number;
  limbs: number;
  markings: number;
  liveliness: number;
};

export type Mood =
  | "Thriving"
  | "Content"
  | "Uneasy"
  | "Unwell"
  | "Critical";

type Props = {
  species: Species;
  mood?: Mood;
  size?: number;
};

// Life stage → base scale of the whole creature.
const STAGE_SCALE: Record<Species["life_stage"], number> = {
  Hatchling: 0.72,
  Adult: 0.92,
  Elder: 1.0,
};

// Build → an extra size + glow multiplier.
const BUILD_SCALE: Record<Species["build"], number> = {
  Slight: 0.85,
  Sturdy: 1.0,
  Mighty: 1.15,
};

// Mood → the overall vibe of the animation and a brightness shift.
const MOOD_ANIM: Record<Mood, string> = {
  Thriving: "mood-thriving",
  Content: "mood-content",
  Uneasy: "mood-uneasy",
  Unwell: "mood-unwell",
  Critical: "mood-critical",
};

function Creature({ species, mood = "Content", size = 140 }: Props) {
  const { family, life_stage, build, hue, limbs, markings, liveliness } =
    species;

  // Elders are slightly desaturated and darker — weathered.
  const sat = life_stage === "Elder" ? 45 : 68;
  const light = life_stage === "Elder" ? 52 : 58;
  const body = `hsl(${hue}, ${sat}%, ${light}%)`;
  const bodyDark = `hsl(${hue}, ${sat}%, ${light - 16}%)`;
  const glow = `hsl(${hue}, 90%, 65%)`;

  const scale = STAGE_SCALE[life_stage] * BUILD_SCALE[build];

  // Bigger eyes for hatchlings, calmer eyes for elders.
  const eyeR = life_stage === "Hatchling" ? 6 : life_stage === "Elder" ? 4 : 5;

  // Animation speed: livelier machines move a touch faster.
  const speed = (1 / liveliness).toFixed(2);

  // Place `limbs` little appendages along the bottom (grounded = legs)
  // or the sides (aerial = fins).
  const limbEls = Array.from({ length: limbs }, (_, i) => {
    if (family === "Grounded") {
      // legs spread along the base
      const spread = 44;
      const x = 50 - spread / 2 + (limbs === 1 ? spread / 2 : (spread * i) / (limbs - 1));
      return (
        <rect
          key={i}
          className="limb leg"
          x={x - 2.5}
          y={74}
          width={5}
          height={12}
          rx={2.5}
          fill={bodyDark}
        />
      );
    } else {
      // fins fan out from the sides
      const side = i % 2 === 0 ? -1 : 1;
      const tier = Math.floor(i / 2);
      const y = 44 + tier * 12;
      return (
        <ellipse
          key={i}
          className="limb fin"
          cx={50 + side * 30}
          cy={y}
          rx={10}
          ry={5}
          fill={bodyDark}
          transform={`rotate(${side * 20} ${50 + side * 30} ${y})`}
        />
      );
    }
  });

  // Marking spots scattered on the body.
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

  // Body outline differs by family.
  const bodyShape =
    family === "Grounded" ? (
      // Rounded, settled body sitting on the ground.
      <path
        d="M50 20 C70 20 78 36 78 52 C78 70 66 78 50 78 C34 78 22 70 22 52 C22 36 30 20 50 20 Z"
        fill={body}
        stroke={bodyDark}
        strokeWidth={1.5}
      />
    ) : (
      // Teardrop, floating body.
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
      {/* Everything scales together based on life stage + build. */}
      <g
        className="creature-body"
        style={{ transformOrigin: "50px 50px", transform: `scale(${scale})` }}
      >
        {/* Soft aura behind the creature. */}
        <ellipse className="aura" cx="50" cy="50" rx="34" ry="34" fill={glow} opacity="0.18" />

        {limbEls}
        {bodyShape}
        {spots}

        {/* Eyes. */}
        <g className="eyes">
          <circle className="eye" cx={42} cy={48} r={eyeR} fill="#15151d" />
          <circle className="eye" cx={58} cy={48} r={eyeR} fill="#15151d" />
          {/* little highlight */}
          <circle cx={43.5} cy={46} r={eyeR / 3} fill="#fff" opacity="0.9" />
          <circle cx={59.5} cy={46} r={eyeR / 3} fill="#fff" opacity="0.9" />
        </g>
      </g>
    </svg>
  );
}

export default Creature;