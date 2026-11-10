"use client";

import React from "react";
import { cx } from "@motionforge/shared";
import { Loader2 } from "lucide-react";

export function Button({
  children,
  variant = "default",
  size = "md",
  loading,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "icon";
  loading?: boolean;
}) {
  const variants = {
    default:
      "bg-[var(--bg-panel)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
    primary:
      "mf-accent-gradient border border-[var(--ink)] font-medium hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_var(--ink)] active:translate-x-0 active:translate-y-0 active:shadow-none",
    outline:
      "bg-transparent text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
    ghost:
      "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
    danger:
      "bg-transparent text-[var(--danger)] border border-[var(--danger)]/40 hover:bg-[var(--danger)]/10",
  };
  const sizes = {
    sm: "h-7 px-2.5 text-[10px] gap-1.5",
    md: "h-9 px-3.5 text-[11px] gap-2",
    icon: "h-8 w-8 justify-center",
  };
  return (
    <button
      className={cx(
        "mf-focus inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[2px] font-mono uppercase tracking-[0.1em] transition-all duration-150 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={13} className="mf-spin" />}
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "mf-focus-ring h-9 w-full rounded-[2px] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] transition-colors placeholder:text-[var(--text-dim)] hover:border-[var(--border-strong)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "mf-focus-ring w-full rounded-[2px] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--text)] transition-colors placeholder:text-[var(--text-dim)] hover:border-[var(--border-strong)]",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "mf-select mf-focus-ring h-9 w-full rounded-[2px] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] transition-colors hover:border-[var(--border-strong)]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mf-mono inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-[2px] border border-[var(--border)] bg-[var(--bg-elevated)] px-1 text-[10px] font-medium text-[var(--text-muted)]">
      {children}
    </kbd>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mf-rise flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[2px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--accent)]">
          {icon}
        </div>
      )}
      <div className="mf-display text-[22px] leading-tight text-[var(--text)]">
        {title}
      </div>
      {description && (
        <div className="mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--text-muted)]">
          {description}
        </div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "warn" | "danger" | "success";
  className?: string;
}) {
  const tones = {
    default:
      "border-[var(--border)] text-[var(--text-muted)] bg-transparent",
    accent:
      "bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/35",
    warn: "bg-[var(--warn)]/10 text-[var(--warn)] border-[var(--warn)]/35",
    danger: "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/30",
    success:
      "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/35",
  };
  return (
    <span
      className={cx(
        "mf-mono inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.1em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
