import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Creature, { Species, Mood } from "./Creature";
import Settings from "./Settings";
import "./Clinic.css";

type MachineSpecs = {
  cpu: string;
  ram_gib: number;
  gpu: string | null;
};

type Needs = {
  comfort: number;
  space: number | null;
  tidiness: number | null;
  rest: number;
  energy: number;
};

type PetState = {
  needs: Needs;
  mood_score: number;
  mood: Mood;
};

const MOOD_COLOR: Record<Mood, string> = {
  Thriving: "#4caf50",
  Content: "#8bc34a",
  Uneasy: "#ffc107",
  Unwell: "#ff9800",
  Critical: "#f44336",
};

/** A single labelled vitals bar. */
function Vital({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  if (value === null) {
    return (
      <div className="vital">
        <span className="vital-label">{label}</span>
        <span className="vital-na">no sensor</span>
      </div>
    );
  }
  const hue = (value / 100) * 120; // 0 = red, 120 = green
  return (
    <div className="vital">
      <span className="vital-label">{label}</span>
      <div className="vital-track">
        <div
          className="vital-fill"
          style={{
            width: `${value}%`,
            background: `hsl(${hue}, 70%, 45%)`,
          }}
        />
      </div>
      <span className="vital-num">{Math.round(value)}</span>
    </div>
  );
}

function Clinic() {
  const [specs, setSpecs] = useState<MachineSpecs | null>(null);
  const [species, setSpecies] = useState<Species | null>(null);
  const [pet, setPet] = useState<PetState | null>(null);

  useEffect(() => {
    invoke<MachineSpecs>("get_specs").then(setSpecs);
    invoke<Species>("get_species").then(setSpecies);
    invoke<PetState | null>("get_pet_state").then((s) => {
      if (s) setPet(s);
    });
    const unlisten = listen<PetState>("pet-state-changed", (e) =>
      setPet(e.payload),
    );
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  if (!species) return <div className="clinic">Loading…</div>;

  const mood: Mood = pet?.mood ?? "Content";

  return (
    <div className="clinic">
      <header className="clinic-header">
        <h1>Byteling Clinic</h1>
        <span className="mood-pill" style={{ background: MOOD_COLOR[mood] }}>
          {mood}
        </span>
      </header>

      <section className="patient">
        <Creature species={species} mood={mood} size={96} />
        <div className="patient-id">
          <div className="species-name">
            {species.life_stage} {species.family}
          </div>
          <div className="species-sub">
            {species.build} build · {species.limbs} limbs · hue {species.hue}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Vitals</h2>
        <Vital label="Comfort" value={pet?.needs.comfort ?? null} />
        <Vital label="Space" value={pet?.needs.space ?? null} />
        <Vital label="Tidiness" value={pet?.needs.tidiness ?? null} />
        <Vital label="Rest" value={pet?.needs.rest ?? null} />
        <Vital label="Energy" value={pet?.needs.energy ?? null} />
      </section>

      <section className="card">
        <h2>Birth certificate</h2>
        {specs ? (
          <dl className="anatomy">
            <dt>🧠 Brain</dt>
            <dd>{specs.cpu}</dd>
            <dt>💾 Memory</dt>
            <dd>{specs.ram_gib} GiB</dd>
            <dt>❤️ Heart</dt>
            <dd>{specs.gpu ?? "Integrated graphics"}</dd>
          </dl>
        ) : (
          <p>Reading specs…</p>
        )}
      </section>
      <Settings />
    </div>
  );
}

export default Clinic;