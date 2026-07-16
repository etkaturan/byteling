import SiteByteling from "@/components/byteling/SiteByteling";
import SiteCreature from "@/components/byteling/SiteCreature";

const SPECIMENS = [
  { s: { family: "Grounded", life_stage: "Elder", build: "Mighty", hue: 15, limbs: 8, markings: 3, liveliness: 1.1 }, m: "Desktop", d: "8 cores · 6 years old" },
  { s: { family: "Aerial", life_stage: "Hatchling", build: "Slight", hue: 195, limbs: 4, markings: 1, liveliness: 1.3 }, m: "Laptop", d: "4 cores · brand new" },
  { s: { family: "Grounded", life_stage: "Adult", build: "Sturdy", hue: 285, limbs: 6, markings: 2, liveliness: 1 }, m: "Desktop", d: "6 cores · 2 years old" },
  { s: { family: "Aerial", life_stage: "Elder", build: "Sturdy", hue: 120, limbs: 12, markings: 4, liveliness: 0.8 }, m: "Laptop", d: "12 cores · 5 years old" },
] as const;

const READINGS = [
  { n: "Comfort", f: "GPU temperature and load" },
  { n: "Space", f: "free room on your system drive" },
  { n: "Tidiness", f: "temp files and the recycle bin" },
  { n: "Rest", f: "how long since you rebooted" },
  { n: "Energy", f: "memory pressure" },
];

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
  { href: "#download", label: "Download" },
];

export default function Home() {
  return (
    <>
      <SiteByteling />

      <header
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{ borderColor: "var(--line)", background: "rgba(12,10,10,0.72)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6 sm:px-10">
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12 L6.5 12 L9 6 L13 19 L15.5 12 L22 12" fill="none" stroke="var(--ember)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[19px] font-medium tracking-tight">Byteling</span>
          <nav className="ml-auto hidden items-center gap-8 sm:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-[14px] transition-colors hover:text-[var(--ink)]" style={{ color: "var(--ink-2)" }}>
                {n.label}
              </a>
            ))}
            <a href="https://github.com/etkaturan/byteling" className="rounded-lg border px-4 py-1.5 text-[14px] transition-colors" style={{ borderColor: "var(--line-2)", color: "var(--ink-2)" }}>
              Source
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 sm:px-10">
        <section data-section="hero" className="flex min-h-[82vh] flex-col justify-center">
          <div className="rise max-w-[52ch]">
            <p className="mb-6 text-[12px] font-medium uppercase tracking-[0.22em]" style={{ color: "var(--ember)" }}>
              A desktop pet
            </p>
            <h1 className="text-[clamp(2.75rem,6.5vw,4.75rem)] font-medium leading-[1.02] tracking-[-0.035em]">
              Your computer,
              <br />
              made visible.
            </h1>
            <p className="mt-7 max-w-[46ch] text-[17px] leading-[1.75]" style={{ color: "var(--ink-2)" }}>
              It hatches from your own hardware. It gets hot when your GPU does,
              hungry when your disk fills up, and tired when you never reboot.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href="/download" className="rounded-lg px-6 py-3.5 text-[15px] font-medium" style={{ background: "var(--ember)", color: "#25100a" }}>
                Download for Windows
              </a>
              <span className="text-[14px]" style={{ color: "var(--ink-3)" }}>
                Free · open source · 4 MB
              </span>
            </div>
          </div>
        </section>

        <section id="how" data-section="how" className="border-t py-28" style={{ borderColor: "var(--line)" }}>
          <h2 className="max-w-[18ch] text-[clamp(1.9rem,4vw,2.75rem)] font-medium leading-[1.12] tracking-[-0.025em]">
            No two are the same.
          </h2>
          <p className="mt-5 max-w-[54ch] text-[17px] leading-[1.75]" style={{ color: "var(--ink-2)" }}>
            A fingerprint of your machine decides what hatches. A laptop makes
            something that floats; a desktop, something grounded. Your GPU sets
            its build, your core count its limbs, its age how weathered it looks.
            These four came from four different computers.
          </p>
          <div className="mt-16 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {SPECIMENS.map((x, i) => (
              <div key={i} className="flex flex-col items-center rounded-2xl border px-4 pb-6 pt-10" style={{ background: "var(--bg-1)", borderColor: "var(--line)" }}>
                <SiteCreature species={x.s as never} mood="Content" size={128} />
                <p className="mt-7 text-[14px] font-medium">{x.m}</p>
                <p className="mt-1 text-[12px]" style={{ color: "var(--ink-3)" }}>{x.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="privacy" data-section="privacy" className="border-t py-28" style={{ borderColor: "var(--line)" }}>
          <div className="grid gap-16 lg:grid-cols-[1fr_1fr]">
            <div>
              <h2 className="max-w-[16ch] text-[clamp(1.9rem,4vw,2.75rem)] font-medium leading-[1.12] tracking-[-0.025em]">
                It reads your machine, not you.
              </h2>
              <p className="mt-5 max-w-[50ch] text-[17px] leading-[1.75]" style={{ color: "var(--ink-2)" }}>
                Five needs, all from real readings. Whichever is worst decides the
                mood — so you see trouble on your pet before you see it in Task
                Manager.
              </p>
              <p className="mt-5 max-w-[50ch] text-[17px] leading-[1.75]" style={{ color: "var(--ink-2)" }}>
                It notices which app has focus by executable name only. Never
                window titles, never what&apos;s on screen. No telemetry, no
                account, no admin rights.
              </p>
            </div>
            <div className="rounded-2xl border p-2" style={{ background: "var(--bg-1)", borderColor: "var(--line)" }}>
              {READINGS.map((r, i) => (
                <div key={r.n} className="flex items-baseline gap-6 px-5 py-4 text-[15px]" style={i ? { borderTop: "1px solid var(--line)" } : undefined}>
                  <span className="w-20 shrink-0 font-medium">{r.n}</span>
                  <span style={{ color: "var(--ink-3)" }}>{r.f}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="download" data-section="download" className="border-t py-28" style={{ borderColor: "var(--line)" }}>
          <div className="rounded-2xl border px-8 py-20 text-center sm:px-16" style={{ background: "var(--bg-1)", borderColor: "var(--line)" }}>
            <h2 className="mx-auto max-w-[14ch] text-[clamp(1.9rem,4vw,2.75rem)] font-medium leading-[1.12] tracking-[-0.025em]">
              Go and meet yours.
            </h2>
            <p className="mx-auto mt-5 max-w-[42ch] text-[17px] leading-[1.75]" style={{ color: "var(--ink-2)" }}>
              You won&apos;t know what hatches until you run it.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <a href="/download" className="rounded-lg px-6 py-3.5 text-[15px] font-medium" style={{ background: "var(--ember)", color: "#25100a" }}>
                Download Byteling
              </a>
              <a href="https://github.com/etkaturan/byteling" className="rounded-lg border px-6 py-3.5 text-[15px]" style={{ borderColor: "var(--line-2)", color: "var(--ink-2)" }}>
                Read the source
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl border-t px-6 py-10 text-[13px] sm:px-10" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
        MIT licensed ·{" "}
        <a href="https://github.com/etkaturan/byteling" className="underline">
          github.com/etkaturan/byteling
        </a>
      </footer>
    </>
  );
}