import type { Widget } from "./types";
import { PlaceholderWidget } from "./items/Placeholder";

export const WIDGETS: Widget[] = [PlaceholderWidget];

export function getWidget(id: string): Widget | undefined {
  return WIDGETS.find((w) => w.id === id);
}