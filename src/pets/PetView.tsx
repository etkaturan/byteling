import type { Character, PetRenderState } from "./types";
import CreatureRenderer from "./renderers/CreatureRenderer";
import CatRenderer from "./renderers/CatRenderer";

type Props = {
  character: Character;
  state: PetRenderState;
  vx?: number;
  vy?: number;
};

function PetView({ character, state, vx = 0, vy = 0 }: Props) {
  switch (character.rendererKind) {
    case "cat":
      return <CatRenderer character={character} state={state} />;
    case "procedural-creature":
    default:
      return (
        <CreatureRenderer character={character} state={state} vx={vx} vy={vy} />
      );
  }
}

export default PetView;