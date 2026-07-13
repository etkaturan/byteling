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

type GroomReport = {
  freed_mb: number;
  files_removed: number;
  files_skipped: number;
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
  const [grooming, setGrooming] = useState(false);
  const [groomMsg, setGroomMsg] = useState<string | null>(null);
  const [groomPreview, setGroomPreview] = useState<GroomReport | null>(null);

  const startDrag = (e: React.MouseEvent) => {
    // Don't hijack clicks on interactive controls (buttons).
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.button === 0) {
      getCurrentWindow().startDragging().catch(console.error);
    }
  };

  // Step 1: ask Rust how much could be freed, then show our own confirm panel.
  const requestGroom = async () => {
    try {
      const preview = await invoke<GroomReport>("preview_groom");
      setGroomPreview(preview);
    } catch (err) {
      console.error(err);
      setGroomMsg("Preview failed");
      setTimeout(() => setGroomMsg(null), 6000);
    }
  };

  // Step 2: user clicked "Yes" — actually perform the cleanup.
  const confirmGroom = async () => {
    setGroomPreview(null);
    setGrooming(true);
    setGroomMsg(null);
    try {
      const report = await invoke<GroomReport>("do_groom");
      setGroomMsg(`Freed ${report.freed_mb} MB ✨`);
    } catch (err) {
      console.error(err);
      setGroomMsg("Groom failed");
    } finally {
      setGrooming(false);
      setTimeout(() => setGroomMsg(null), 6000);
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
        {pet && (
          <div className="needs">
            C{Math.round(pet.needs.comfort)} · S
            {pet.needs.space === null ? "–" : Math.round(pet.needs.space)} · T
            {pet.needs.tidiness === null ? "–" : Math.round(pet.needs.tidiness)} · R
            {Math.round(pet.needs.rest)} · E{Math.round(pet.needs.energy)}
          </div>
        )}
      </div>

      {groomPreview ? (
        <div className="confirm">
          <div className="confirm-text">
            Clear ~{groomPreview.freed_mb} MB ({groomPreview.files_removed} files)
            and empty the recycle bin?
          </div>
          <div className="confirm-actions">
            <button className="care-btn yes" onClick={confirmGroom}>
              Yes
            </button>
            <button
              className="care-btn no"
              onClick={() => setGroomPreview(null)}
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <button
          className="care-btn"
          onClick={requestGroom}
          disabled={grooming}
        >
          {grooming ? "Grooming…" : groomMsg ?? "🧹 Groom"}
        </button>
      )}
    </main>
  );
}

export default App;