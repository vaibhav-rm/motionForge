import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--bg)] text-[13px] text-[var(--text-muted)]">
      <div className="text-[15px] font-medium text-[var(--text)]">Page not found</div>
      <Link href="/dashboard" className="text-[var(--accent)] hover:underline">
        Go to dashboard
      </Link>
    </div>
  );
}
