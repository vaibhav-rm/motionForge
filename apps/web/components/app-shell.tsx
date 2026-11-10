"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@motionforge/shared";
import { useEffect, useState } from "react";
import type React from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/templates", label: "Templates" },
  { href: "/assets", label: "Assets" },
  { href: "/settings", label: "Settings" },
];

/**
 * Instant feedback for a navigation that is still resolving. Without this a
 * dynamic route feels like the click was swallowed until the page lands.
 */
function PendingRule() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cx(
        "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden transition-opacity",
        pending ? "opacity-100" : "opacity-0",
      )}
    >
      <span
        className={cx(
          "block h-full bg-[var(--accent)] transition-[width] ease-out",
          pending ? "w-full duration-[1200ms]" : "w-0 duration-0",
        )}
      />
    </span>
  );
}

function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className="mf-focus group flex items-center gap-3"
      aria-label="MotionForge dashboard"
    >
      <span
        className={cx(
          "flex shrink-0 items-center justify-center border border-[var(--ink)] bg-[var(--ink)] font-display text-[15px] leading-none text-[var(--paper)]",
          compact ? "h-9 w-9" : "h-10 w-10",
        )}
        style={{ fontFamily: "var(--font-display)" }}
      >
        M
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="mf-display block text-[19px] tracking-[-0.03em] text-[var(--text)]">
            MotionForge
          </span>
          <span className="mf-label mt-1.5 block text-[8.5px] tracking-[0.22em]">
            Motion studio
          </span>
        </span>
      )}
    </Link>
  );
}

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setProvider(json?.data?.settings?.ai?.provider ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const engineLabel =
    provider === "openai"
      ? "OpenAI-compatible"
      : provider === "anthropic"
        ? "Anthropic"
        : "Local";
  const engineNote =
    provider && provider !== "local"
      ? "Custom model configured in Settings."
      : "Offline creative director. No API key required.";

  const activeIndex = nav.findIndex(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );
  const active = activeIndex >= 0 ? nav[activeIndex] : nav[0];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* Index rail / sidebar */}
      <aside className="hidden shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] md:flex md:w-[78px] lg:w-[252px]">
        <div className="flex h-[72px] items-center border-b border-[var(--border-subtle)] px-4 lg:px-5">
          <span className="lg:hidden">
            <Mark compact />
          </span>
          <span className="hidden lg:block">
            <Mark />
          </span>
        </div>

        <nav className="flex-1 px-2.5 py-4 lg:px-3.5">
          <div className="mf-label mb-2 hidden px-2 lg:block">Index</div>
          <ul className="space-y-0.5">
            {nav.map((item, index) => {
              const isActive = item.href === active.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={cx(
                      "mf-focus group relative flex items-center gap-2.5 overflow-hidden rounded-[2px] px-2 py-2.5 transition-colors active:bg-[var(--bg-hover)]",
                      isActive
                        ? "bg-[var(--ink)] text-[var(--paper)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                    )}
                  >
                    <span
                      className={cx(
                        "mf-mono w-5 text-[9.5px] tracking-[0.02em]",
                        isActive
                          ? "text-[var(--accent)]"
                          : "text-[var(--text-dim)] group-hover:text-[var(--text)]",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="hidden text-[13.5px] lg:block">
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="ml-auto hidden h-[5px] w-[5px] bg-[var(--accent)] lg:block" />
                    )}
                    <PendingRule />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden border-t border-[var(--border)] px-4 py-4 lg:block">
          <div className="mf-label mb-2">Engine</div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[5px] w-[5px] rounded-full bg-[var(--success)]" />
              {engineLabel}
            </span>
            <span className="mf-mono text-[10px] text-[var(--text-dim)]">
              H.264
            </span>
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--text-dim)]">
            {engineNote}
          </p>
          <div className="mt-3 flex items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
            <span className="flex h-7 w-7 items-center justify-center border border-[var(--border)] font-display text-[12px] text-[var(--text)]">
              S
            </span>
            <div className="leading-tight">
              <div className="text-[11.5px] text-[var(--text)]">Studio</div>
              <div className="mf-label mt-1 text-[8px]">Creator</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg)] px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-4">
            <div className="md:hidden">
              <Mark compact />
            </div>
            <div className="min-w-0">
              <div className="mb-1 hidden items-center gap-2 sm:flex">
                <span className="mf-label text-[8.5px]">
                  MotionForge / {active.label}
                </span>
                <span className="h-px w-6 bg-[var(--border)]" />
                <span className="mf-label text-[8.5px]">Workspace</span>
              </div>
              {title && (
                <h1 className="mf-display truncate text-[21px] leading-none tracking-[-0.02em] text-[var(--text)]">
                  {title}
                </h1>
              )}
              {!title && (
                <div className="mf-label">{active.label}</div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {subtitle && (
              <span className="mf-mono mr-1 hidden max-w-[240px] truncate text-[10.5px] uppercase tracking-[0.06em] text-[var(--text-dim)] xl:block">
                {subtitle}
              </span>
            )}
            {actions}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto pb-[60px] md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile index */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-[var(--border)] bg-[var(--bg-elevated)] md:hidden">
        {nav.map((item) => {
          const isActive = item.href === active.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cx(
                "mf-focus relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[9px] uppercase tracking-[0.08em] active:bg-[var(--bg-hover)]",
                isActive
                  ? "text-[var(--text)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]",
              )}
            >
              <span
                className={cx(
                  "h-[2px] w-5",
                  isActive ? "bg-[var(--accent)]" : "bg-transparent",
                )}
              />
              <span className="truncate px-1 font-mono">{item.label}</span>
              <PendingRule />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
