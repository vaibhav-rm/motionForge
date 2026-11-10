import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="mf-bay flex h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] text-[var(--text)]">
      <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] mf-accent-gradient">
        <Loader2 size={16} className="mf-spin" />
      </div>
      <div className="text-center">
        <div className="mf-display text-[18px] leading-none">Loading studio</div>
        <div className="mf-label mt-2 text-[8px]">Cutting room</div>
      </div>
    </div>
  );
}
