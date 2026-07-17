"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { SectionId } from "./lines";

/**
 * Reports which section is currently in view, via [data-section] markers.
 * Always starts at "hero" — a constant, so server and client agree on the
 * first render with nothing for hydration to patch — and the effect
 * (client-only) corrects it once mounted, on any page that marks its
 * sections, not just the home route.
 */
export function useSectionWatcher(): SectionId {
  const pathname = usePathname();
  const [active, setActive] = useState<SectionId>("hero");

  // Every section's latest known ratio. IntersectionObserver callbacks only
  // report entries that just crossed a threshold, not a full re-check of
  // everything being watched — comparing only within one callback's batch
  // made the winner flicker as two adjacent sections crossed thresholds at
  // slightly different moments. Deciding from this persistent record instead
  // means we always compare against the full up-to-date picture.
  const ratios = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-section]");
    if (!sections.length) {
      setActive("page");
      return;
    }

    ratios.current = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.section;
          if (!id) continue;
          ratios.current.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        let bestId: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios.current) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestId) setActive(bestId as SectionId);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-20% 0px -20% 0px" },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [pathname]);

  return active;
}