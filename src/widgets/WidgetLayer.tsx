import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getWidget } from "./registry";
import type { WidgetPlacement, WidgetSizeMode } from "./types";
import "./widgets.css";

type ActivityPayload = { app: string; activity: string; fullscreen: boolean };

/**
 * Older saves stored one x/y for every mode. Lift those into the new
 * per-mode shape rather than dropping the user's placement on the floor.
 */
function migratePlacement(raw: unknown): WidgetPlacement {
  const p = raw as Record<string, unknown>;
  if (p.full && p.compact) return p as unknown as WidgetPlacement;
  const x = typeof p.x === "number" ? p.x : 0.5;
  const y = typeof p.y === "number" ? p.y : 0.3;
  return {
    id: String(p.id ?? "clock"),
    full: { x, y },
    compact: { x: 0.93, y: 0.04 },
    enabled: p.enabled !== false,
    config: (p.config as Record<string, unknown>) ?? {},
  };
}

function WidgetLayer() {
  const [placements, setPlacements] = useState<WidgetPlacement[]>([]);
  const [mode, setMode] = useState<WidgetSizeMode>("full");
  const [hue, setHue] = useState(15);
  const [now, setNow] = useState(new Date());
  const rootRef = useRef<HTMLDivElement>(null);

  // Load placements + hue, and keep them synced.
  useEffect(() => {
    invoke<unknown[]>("get_widgets")
      .then((raw) => setPlacements(raw.map(migratePlacement)))
      .catch(() => {});
    invoke<{ hue: number }>("get_species")
      .then((s) => setHue(s.hue))
      .catch(() => {});

    const unlistenWidgets = listen<unknown[]>("widgets-changed", (e) =>
      setPlacements(e.payload.map(migratePlacement)),
    );
    // Desktop-focus drives the size mode: an app in front → compact; the bare
    // desktop → full. Same focus signal the pet already reacts to.
    const unlistenActivity = listen<ActivityPayload>("activity-changed", (e) => {
      console.log("widget activity:", e.payload);
      const onDesktop =
        e.payload.app === "File Explorer" || e.payload.app.trim() === "";
      setMode(e.payload.fullscreen ? "hidden" : onDesktop ? "full" : "compact");
    });
    return () => {
      unlistenWidgets.then((f) => f());
      unlistenActivity.then((f) => f());
    };
  }, []);

  // Tick once a second for time-based widgets.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Publish hit-rects so the cursor passes through everywhere except the
  // widgets themselves — the exact machinery the pet uses.
  useEffect(() => {
    const publish = () => {
      const rects: [number, number, number, number][] = [];
      rootRef.current
        ?.querySelectorAll<HTMLElement>(".widget-hittable")
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width && r.height) rects.push([r.left, r.top, r.width, r.height]);
        });
      invoke("set_widget_hit_rects", { rects }).catch(() => {});
    };
    publish();
    const t = window.setInterval(publish, 250);
    return () => window.clearInterval(t);
  }, [placements, mode]);

  // TEMP: until the management panel exists, seed the clock so there's
  // something to see. Migrates old single-position saves on the way in.
  const seeded: WidgetPlacement[] =
    placements.length > 0
      ? placements
      : [
          {
            id: "clock",
            full: { x: 0.5, y: 0.3 },
            compact: { x: 0.93, y: 0.04 },
            enabled: true,
            config: { theme: "auto" },
          },
        ];
  const enabled = seeded.filter((p) => p.enabled);

  // Drag a widget to reposition it. Position is stored as a fraction of the
  // screen so it survives resolution changes, and persisted on release.
  const startDrag = (
    e: React.PointerEvent,
    idx: number,
    dragMode: WidgetSizeMode,
  ) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = enabled[idx];
    const origPos = dragMode === "compact" ? orig.compact : orig.full;
    const key = dragMode === "compact" ? "compact" : "full";
    const w = window.innerWidth;
    const h = window.innerHeight;

    const onMove = (ev: PointerEvent) => {
      const nx = Math.min(1, Math.max(0, origPos.x + (ev.clientX - startX) / w));
      const ny = Math.min(1, Math.max(0, origPos.y + (ev.clientY - startY) / h));
      setPlacements((prev) => {
        const base = prev.length ? prev : seeded;
        // Only the dragged mode's position changes; the other is untouched.
        return base.map((p, i) =>
          i === idx ? { ...p, [key]: { x: nx, y: ny } } : p,
        );
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // Persist whatever the final positions are.
      setPlacements((prev) => {
        const final = prev.length ? prev : seeded;
        invoke("set_widgets", { widgets: final }).catch(() => {});
        return final;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div ref={rootRef} className="widget-layer">
      {enabled.map((p, idx) => {
        const widget = getWidget(p.id);
        if (!widget) return null;
        // Fall back to the nearest supported mode.
        const useMode = widget.sizeModes.includes(mode)
          ? mode
          : widget.sizeModes.includes("full")
            ? "full"
            : widget.sizeModes[0];
        // Position comes from whichever mode is showing, so dragging in
        // compact moves only the compact placement.
        const pos = useMode === "compact" ? p.compact : p.full;
        return (
          <div
            key={`${p.id}-${idx}`}
            className="widget-slot"
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
            onPointerDown={(e) => startDrag(e, idx, useMode)}
          >
            {widget.render({ mode: useMode, hue, now }, p.config)}
          </div>
        );
      })}
    </div>
  );
}

export default WidgetLayer;