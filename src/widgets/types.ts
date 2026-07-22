import type React from "react";

/** How much room a widget is allowed to take, decided by the platform from
 * desktop-focus state and broadcast to every widget. A widget honors the mode
 * however it likes — "collapse when an app opens" is this, not a special case. */
export type WidgetSizeMode = "full" | "compact" | "hidden";

/** Live context handed to every widget on each render. */
export type WidgetContext = {
  /** Current size mode, from the platform's focus tracking. */
  mode: WidgetSizeMode;
  /** The pet's hue, so widgets can match the house colour if they want. */
  hue: number;
  now: Date;
};

/** Per-widget saved settings — freeform, each widget defines its own shape. */
export type WidgetConfig = Record<string, unknown>;

export type WidgetPos = { x: number; y: number };

/**
 * A placed widget instance on the desktop. Full and compact keep SEPARATE
 * positions — the big clock can live centre-screen while its minimal form
 * parks in a corner, so switching modes doesn't drag one out of place.
 */
export type WidgetPlacement = {
  id: string; // which widget (matches registry)
  full: WidgetPos;
  compact: WidgetPos;
  enabled: boolean;
  config: WidgetConfig;
};

export type Widget = {
  id: string;
  name: string;
  description: string;
  /** Which modes this widget supports. If it lacks the platform's requested
   * mode, the platform falls back to the nearest one it does support. */
  sizeModes: WidgetSizeMode[];
  /** Draws the widget for the given context. Must render its own shape so the
   * hit-test (getBBox) is tight — same rule as the pet. */
  render: (ctx: WidgetContext, config: WidgetConfig) => React.ReactNode;
  /** Default placement when first enabled. */
  defaultConfig: WidgetConfig;
  defaultPos: WidgetPos;
  /** Where the compact form sits by default — usually out of the way. */
  defaultCompactPos: WidgetPos;
};