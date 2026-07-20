import type { Widget } from "./types";
import { ClockWidget } from "./items/Clock";

export const WIDGETS: Widget[] = [ClockWidget];

export function getWidget(id: string): Widget | undefined {
  return WIDGETS.find((w) => w.id === id);
}