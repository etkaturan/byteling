import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

// Mirrors of the Rust types (serde: unit enums → strings, Option → null).
type Species = {
  archetype: "Wisp" | "Golem" | "Volt" | "Drake";
  temperament: string;
  hue: number;
  markings: number;
};

type Needs = {
  comfort: number;
  space: number | null;
  tidiness: number | null;
  rest: number;
  energy: number;
};

type Mood = "Thriving" | "Content" | "Uneasy" | "Unwell" | "Critical";

type PetState = {
  needs: Needs;
  mood_score: number;
  mood: Mood;
};

/** Breath cycle duration per mood — sick pets breathe slow and heavy. */
const BREATH_SECONDS: Record<Mood, number> = {
  Thriving: 2.2,
  Content: 2.8,
  Uneasy: 3.6,
  Unwell: 4.6,
  Critical: 6.0,
};

function App() {
  const [species, setSpecies] = useState<Species | null>(null);
  const [pet, setPet] = useState<PetState | null>(null);

  const startDrag = (e: any) => {
    if (e.button === 0) {
      getCurrentWindow().startDragging().catch(console.error);
    }
  };

  useEffect(() => {
    invoke<Species>("get_species").then(setSpecies);
    const unlisten = listen<PetState>("pet-state-changed", (e) =>
      setPet(e.payload),
    );
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  if (!species) return null;

  const mood: Mood = pet?.mood ?? "Content";
  const bodyColor = `hsl(${species.hue}, 65%, 55%)`;
  const bodyDark = `hsl(${species.hue}, 65%, 40%)`;

  return (
    <main className="stage" onMouseDown={startDrag}>
      <div
        className="blob"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${bodyColor}, ${bodyDark})`,
          animationDuration: `${BREATH_SECONDS[mood]}s`,
        }}
        data-tauri-drag-region
      >
        <div className="eyes" data-mood={mood}>
          <span className="eye" />
          <span className="eye" />
        </div>
      </div>
      <div className="debug">
        {mood} {pet ? `(${Math.round(pet.mood_score)})` : "…waking up"}
      </div>
    </main>
  );
}

export default App;