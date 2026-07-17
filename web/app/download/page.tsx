import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { LATEST_RELEASE, primaryAsset } from "@/lib/releases";

const STEPS = [
  { n: "01", t: "Download the installer", d: "One file, about four megabytes. No account needed." },
  { n: "02", t: "Run it", d: "Windows SmartScreen may warn once, since the app isn't code-signed yet. Click More info, then Run anyway." },
  { n: "03", t: "Meet what hatched", d: "Byteling reads your hardware and hatches a creature that's yours alone. Find it in the system tray from then on." },
];

export default function DownloadPage() {
  const release = LATEST_RELEASE;
  const primary = primaryAsset(release);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-6 sm:px-10">
      <section data-section="hero" className="flex min-h-[90vh] flex-col justify-center border-b py-20" style={{ borderColor: "var(--line)" }}>
          <p className="mb-6 text-[12px] font-medium uppercase tracking-[0.22em]" style={{ color: "var(--ember)" }}>
            v{release.version} · {release.headline}
          </p>
          <h1 className="max-w-[14ch] text-[clamp(2.5rem,5.5vw,4rem)] font-medium leading-[1.05] tracking-[-0.03em]">
            Get your Byteling.
          </h1>
          <p className="mt-6 max-w-[46ch] text-[17px] leading-[1.75]" style={{ color: "var(--ink-2)" }}>
            Free, open source, and local-first. No telemetry, no account, no admin rights.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a href={primary.url} className="rounded-lg px-6 py-3.5 text-[15px] font-medium" style={{ background: "var(--ember)", color: "#25100a" }}>
              Download for {primary.label}
            </a>
            <span className="text-[14px]" style={{ color: "var(--ink-3)" }}>
              {primary.size} · v{release.version}
            </span>
          </div>
        </section>

        {/* One marker for the whole rest of the page: these sections are all
            short and adjacent, so observing them individually just creates
            competing near-equal ratios. They all mean the same thing to the
            pet anyway — "not the hero". */}
        <div data-section="page">
        <section className="border-b py-20" style={{ borderColor: "var(--line)" }}>
          <h2 className="text-[13px] font-medium uppercase tracking-[0.18em]" style={{ color: "var(--ink-3)" }}>
            Other platforms
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {release.assets.map((a) => (
              <div
                key={a.os}
                className="flex items-center justify-between rounded-2xl border px-6 py-5"
                style={{ background: "var(--bg-1)", borderColor: "var(--line)", opacity: a.available ? 1 : 0.55 }}
              >
                <div>
                  <p className="text-[15px] font-medium">{a.label}</p>
                  <p className="mt-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
                    {a.available ? a.size : "Coming later"}
                  </p>
                </div>
                {a.available && (
                  <a href={a.url} className="rounded-lg border px-4 py-2 text-[13px] font-medium" style={{ borderColor: "var(--line-2)", color: "var(--ink)" }}>
                    Get it
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="border-b py-20" style={{ borderColor: "var(--line)" }}>
          <h2 className="text-[13px] font-medium uppercase tracking-[0.18em]" style={{ color: "var(--ink-3)" }}>
            Installing
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <p className="text-[13px] font-medium" style={{ color: "var(--ember)" }}>{s.n}</p>
                <p className="mt-3 text-[16px] font-medium">{s.t}</p>
                <p className="mt-2 text-[14px] leading-[1.7]" style={{ color: "var(--ink-3)" }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-20">
          <h2 className="text-[13px] font-medium uppercase tracking-[0.18em]" style={{ color: "var(--ink-3)" }}>
            What&apos;s in v{release.version}
          </h2>
          <ul className="mt-8 space-y-4">
            {release.notes.map((n) => (
              <li key={n} className="flex gap-4 text-[15px] leading-[1.7]" style={{ color: "var(--ink-2)" }}>
                <span style={{ color: "var(--ember)" }}>—</span>
                {n}
              </li>
            ))}
          </ul>
          <a href="https://github.com/etkaturan/byteling/releases" className="mt-8 inline-block text-[14px] underline" style={{ color: "var(--ink-3)" }}>
            Full release notes on GitHub
          </a>
        </section>
        </div>
      </main>
      <Footer />
    </>
  );
}