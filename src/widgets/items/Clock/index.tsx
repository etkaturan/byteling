import type { Widget, WidgetContext, WidgetConfig } from "../../types";
import Clock3D from "./Clock3D";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Day between 07:00 and 19:00, unless the config overrides it. */
function themeFor(now: Date, config: WidgetConfig): "day" | "night" {
  const forced = config.theme as string | undefined;
  if (forced === "day" || forced === "night") return forced;
  const h = now.getHours();
  return h >= 7 && h < 19 ? "day" : "night";
}

function render(ctx: WidgetContext, config: WidgetConfig) {
  if (ctx.mode === "hidden") return null;

  // Compact: a small plain time in the corner, no WebGL — cheap and calm.
  if (ctx.mode === "compact") {
    return (
      <div
        className="widget-hittable"
        style={{
          padding: "6px 12px",
          borderRadius: 10,
          background: "rgba(12,10,10,0.7)",
          backdropFilter: "blur(6px)",
          color: "#e6e8ee",
          fontSize: 15,
          fontFamily: "system-ui, sans-serif",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {pad(ctx.now.getHours())}:{pad(ctx.now.getMinutes())}
      </div>
    );
  }

  // Full: the real 3D clock, floating, no background.
  const theme = themeFor(ctx.now, config);
  return (
    <div className="widget-hittable" style={{ pointerEvents: "auto" }}>
      <Clock3D theme={theme} hue={ctx.hue} size={340} />
    </div>
  );
}

export const ClockWidget: Widget = {
  id: "clock",
  name: "Clock",
  description: "A 3D clock that glows at night and gleams by day.",
  sizeModes: ["full", "compact", "hidden"],
  render,
  defaultConfig: { theme: "auto" },
  defaultPos: { x: 0.5, y: 0.3 },
  // Top-right by default — visible but out of the way while you work.
  defaultCompactPos: { x: 0.93, y: 0.04 },
};