import { useEffect, useRef, useState } from "react";
import { pickLine, LINES } from "./lines";
import type { Mood } from "./Creature";

type Trigger = keyof typeof LINES;

// Timing knobs for "balanced" talkativeness.
const IDLE_MIN_MS = 4 * 60_000; // earliest an idle line can appear
const IDLE_MAX_MS = 8 * 60_000; // latest
const MIN_GAP_MS = 90_000; // never speak more than once per 90s

/**
 * Watches mood + lifecycle and returns the current speech line (or null).
 * Call `say(trigger)` to request a line; it respects the rate limit.
 */
export function useChatter(mood: Mood) {
  const [line, setLine] = useState<string | null>(null);
  const lastSpokeAt = useRef(0);
  const prevMood = useRef<Mood | null>(null);
  const idleTimer = useRef<number | null>(null);

  // Core "speak" with rate limiting.
  const say = (trigger: Trigger, force = false) => {
    const now = Date.now();
    if (!force && now - lastSpokeAt.current < MIN_GAP_MS) return;
    const text = pickLine(trigger, mood);
    if (!text) return;
    lastSpokeAt.current = now;
    setLine(text);
    // Auto-dismiss after a while.
    window.setTimeout(() => {
      setLine((cur) => (cur === text ? null : cur));
    }, 7000);
    scheduleIdle();
  };

  const dismiss = () => setLine(null);

  // Schedule the next random idle remark.
  const scheduleIdle = () => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
    idleTimer.current = window.setTimeout(() => {
      // Late at night, prefer the lateNight line.
      const hour = new Date().getHours();
      say(hour >= 0 && hour < 5 ? "lateNight" : "idle");
    }, delay);
  };

  // Greet once on mount; start the idle loop.
  useEffect(() => {
    const t = window.setTimeout(() => say("greet", true), 1200);
    scheduleIdle();
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to mood changes (up/down).
  useEffect(() => {
    if (prevMood.current && prevMood.current !== mood) {
      const order: Mood[] = [
        "Critical",
        "Unwell",
        "Uneasy",
        "Content",
        "Thriving",
      ];
      const improved = order.indexOf(mood) > order.indexOf(prevMood.current);
      say(improved ? "moodUp" : "moodDown");
    }
    prevMood.current = mood;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  return { line, say, dismiss };
}