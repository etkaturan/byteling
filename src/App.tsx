import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Creature, { Species, Mood } from "./Creature";
import SpeechBubble from "./SpeechBubble";
import { useChatter } from "./useChatter";
import { recordSwitch, recentApps, isDizzy } from "./activityBrain";
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
  const [dizzy, setDizzy] = useState(false);

  const lastClick = { current: 0 } as { current: number };

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if ((e.target as HTMLElement).closest(".pet-menu")) return;
    if (e.button !== 0) return;

    const now = Date.now();
    if (now - lastClick.current < 300) {
      say("petted", true);
      lastClick.current = 0;
      return;
    }
    lastClick.current = now;
    getCurrentWindow().startDragging().catch(console.error);
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen((v) => !v);
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

    const unlistenPet = listen<PetState>("pet-state-changed", (e) =>
      setPet(e.payload),
    );

    let activityTimer: number | null = null;
    let lastActivitySpoke = 0;
    const unlistenActivity = listen<{
      app: string;
      activity: string;
      fullscreen: boolean;
    }>("activity-changed", (e) => {
      const { app, activity, fullscreen } = e.payload;
      recordSwitch(app);

      if (isDizzy()) {
        setDizzy(true);
        say("dizzy", true, { dizzy: true, recent_apps: recentApps() });
        window.setTimeout(() => setDizzy(false), 5000);
        return;
      }

      if (fullscreen) return; // still stay quiet in fullscreen
      // (removed the `activity === "Other"` skip so every named app reacts)

      // Settle ~1.5s in the app, then react — with its own 5s cooldown,
      // bypassing the global chatter floor so app-changes reliably speak.
      if (activityTimer) window.clearTimeout(activityTimer);
      activityTimer = window.setTimeout(() => {
        const now = Date.now();
        if (now - lastActivitySpoke < 5000) return;
        lastActivitySpoke = now;
        say("activity", true, { app, recent_apps: recentApps() });
      }, 1500);
    });

    return () => {
      unlistenPet.then((f) => f());
      unlistenActivity.then((f) => f());
      if (activityTimer) window.clearTimeout(activityTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!species) return null;

  return (
    <main className="stage" onMouseDown={startDrag}>
      {line && <SpeechBubble text={line} onDismiss={dismiss} />}

      <div
        className={`creature-holder ${dizzy ? "dizzy" : ""}`}
        data-tauri-drag-region
        onContextMenu={onContext}
      >
        <Creature species={species} mood={mood} size={150} />
      </div>

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
          <button className="menu-item" onClick={() => setShowStats((v) => !v)}>
            {showStats ? "Hide stats" : "Show stats"}
          </button>
        </div>
      )}

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
            <button className="care-btn no" onClick={() => setGroomPreview(null)}>
              No
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;