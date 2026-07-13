import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { pickLine, LINES } from "./lines";
import type { Mood } from "./Creature";

type Trigger = keyof typeof LINES;

const IDLE_MIN_MS = 90_000; // 1.5 min
const IDLE_MAX_MS = 3 * 60_000; // 3 min
const MIN_GAP_MS = 45_000; // 45s floor between any lines

type Ctx = {
  creature: string; // e.g. "Grounded Elder"
  hint: string; // e.g. "disk nearly full"
};

export function useChatter(mood: Mood, ctx: Ctx) {
  const [line, setLine] = useState<string | null>(null);
  const lastSpokeAt = useRef(0);
  const idleTimer = useRef<number | null>(null);
  const prevMood = useRef<Mood | null>(null);
  const speakToken = useRef(0);

  const say = (
    trigger: Trigger,
    force = false,
    extra?: { app?: string; recent_apps?: string[]; dizzy?: boolean },
  ) => {
    const now = Date.now();
    if (!force && now - lastSpokeAt.current < MIN_GAP_MS) return;
    const canned = pickLine(trigger, mood);
    if (!canned) return;
    lastSpokeAt.current = now;

    const myToken = ++speakToken.current;
    let settled = false;
    invoke<string | null>("speak", {
      ctx: {
        creature: ctx.creature,
        mood,
        event: trigger,
        hour: new Date().getHours(),
        hint: ctx.hint,
        app: extra?.app ?? "",
        recent_apps: extra?.recent_apps ?? [],
        dizzy: extra?.dizzy ?? false,
      },
    })
      .then((llm) => {
        if (speakToken.current !== myToken) return;
        settled = true;
        setLine(llm || canned);
      })
      .catch(() => {
        if (speakToken.current !== myToken) return;
        settled = true;
        setLine(canned);
      });

    window.setTimeout(() => {
      if (!settled && speakToken.current === myToken) setLine(canned);
    }, 1200);
    window.setTimeout(() => {
      setLine((cur) => (speakToken.current === myToken ? null : cur));
    }, 9000);

    scheduleIdle();
  };

  const dismiss = () => setLine(null);

  const scheduleIdle = () => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
    idleTimer.current = window.setTimeout(() => {
      const hour = new Date().getHours();
      say(hour >= 0 && hour < 5 ? "lateNight" : "idle");
    }, delay);
  };

  useEffect(() => {
    const t = window.setTimeout(() => say("greet", true), 1200);
    scheduleIdle();
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevMood.current && prevMood.current !== mood) {
      const order: Mood[] = ["Critical", "Unwell", "Uneasy", "Content", "Thriving"];
      const improved = order.indexOf(mood) > order.indexOf(prevMood.current);
      say(improved ? "moodUp" : "moodDown");
    }
    prevMood.current = mood;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  return { line, say, dismiss };
}