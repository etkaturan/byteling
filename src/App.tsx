import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  getCurrentWindow,
  currentMonitor,
  LogicalPosition,
} from "@tauri-apps/api/window";
import { Species, Mood } from "./Creature";
import SpeechBubble from "./SpeechBubble";
import { useChatter } from "./useChatter";
import { recordSwitch, recentApps, isDizzy } from "./activityBrain";
import PetView from "./pets/PetView";
import { getCharacter, CHARACTERS } from "./pets/registry";
import type { Loadout } from "./pets/wearables/registry";
import type { Action } from "./pets/types";
import TrailEffect from "./effects/TrailEffect";
import { RoamBrain, configFor, type RoamMode } from "./roaming";
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
  const [trailOn, setTrailOn] = useState(true);
  const [roamMode, setRoamMode] = useState<RoamMode>("still");
  const [loadout, setLoadout] = useState<Loadout>({});

  const userControlling = useRef(false);
  const roamRaf = useRef<number | null>(null);
  const brain = useRef<RoamBrain | null>(null);
  const fullscreenNow = useRef(false);

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
    // Only drag from real pet pixels — not the transparent window area.
    const t = e.target as Element;
    if (!(t instanceof SVGElement) || t.tagName.toLowerCase() === "svg") return;

    // Rail: the user always wins — abandon the wander plan instantly.
    userControlling.current = true;
    brain.current?.interrupt();

    const now = Date.now();
    if (now - lastClick.current < 300) {
      say("petted", true);
      lastClick.current = 0;
      userControlling.current = false;
      return;
    }
    lastClick.current = now;

    lastPos.current = null;
    if (!dragRaf.current) dragRaf.current = requestAnimationFrame(sampleVelocity);
    const onUp = () => {
      stopSampling();
      userControlling.current = false;
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
    // The webview can be ready before Rust's setup() has managed AppState —
    // in the packaged build this race left the pet permanently invisible,
    // since the whole overlay is gated on species. Retry until it lands.
    let speciesTries = 0;
    const fetchSpecies = () => {
      invoke<Species>("get_species")
        .then(setSpecies)
        .catch(() => {
          if (speciesTries++ < 40) window.setTimeout(fetchSpecies, 150);
          else console.error("get_species never resolved");
        });
    };
    fetchSpecies();

    invoke<PetState | null>("get_pet_state")
      .then((s) => {
        if (s) setPet(s);
      })
      .catch(() => {});
    invoke<string>("get_active_character").then(setActiveCharId).catch(() => {});
    invoke<boolean>("get_trail_enabled").then(setTrailOn).catch(() => {});
    invoke<string>("get_roam_mode").then((m) => setRoamMode(m as RoamMode));
    invoke<Loadout>("get_loadout").then(setLoadout).catch(() => {});

    const unlistenChar = listen<string>("active-character-changed", (e) =>
      setActiveCharId(e.payload),
    );
    const unlistenPet = listen<PetState>("pet-state-changed", (e) =>
      setPet(e.payload),
    );
    const unlistenTrail = listen<boolean>("trail-enabled-changed", (e) =>
      setTrailOn(e.payload),
    );
    const unlistenRoam = listen<string>("roam-mode-changed", (e) =>
      setRoamMode(e.payload as RoamMode),
    );
    const unlistenLoadout = listen<Loadout>("loadout-changed", (e) =>
      setLoadout(e.payload),
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
      fullscreenNow.current = fullscreen; // rail: no roaming in fullscreen

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
    

    // Publish the regions that should catch the mouse: the pet's real drawn
    // bounds (getBBox follows the art, whatever pet it is) plus any open UI.
    // Rust checks the cursor against these — everything else is click-through.
    const publishHitRects = () => {
      const rects: [number, number, number, number][] = [];

      const svg = document.querySelector(
        ".creature-holder svg",
      ) as SVGSVGElement | null;
      if (svg) {
        // getBBox is the ink's bounds in the SVG's own units; map it back to
        // page px via the rendered rect so it works at any size/scale.
        try {
          const bb = svg.getBBox();
          const r = svg.getBoundingClientRect();
          const vb = svg.viewBox.baseVal;
          if (vb && vb.width > 0 && vb.height > 0) {
            const sx = r.width / vb.width;
            const sy = r.height / vb.height;
            rects.push([
              r.left + (bb.x - vb.x) * sx,
              r.top + (bb.y - vb.y) * sy,
              bb.width * sx,
              bb.height * sy,
            ]);
          } else {
            rects.push([r.left, r.top, r.width, r.height]);
          }
        } catch {
          const r = svg.getBoundingClientRect();
          rects.push([r.left, r.top, r.width, r.height]);
        }
      }

      for (const sel of [".pet-menu", ".confirm", ".bubble"]) {
        const el = document.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          rects.push([r.left, r.top, r.width, r.height]);
        }
      }

      invoke("set_hit_rects", { rects }).catch(() => {});
    };

    publishHitRects();
    const rectTimer = window.setInterval(publishHitRects, 250);

    return () => {
      window.clearInterval(rectTimer);
      unlistenPet.then((f) => f());
      unlistenActivity.then((f) => f());
      unlistenChar.then((f) => f());
      unlistenTrail.then((f) => f());
      unlistenRoam.then((f) => f());
      unlistenLoadout.then((f) => f());
      if (activityTimer) window.clearTimeout(activityTimer);
      if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The roaming loop. Rails: never while the user is controlling, never while
  // the user is active, never in fullscreen, never when mode is "still".
  // TEMP: move constantly, no rails. Just proving the pet can walk.
  // The roaming loop. All decisions live in RoamBrain; this just drives it
  // and enforces the rails.
  useEffect(() => {
    const cfg = configFor(roamMode);
    if (!cfg) {
      brain.current = null;
      setVel({ vx: 0, vy: 0 });
      return; // "still" — no autonomy at all
    }

    brain.current = new RoamBrain(cfg);
    let cancelled = false;

    const step = async () => {
      if (cancelled) return;
      try {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        const size = await win.outerSize();
        const mon = await currentMonitor();
        if (!mon || !brain.current) {
          roamRaf.current = requestAnimationFrame(step);
          return;
        }

        const idleMs = await invoke<number>("cursor_idle_ms");
        const blocked =
          userControlling.current ||
          fullscreenNow.current ||
          idleMs < cfg.idleBeforeRoamMs;

        const decision = brain.current.tick(
          { x: pos.x, y: pos.y },
          { x: mon.size.width, y: mon.size.height },
          { x: size.width, y: size.height },
          blocked,
        );

        if (decision.move && !decision.arrived) {
          await win.setPosition(
            new LogicalPosition(pos.x + decision.step.x, pos.y + decision.step.y),
          );
          setVel({ vx: decision.step.x * 4, vy: decision.step.y * 4 });
        } else {
          setVel({ vx: 0, vy: 0 });
        }
      } catch (err) {
        console.error("roam step failed:", err);
      }
      roamRaf.current = requestAnimationFrame(step);
    };

    roamRaf.current = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      if (roamRaf.current) cancelAnimationFrame(roamRaf.current);
      roamRaf.current = null;
    };
  }, [roamMode]);

  // Never render nothing — an invisible overlay is indistinguishable from a
  // crash, and gating the whole pet on one async call is what made the
  // packaged build launch blank.
  if (!species) {
    return (
      <main className="stage">
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
          }}
        />
      </main>
    );
  }

  const baseChar = getCharacter(activeCharId) ?? CHARACTERS[0];
  const activeChar =
    baseChar.id === "hardware" && species
      ? { ...baseChar, params: species }
      : baseChar;

  return (
    <main className="stage" onMouseDown={startDrag}>
      {line && <SpeechBubble text={line} onDismiss={dismiss} />}

      <TrailEffect
        vx={vel.vx}
        vy={vel.vy}
        color={species ? `hsl(${species.hue}, 90%, 65%)` : "#7ee081"}
        enabled={trailOn}
      />

      <div
        className={`creature-holder ${dizzy ? "dizzy" : ""}`}
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
          loadout={loadout}
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
          <button
            className="menu-item"
            onClick={async () => {
              setMenuOpen(false);
              const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
              const w = await WebviewWindow.getByLabel("chat");
              if (w) {
                await w.show();
                await w.setFocus();
              }
            }}
          >
            💬 Talk
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