import { AppShell } from "./app-shell";

/**
 * Route-level placeholder. Next streams this the moment navigation starts, so
 * a slow server render no longer looks like an ignored click.
 */
export function PageSkeleton({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <AppShell title={title} subtitle={subtitle}>
      <div className="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-7 sm:py-9">
        <div className="border-b border-[var(--border)] pb-5">
          <div className="mf-shimmer h-2 w-24" />
          <div className="mf-shimmer mt-3 h-8 w-64 max-w-full" />
          <div className="mf-shimmer mt-3 h-2.5 w-80 max-w-full" />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
            >
              <div className="mf-shimmer aspect-video w-full" />
              <div className="mf-shimmer mt-3 h-2.5 w-2/3" />
              <div className="mf-shimmer mt-2 h-2 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
