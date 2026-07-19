import type { Widget, WidgetContext } from "../types";

function render(ctx: WidgetContext) {
  if (ctx.mode === "hidden") return null;
  const size = ctx.mode === "full" ? 120 : 60;
  return (
    <div
      className="widget-hittable"
      style={{
        width: size,
        height: size,
        borderRadius: 20,
        display: "grid",
        placeItems: "center",
        background: "rgba(20,16,15,0.82)",
        border: `1px solid hsl(${ctx.hue}, 60%, 45%)`,
        color: `hsl(${ctx.hue}, 80%, 70%)`,
        fontSize: ctx.mode === "full" ? 13 : 10,
        fontFamily: "system-ui, sans-serif",
        backdropFilter: "blur(8px)",
      }}
    >
      {ctx.mode === "full" ? "widget" : "•"}
    </div>
  );
}

export const PlaceholderWidget: Widget = {
  id: "placeholder",
  name: "Placeholder",
  description: "Proves the platform works. Replaced by real widgets.",
  sizeModes: ["full", "compact", "hidden"],
  render,
  defaultConfig: {},
  defaultPos: { x: 0.5, y: 0.3 },
};