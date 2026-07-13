// Tracks recent app switches to feed the LLM and detect "dizzy" spells.

const RECENT_MAX = 5;
const DIZZY_WINDOW_MS = 30_000;
const DIZZY_THRESHOLD = 5; // this many switches in the window = dizzy

const recent: string[] = [];
const switchTimes: number[] = [];

export function recordSwitch(app: string) {
  if (recent[recent.length - 1] !== app) {
    recent.push(app);
    while (recent.length > RECENT_MAX) recent.shift();
  }
  const now = Date.now();
  switchTimes.push(now);
  // Drop switches older than the window.
  while (switchTimes.length && now - switchTimes[0] > DIZZY_WINDOW_MS) {
    switchTimes.shift();
  }
}

export function recentApps(): string[] {
  return [...recent];
}

export function isDizzy(): boolean {
  return switchTimes.length >= DIZZY_THRESHOLD;
}