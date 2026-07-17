import Creature, { Species } from "../Creature";
import CatRenderer from "./renderers/CatRenderer";
import type { Character, PetRenderState } from "./types";
import { getWearable, type Loadout } from "./wearables/registry";
import type { Wearable } from "./wearables/types";

type Props = {
  character: Character;
  state: PetRenderState;
  vx?: number;
  vy?: number;
  /** Equipped wearables, one per slot. Drawn inside the pet's own SVG. */
  loadout?: Loadout;
};

function equippedItems(loadout: Loadout | undefined): Wearable[] {
  if (!loadout) return [];
  return Object.values(loadout)
    .map((id) => (id ? getWearable(id) : undefined))
    .filter((w): w is Wearable => !!w);
}

function PetView({ character, state, vx = 0, vy = 0, loadout }: Props) {
  const hue = character.params?.hue ?? 200;
  const items = equippedItems(loadout);
  const renderState = { mood: state.mood, action: state.action, vx, vy, hue };

  // Back attachments (tail, wings) render BEHIND the body; everything else
  // (headwear, accessories, held items) renders above it.
  const backItems = items.filter((w) => w.slot === "back");
  const frontItems = items.filter((w) => w.slot !== "back");

  const backOverlay = backItems.length ? (
    <>
      {backItems.map((w) => (
        <g key={w.id}>{w.render({ state: renderState })}</g>
      ))}
    </>
  ) : null;

  const overlay = frontItems.length ? (
    <>
      {frontItems.map((w) => (
        <g key={w.id}>{w.render({ state: renderState })}</g>
      ))}
    </>
  ) : null;

  if (character.rendererKind === "cat") {
    // Cat renderer doesn't accept a wearable layer yet — extend it the same
    // way once a cat is a real target for accessories.
    return <CatRenderer character={character} state={state} />;
  }

  const species: Species = {
    family: character.params?.family ?? "Grounded",
    life_stage: character.params?.life_stage ?? "Adult",
    build: character.params?.build ?? "Sturdy",
    hue,
    limbs: character.params?.limbs ?? 4,
    markings: character.params?.markings ?? 2,
    liveliness: character.params?.liveliness ?? 1,
  };

  return (
    <Creature
      species={species}
      mood={state.mood}
      size={state.size}
      vx={vx}
      vy={vy}
      backOverlay={backOverlay}
      overlay={overlay}
    />
  );
}

export default PetView;