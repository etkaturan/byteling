import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Creature, { Species, Mood } from "./Creature";
import "./App.css";

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

type GroomReport = {
  freed_mb: number;
  files_removed: number;
  files_skipped: number;
};

function App() {
  const [species, setSpecies] = useState<Species | null>(null);
  const [pet, setPet] = useState<PetState | null>(null);
  const [grooming, setGrooming] = useState(false);
  const [groomMsg, setGroomMsg] = useState<string | null>(null);
  const [groomPreview, setGroomPreview] = useState<GroomReport | null>(null);

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.button === 0) {
      getCurrentWindow().startDragging().catch(console.error);
    }
  };

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

  if (!species) return null;

  const mood: Mood = pet?.mood ?? "Content";

  return (
    <main className="stage" onMouseDown={startDrag}>
      <div className="creature-holder" data-tauri-drag-region>
        <Creature species={species} mood={mood} size={150} />
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
            <button className="care-btn no" onClick={() => setGroomPreview(null)}>
              No
            </button>
          </div>
        </div>
      ) : (
        <button className="care-btn" onClick={requestGroom} disabled={grooming}>
          {grooming ? "Grooming…" : groomMsg ?? "🧹 Groom"}
        </button>
      )}
    </main>
  );
}

export default App;