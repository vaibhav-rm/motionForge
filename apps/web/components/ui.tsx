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
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
  loading?: boolean;
}) {
  const variants = {
    default:
      "bg-[var(--bg-hover)] text-[var(--text)] border border-[var(--border)] hover:border-[#33333d]",
    primary:
      "bg-[var(--accent)] text-[#062016] hover:bg-[var(--accent-strong)] font-medium",
    ghost:
      "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
    danger: "bg-[#3a1518] text-[#fca5a5] border border-[#5a2024] hover:bg-[#4a1a1e]",
  };
  const sizes = {
    sm: "h-7 px-2.5 text-[12px] rounded-md gap-1.5",
    md: "h-9 px-3.5 text-[13px] rounded-lg gap-2",
    icon: "h-8 w-8 rounded-md justify-center",
  };
  return (
    <button
      className={cx(
        "mf-focus inline-flex items-center justify-center transition-colors disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={14} className="mf-spin" />}
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
        "mf-focus h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-dim)]",
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
        "mf-focus w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--text)] placeholder:text-[var(--text-dim)]",
        className,
      )}
      {...props}
    />
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
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-dim)]">
          {icon}
        </div>
      )}
      <div className="text-[14px] font-medium text-[var(--text)]">{title}</div>
      {description && (
        <div className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--text-muted)]">
          {description}
        </div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "warn" | "danger";
}) {
  const tones = {
    default: "bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border)]",
    accent: "bg-[var(--accent-dim)] text-[var(--accent)] border-transparent",
    warn: "bg-amber-500/10 text-amber-300 border-transparent",
    danger: "bg-red-500/10 text-red-300 border-transparent",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
