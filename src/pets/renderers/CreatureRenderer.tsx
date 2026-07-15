import Creature, { Species } from "../../Creature";
import type { RendererProps } from "../types";

type Props = RendererProps & { vx?: number; vy?: number };

function CreatureRenderer({ character, state, vx = 0, vy = 0 }: Props) {
  const species: Species = {
    family: character.params?.family ?? "Grounded",
    life_stage: character.params?.life_stage ?? "Adult",
    build: character.params?.build ?? "Sturdy",
    hue: character.params?.hue ?? 200,
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
    />
  );
}

export default CreatureRenderer;