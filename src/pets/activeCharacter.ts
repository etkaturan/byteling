import { CHARACTERS } from "./registry";
import type { Character } from "./types";

// Which character is active. Persisted in localStorage-free way: we keep it in
// memory + a Tauri-side store would be ideal, but for now module state + a
// simple getter/setter with a change callback.

let activeId = "hardware";
const listeners = new Set<(c: Character) => void>();

export function getActiveCharacter(): Character {
  return CHARACTERS.find((c) => c.id === activeId) ?? CHARACTERS[0];
}

export function setActiveCharacter(id: string) {
  if (CHARACTERS.some((c) => c.id === id)) {
    activeId = id;
    const active = getActiveCharacter();
    listeners.forEach((fn) => fn(active));
  }
}

export function onActiveCharacterChange(fn: (c: Character) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}