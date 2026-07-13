import Creature, { Species, Mood } from "./Creature";

// A spread of creatures to eyeball all axes and moods at once.
const SAMPLES: { species: Species; mood: Mood; label: string }[] = [
  {
    label: "Grounded · Hatchling · Slight",
    mood: "Thriving",
    species: { family: "Grounded", life_stage: "Hatchling", build: "Slight", hue: 200, limbs: 2, markings: 1, liveliness: 1.1 },
  },
  {
    label: "Grounded · Elder · Sturdy (yours)",
    mood: "Unwell",
    species: { family: "Grounded", life_stage: "Elder", build: "Sturdy", hue: 15, limbs: 6, markings: 1, liveliness: 1.02 },
  },
  {
    label: "Aerial · Adult · Mighty",
    mood: "Content",
    species: { family: "Aerial", life_stage: "Adult", build: "Mighty", hue: 280, limbs: 4, markings: 3, liveliness: 1.0 },
  },
  {
    label: "Aerial · Hatchling · Slight",
    mood: "Critical",
    species: { family: "Aerial", life_stage: "Hatchling", build: "Slight", hue: 130, limbs: 2, markings: 2, liveliness: 1.14 },
  },
];

function Gallery() {
  return (
    <div
      style={{
        background: "#0f1117",
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        padding: 30,
        placeItems: "center",
      }}
    >
      {SAMPLES.map((s) => (
        <div key={s.label} style={{ textAlign: "center", color: "#e6e8ee" }}>
          <Creature species={s.species} mood={s.mood} size={150} />
          <div style={{ fontFamily: "system-ui", fontSize: 12, marginTop: 6 }}>
            {s.label}
            <br />
            <span style={{ opacity: 0.6 }}>{s.mood}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Gallery;