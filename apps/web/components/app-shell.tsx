"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  FolderOpen,
  Image as ImageIcon,
  Settings,
  Sparkles,
} from "lucide-react";
import { cx } from "@motionforge/shared";
import type React from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/projects", label: "My Projects", icon: FolderOpen },
  { href: "/assets", label: "Assets", icon: ImageIcon },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  title,
  actions,
}: {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg)]">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border-subtle)] px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-dim)] text-[var(--accent)]">
            <Sparkles size={15} strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)]">
              MotionForge
            </div>
            <div className="text-[10px] text-[var(--text-dim)]">Video Studio</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "mf-focus flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-[var(--bg-hover)] text-[var(--text)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                )}
              >
                <Icon size={15} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border-subtle)] p-3 text-[11px] text-[var(--text-dim)]">
          Describe it. Visualize it.
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {(title || actions) && (
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
            <h1 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h1>
            <div className="flex items-center gap-2">{actions}</div>
          </header>
        )}
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
