"use client";

import { useEffect, useRef, useState } from "react";
import SiteCreature from "./SiteCreature";
import { SITE_SPECIES } from "@/lib/byteling/species";
import { useSectionWatcher } from "@/lib/byteling/useSectionWatcher";
import { lineFor } from "@/lib/byteling/lines";

/**
 * The site's Byteling. Big in the hero, then it travels to the corner and
 * follows you down the page, commenting on what you're reading — the same
 * mechanic the app uses for apps, applied to sections.
 */
export default function SiteByteling() {
  const section = useSectionWatcher();
  const [line, setLine] = useState("Oh — a visitor. Hello.");
  const [inHero, setInHero] = useState(true);
  const lastLine = useRef(line);
  const lastSection = useRef(section);

  useEffect(() => {
    setInHero(section === "hero");
    if (section === lastSection.current) return;
    lastSection.current = section;
    // Let the travel start before it speaks, so the two don't collide.
    const t = window.setTimeout(() => {
      const next = lineFor(section, lastLine.current);
      lastLine.current = next;
      setLine(next);
    }, 450);
    return () => window.clearTimeout(t);
  }, [section]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-40 transition-all duration-[900ms]"
      style={{
        transitionTimingFunction: "cubic-bezier(0.34, 0.8, 0.3, 1)",
        ...(inHero
          ? { left: "62%", top: "30vh", width: 340, height: 340 }
          : { left: "auto", right: 36, top: "auto", bottom: 36, width: 84, height: 84 }),
      }}
    >
      <div
        className="absolute whitespace-nowrap rounded-xl border px-3.5 py-2 text-[13px] transition-all duration-[900ms]"
        style={{
          transitionTimingFunction: "cubic-bezier(0.34, 0.8, 0.3, 1)",
          background: "var(--bg-raised)",
          borderColor: "var(--line)",
          color: "var(--ink)",
          ...(inHero
            ? { left: 30, top: -30 }
            : { right: 96, top: 20, left: "auto" }),
        }}
      >
        {line}
      </div>
      <SiteCreature
        species={SITE_SPECIES}
        mood="Content"
        size={inHero ? 340 : 84}
      />
    </div>
  );
}