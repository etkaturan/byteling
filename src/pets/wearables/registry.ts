import type { Wearable, WearableSlot } from "./types";
import { makeHalo } from "./items/headwear/Halo";
import { Tail } from "./items/back/Tail";
import { Wings } from "./items/back/Wings";
import { makeLightsaber } from "./items/handtools/Lightsaber";

export const WEARABLES: Wearable[] = [
  {
    id: "halo-white",
    name: "Halo (White)",
    slot: "headwear",
    bio: "A ring of soft light. Sheds the occasional feather.",
    render: makeHalo("white"),
    price: 0,
    unlocked: true,
  },
  {
    id: "halo-purple",
    name: "Halo (Purple)",
    slot: "headwear",
    bio: "A darker sort of light. Thorned, and a little ominous.",
    render: makeHalo("purple"),
    price: 0,
    unlocked: true,
  },
  {
    id: "halo-red",
    name: "Halo (Red)",
    slot: "headwear",
    bio: "It flickers, and sends up the occasional ember.",
    render: makeHalo("red"),
    price: 0,
    unlocked: true,
  },
  {
    id: "halo-green",
    name: "Halo (Green)",
    slot: "headwear",
    bio: "A ring caught in its own small, gentle wind.",
    render: makeHalo("green"),
    price: 0,
    unlocked: true,
  },
  {
    id: "tail",
    name: "Tail",
    slot: "back",
    bio: "A little something to sway when it walks.",
    render: Tail,
    price: 0,
    unlocked: true,
  },
  {
    id: "wings",
    name: "Angel Wings",
    slot: "back",
    bio: "Feathered, white, and prone to shedding one now and then.",
    render: Wings,
    price: 0,
    unlocked: true,
  },
  {
    id: "lightsaber-blue",
    name: "Lightsaber (Blue)",
    slot: "handtool",
    bio: "Purely ornamental. Please don't start anything.",
    render: makeLightsaber("blue"),
    price: 0,
    unlocked: true,
  },
  {
    id: "lightsaber-green",
    name: "Lightsaber (Green)",
    slot: "handtool",
    bio: "Purely ornamental. Please don't start anything.",
    render: makeLightsaber("green"),
    price: 0,
    unlocked: true,
  },
  {
    id: "lightsaber-red",
    name: "Lightsaber (Red)",
    slot: "handtool",
    bio: "Purely ornamental. Please don't start anything.",
    render: makeLightsaber("red"),
    price: 0,
    unlocked: true,
  },
  {
    id: "lightsaber-purple",
    name: "Lightsaber (Purple)",
    slot: "handtool",
    bio: "Purely ornamental. Please don't start anything.",
    render: makeLightsaber("purple"),
    price: 0,
    unlocked: true,
  },
];

export function getWearable(id: string): Wearable | undefined {
  return WEARABLES.find((w) => w.id === id);
}

export function wearablesInSlot(slot: WearableSlot): Wearable[] {
  return WEARABLES.filter((w) => w.slot === slot);
}

/** One equipped item per slot, at most. */
export type Loadout = Partial<Record<WearableSlot, string>>;