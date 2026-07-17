/**
 * What the site Byteling says, keyed by section. This mirrors the app's
 * app-awareness mechanic: on your desktop it comments on which app you focus,
 * here it comments on what you're reading. Same idea, different signal.
 */
export type SectionId = "hero" | "how" | "privacy" | "download" | "source";

export const LINES: Record<SectionId, string[]> = {
  hero: [
    "Oh — a visitor. Hello.",
    "You made it. Come in.",
    "Hi. I'm what your computer looks like.",
  ],
  how: [
    "Yours won't look like me. Different hardware, different creature.",
    "My colour, my limbs — all of it came from a machine.",
    "Six limbs because six cores. That's the whole trick.",
  ],
  privacy: [
    "I only read app names. Never what's in them.",
    "Nothing leaves your machine. Nothing.",
    "No telemetry. I'm not that kind of pet.",
  ],
  download: [
    "This is the part where you get your own.",
    "Go on. Mine's lonely up here.",
    "It's free. There's no catch.",
  ],
  source: [
    "It's all open. Read how I work.",
    "Rust underneath, if you're curious.",
    "Every line of me is public.",
  ],
};

/** Pick a line for a section, avoiding an immediate repeat. */
export function lineFor(section: SectionId, previous?: string): string {
  const pool = LINES[section];
  const options = pool.filter((l) => l !== previous);
  return options[Math.floor(Math.random() * options.length)] ?? pool[0];
}