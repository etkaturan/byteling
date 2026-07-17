// Tracks recent app switches to feed the LLM and detect "dizzy" spells.

const RECENT_MAX = 5;
const DIZZY_WINDOW_MS = 20_000;
const DIZZY_THRESHOLD = 6; // this many DISTINCT app switches in the window = dizzy

const recent: string[] = [];
const switchTimes: number[] = [];

export function recordSwitch(app: string) {
  // Only count a genuine change of app. The Win32 focus hook can fire more
  // than once for a single perceived switch (an intermediate window briefly
  // gets focus during alt-tab), and those repeats used to count toward
  // dizziness, tripping it after one real switch.
  const isNewSwitch = recent[recent.length - 1] !== app;
  if (!isNewSwitch) return;

  recent.push(app);
  while (recent.length > RECENT_MAX) recent.shift();

  const now = Date.now();
  switchTimes.push(now);
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