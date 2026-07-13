import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Creature, { Species, Mood } from "./Creature";
import SpeechBubble from "./SpeechBubble";
import { useChatter } from "./useChatter";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const mood: Mood = pet?.mood ?? "Content";
  const creatureName = species
    ? `${species.life_stage} ${species.family}`
    : "Byteling";
  const hint =
    pet?.needs.space != null && pet.needs.space < 20
      ? "disk nearly full"
      : pet?.mood === "Critical" || pet?.mood === "Unwell"
        ? "not feeling well"
        : "all is well";
  const { line, say, dismiss } = useChatter(mood, {
    creature: creatureName,
    hint,
  });

  const lastClick = { current: 0 } as { current: number };

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if ((e.target as HTMLElement).closest(".pet-menu")) return;
    if (e.button !== 0) return;

    const now = Date.now();
    if (now - lastClick.current < 300) {
      // Double-click detected → pet it, don't drag.
      say("petted", true);
      lastClick.current = 0;
      return;
    }
    lastClick.current = now;
    getCurrentWindow().startDragging().catch(console.error);
  };

  // Right-click the creature → toggle the action menu.
  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen((v) => !v);
  };

  // Double-click → pet it: a quick happy reaction.
  const onDoubleClick = () => {
    console.log("double-clicked!");
    say("petted", true);
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
      say("groomDone", true);
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

  return (
    <main className="stage" onMouseDown={startDrag}>
      {line && <SpeechBubble text={line} onDismiss={dismiss} />}

      <div
        className="creature-holder"
        data-tauri-drag-region
        onContextMenu={onContext}
        onDoubleClick={onDoubleClick}
      >
        <Creature species={species} mood={mood} size={150} />
      </div>

      {/* Stats appear only when toggled on. */}
      {showStats && pet && (
        <div className="debug">
          {mood} ({Math.round(pet.mood_score)})
          <div className="needs">
            C{Math.round(pet.needs.comfort)} · S
            {pet.needs.space === null ? "–" : Math.round(pet.needs.space)} · T
            {pet.needs.tidiness === null ? "–" : Math.round(pet.needs.tidiness)} · R
            {Math.round(pet.needs.rest)} · E{Math.round(pet.needs.energy)}
          </div>
        </div>
      )}

      {/* Right-click menu. */}
      {menuOpen && !groomPreview && (
        <div className="pet-menu">
          <button
            className="menu-item"
            onClick={() => {
              setMenuOpen(false);
              requestGroom();
            }}
            disabled={grooming}
          >
            {grooming ? "Grooming…" : groomMsg ?? "🧹 Groom"}
          </button>
          <button
            className="menu-item"
            onClick={() => setShowStats((v) => !v)}
          >
            {showStats ? "Hide stats" : "Show stats"}
          </button>
        </div>
      )}

      {/* Groom confirmation. */}
      {groomPreview && (
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
      )}
    </main>
  );
}

export default App;