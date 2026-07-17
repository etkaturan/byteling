"use client";

import { useEffect, useState } from "react";
import type { SectionId } from "./lines";

/**
 * Reports which section is currently in view. IntersectionObserver rather than
 * scroll math — it fires only on change, the same instinct as the app's event
 * hook replacing its polling tick.
 */
export function useSectionWatcher(): SectionId {
  const [active, setActive] = useState<SectionId>("hero");

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-section]");
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The most-visible section wins, so a half-scrolled page doesn't flicker.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const id = (visible.target as HTMLElement).dataset.section;
          if (id) setActive(id as SectionId);
        }
      },
      { threshold: [0.25, 0.5, 0.75], rootMargin: "-20% 0px -20% 0px" },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return active;
}