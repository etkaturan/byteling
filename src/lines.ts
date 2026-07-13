// Canned speech lines, grouped by trigger. Each trigger can have mood-specific
// variants; we pick "up" (happy) or "down" (unwell) based on current mood,
// falling back to "neutral". The LLM will later be able to override any of these.

import type { Mood } from "./Creature";

export type Tone = "up" | "down" | "neutral";

/** Map a mood to a tone bucket for line selection. */
export function toneFor(mood: Mood): Tone {
  if (mood === "Thriving" || mood === "Content") return "up";
  if (mood === "Unwell" || mood === "Critical") return "down";
  return "neutral";
}

type LineSet = Partial<Record<Tone, string[]>>;

/** Pick a random line for a trigger, honoring mood tone with fallback. */
export function pickLine(
  trigger: keyof typeof LINES,
  mood: Mood,
): string | null {
  const set: LineSet = LINES[trigger];
  if (!set) return null;
  const tone = toneFor(mood);
  const pool = set[tone] ?? set.neutral ?? [];
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const LINES = {
  greet: {
    up: ["Oh, you're back! Hi!", "There you are! Missed you.", "Yay, company!"],
    down: ["Oh… it's you. Hi.", "Back already? I don't feel great.", "*groans* …hey."],
    neutral: ["Hey there.", "Hello again.", "Oh, hi!"],
  },
  farewell: {
    up: ["Bye! Come back soon!", "See ya! 👋", "Later! I'll be here."],
    down: ["Leaving me like this? …fine.", "Bye, I guess.", "*sigh* …see you."],
    neutral: ["Bye for now!", "See you later.", "Take care!"],
  },
  idle: {
    up: ["*hums quietly*", "*stretches*", "Nice and cozy in here."],
    down: ["*yawns*", "*grumbles*", "I could use some care…"],
    neutral: ["*yawns*", "*looks around*", "*blinks slowly*"],
  },
  groomDone: {
    up: ["Ahh, squeaky clean! Thank you!", "So fresh! You're the best.", "*happy wiggle*"],
    down: ["Better… but still not great in here.", "A start, I suppose.", "Okay, that helped a little."],
    neutral: ["Much better, thanks!", "Ah, tidier already.", "That feels nice."],
  },
  moodUp: {
    neutral: ["Feeling better already!", "Ooh, that's an improvement!", "*perks up*"],
  },
  moodDown: {
    neutral: ["Hmm, I'm not feeling so good…", "Something's off…", "*droops*"],
  },
  lateNight: {
    up: ["It's late, you know! But I'm having fun.", "Past midnight — still going strong?"],
    down: ["It's so late… we should both rest.", "Late night and I feel awful. Bed?"],
    neutral: ["It's getting late. Don't stay up too long!", "Late night session, huh?"],
  },
} satisfies Record<string, LineSet>;