import type { Character } from "./types";

/**
 * All characters. Adding one = adding an entry here (+ a renderer if it's a
 * new kind). The hardware default's params are filled at runtime from the
 * machine's real species; the entry here is the template.
 */
export const CHARACTERS: Character[] = [
  {
    id: "hardware",
    name: "Your Byteling",
    bio: "The creature your machine hatched. One of a kind, like your hardware.",
    rendererKind: "procedural-creature",
    personality:
      "the living embodiment of the user's computer; mood mirrors the PC's health",
    unlocked: true,
    price: 0,
  },
  {
    id: "cat",
    name: "Tuxedo Cat",
    bio: "A calm black-and-white cat. Naps often, judges silently, loves a warm CPU.",
    rendererKind: "cat",
    personality:
      "an aloof but affectionate house cat; speaks in short, dry, slightly regal remarks; occasionally distracted by nothing",
    unlocked: true,
    price: 0,
  },
];

export function getCharacter(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}