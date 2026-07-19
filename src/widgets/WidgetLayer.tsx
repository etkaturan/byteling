import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getWidget } from "./registry";
import type { WidgetPlacement, WidgetSizeMode } from "./types";
import "./widgets.css";

type ActivityPayload = { app: string; activity: string; fullscreen: boolean };

function WidgetLayer() {
  const [placements, setPlacements] = useState<WidgetPlacement[]>([]);
  const [mode, setMode] = useState<WidgetSizeMode>("full");
  const [hue, setHue] = useState(15);
  const [now, setNow] = useState(new Date());
  const rootRef = useRef<HTMLDivElement>(null);

  // Load placements + hue, and keep them synced.
  useEffect(() => {
    invoke<WidgetPlacement[]>("get_widgets").then(setPlacements).catch(() => {});
    invoke<{ hue: number }>("get_species")
      .then((s) => setHue(s.hue))
      .catch(() => {});

    const unlistenWidgets = listen<WidgetPlacement[]>("widgets-changed", (e) =>
      setPlacements(e.payload),
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

  // TEMP: until the management panel exists, show the placeholder so we can
  // verify the platform renders, hit-tests, and reacts to focus.
  const seeded: WidgetPlacement[] =
    placements.length > 0
      ? placements
      : [{ id: "placeholder", x: 0.5, y: 0.35, enabled: true, config: {} }];
  const enabled = seeded.filter((p) => p.enabled);

  return (
    <div ref={rootRef} className="widget-layer">
      {enabled.map((p) => {
        const widget = getWidget(p.id);
        if (!widget) return null;
        // Fall back to the nearest supported mode.
        const useMode = widget.sizeModes.includes(mode)
          ? mode
          : widget.sizeModes.includes("full")
            ? "full"
            : widget.sizeModes[0];
        return (
          <div
            key={`${p.id}-${p.x}-${p.y}`}
            className="widget-slot"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          >
            {widget.render({ mode: useMode, hue, now }, p.config)}
          </div>
        );
      })}
    </div>
  );
}

export default WidgetLayer;