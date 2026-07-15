// The vocabulary every pet speaks. Mood (from health) and action (from
// behavior) are separate axes that combine — a pet can be Unwell AND Moving.

import type { Mood } from "../Creature";

export type { Mood };

/** What the pet is *doing* (separate from how it *feels*). */
export type Action = "idle" | "moving" | "sleeping";

/** Which way it faces/moves, for directional animations. */
export type Facing = "left" | "right";

/** The full render state handed to any renderer. */
export type PetRenderState = {
  mood: Mood;
  action: Action;
  facing: Facing;
  size: number;
};

/** Species params for the procedural (hardware) creature. */
export type CreatureParams = {
  family: "Aerial" | "Grounded";
  life_stage: "Hatchling" | "Adult" | "Elder";
  build: "Slight" | "Sturdy" | "Mighty";
  hue: number;
  limbs: number;
  markings: number;
  liveliness: number;
};

/** How a character is drawn. Extend with "sprite" later — no caller changes. */
export type RendererKind = "procedural-creature" | "cat";

/** A character = identity + which renderer + its params. Data, not code. */
export type Character = {
  id: string;
  name: string;
  bio: string;
  rendererKind: RendererKind;
  /** Renderer-specific params (creature params, or empty for the cat). */
  params?: Partial<CreatureParams>;
  /** Personality descriptor that shapes the LLM voice (used later). */
  personality: string;
  /** Marketplace-ready, unused for now. */
  unlocked: boolean;
  price: number;
};

/** Every renderer component receives exactly this. */
export type RendererProps = {
  character: Character;
  state: PetRenderState;
};