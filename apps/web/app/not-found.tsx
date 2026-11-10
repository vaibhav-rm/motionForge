import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-[var(--bg)] px-6 py-16">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="mf-label">MotionForge — Error notice</div>
        <div className="mt-4 flex items-end gap-5 border-b border-[var(--border)] pb-5">
          <span className="mf-display text-[96px] leading-[0.78] tracking-[-0.06em] text-[var(--text)]">
            404
          </span>
          <span className="mb-1 h-14 w-[3px] bg-[var(--accent)]" />
        </div>
        <h1 className="mf-display mt-5 text-[30px] leading-tight tracking-[-0.02em]">
          This scene doesn&apos;t exist.
        </h1>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-[var(--text-muted)]">
          The page may have been moved or deleted. The rest of the studio is
          still where you left it.
        </p>
        <Link
          href="/dashboard"
          className="mf-focus mt-7 inline-flex h-9 items-center border border-[var(--ink)] bg-[var(--ink)] px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--paper)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
