import type { Mood, Action } from "../types";

export type WearableSlot = "headwear" | "accessory" | "handtool" | "back";

/** Everything a wearable needs to render in sync with the pet wearing it. */
export type WearableRenderState = {
  mood: Mood;
  action: Action;
  /** Same velocity the creature uses for inertia — so held/worn items lag too. */
  vx: number;
  vy: number;
  /** The creature's own hue, so a wearable can tint itself to match if it wants. */
  hue: number;
};

export type WearableProps = {
  state: WearableRenderState;
};

export type Wearable = {
  id: string;
  name: string;
  slot: WearableSlot;
  bio: string;
  /** Renders the item, already positioned relative to the creature's 0-100 viewBox. */
  render: (props: WearableProps) => React.ReactNode;
  /** Marketplace-ready; unused in v4. */
  price: number;
  unlocked: boolean;
};