export default function Footer() {
  return (
    <footer
      className="mx-auto max-w-6xl border-t px-6 py-10 text-[13px] sm:px-10"
      style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}
    >
      MIT licensed ·{" "}
      <a href="https://github.com/etkaturan/byteling" className="underline">
        github.com/etkaturan/byteling
      </a>
    </footer>
  );
}