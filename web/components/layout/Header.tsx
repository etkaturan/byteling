import Link from "next/link";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/download", label: "Download" },
];

export default function Header() {
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl"
      style={{ borderColor: "var(--line)", background: "rgba(12,10,10,0.72)" }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M2 12 L6.5 12 L9 6 L13 19 L15.5 12 L22 12"
              fill="none"
              stroke="var(--ember)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[19px] font-medium tracking-tight">Byteling</span>
        </Link>
        <nav className="ml-auto hidden items-center gap-8 sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-[14px] transition-colors hover:text-[var(--ink)]"
              style={{ color: "var(--ink-2)" }}
            >
              {n.label}
            </Link>
          ))}
          <a
            href="https://github.com/etkaturan/byteling"
            className="rounded-lg border px-4 py-1.5 text-[14px] transition-colors"
            style={{ borderColor: "var(--line-2)", color: "var(--ink-2)" }}
          >
            Source
          </a>
        </nav>
      </div>
    </header>
  );
}