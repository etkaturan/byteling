import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Species, Mood } from "./Creature";
import SpeechBubble from "./SpeechBubble";
import { useChatter } from "./useChatter";
import { recordSwitch, recentApps, isDizzy } from "./activityBrain";
import PetView from "./pets/PetView";
import { getCharacter, CHARACTERS } from "./pets/registry";
import type { Action } from "./pets/types";
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
  const [activeCharId, setActiveCharId] = useState("hardware");
  const [action] = useState<Action>("idle");
  const [dizzy, setDizzy] = useState(false);
  const [vel, setVel] = useState({ vx: 0, vy: 0 });

  const dragRaf = useRef<number | null>(null);
  const lastPos = useRef<{ x: number; y: number; t: number } | null>(null);

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

  // While dragging, sample the window position each frame; the delta is the
  // velocity we hand to the creature so it leans and its limbs trail.
  const sampleVelocity = async () => {
    try {
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      const now = performance.now();
      if (lastPos.current) {
        const dt = Math.max(now - lastPos.current.t, 1);
        const vx = ((pos.x - lastPos.current.x) / dt) * 16;
        const vy = ((pos.y - lastPos.current.y) / dt) * 16;
        setVel({ vx, vy });
        console.log("vel", vx.toFixed(1), vy.toFixed(1));
      }
      lastPos.current = { x: pos.x, y: pos.y, t: now };
    } catch {
      /* window may be mid-move; ignore */
    }
    dragRaf.current = requestAnimationFrame(sampleVelocity);
    
  };

  const stopSampling = () => {
    if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
    dragRaf.current = null;
    lastPos.current = null;
    setVel({ vx: 0, vy: 0 });
  };

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

    // Start measuring motion; stop when the mouse is released anywhere.
    lastPos.current = null;
    if (!dragRaf.current) dragRaf.current = requestAnimationFrame(sampleVelocity);
    const onUp = () => {
      stopSampling();
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mouseup", onUp);

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
    invoke<string>("get_active_character").then(setActiveCharId);

    const unlistenChar = listen<string>("active-character-changed", (e) =>
      setActiveCharId(e.payload),
    );

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
      const { app, fullscreen } = e.payload;
      recordSwitch(app);

      if (isDizzy()) {
        setDizzy(true);
        say("dizzy", true, { dizzy: true, recent_apps: recentApps() });
        window.setTimeout(() => setDizzy(false), 5000);
        return;
      }

      if (fullscreen) return;

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
      unlistenChar.then((f) => f());
      if (activityTimer) window.clearTimeout(activityTimer);
      if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!species) return null;

  // The active character. For "hardware", inject the live species params.
  const baseChar = getCharacter(activeCharId) ?? CHARACTERS[0];
  const activeChar =
    baseChar.id === "hardware" && species
      ? { ...baseChar, params: species }
      : baseChar;

  return (
    <main className="stage" onMouseDown={startDrag}>
      {line && <SpeechBubble text={line} onDismiss={dismiss} />}

      <div
        className={`creature-holder ${dizzy ? "dizzy" : ""}`}
        data-tauri-drag-region
        onContextMenu={onContext}
      >
        <PetView
          character={activeChar}
          state={{
            mood,
            action,
            facing: vel.vx < 0 ? "left" : "right",
            size: 150,
          }}
          vx={vel.vx}
          vy={vel.vy}
        />
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
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              className="menu-item"
              onClick={() => {
                invoke("set_active_character", { id: c.id });
                setMenuOpen(false);
              }}
            >
              Become {c.name}
            </button>
          ))}
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