import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <div className="max-w-2xl p-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-[14px] font-semibold">AI Provider</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
            MotionForge uses a provider-independent AI layer. By default it runs
            the built-in offline creative director (<code className="rounded bg-[var(--bg)] px-1 py-0.5 text-[12px]">AI_PROVIDER=local</code>),
            which generates real, varied scene plans with no API key.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-muted)]">
            To use an external model, set environment variables and restart the
            app:
          </p>
          <pre className="mt-3 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-[12px] text-[var(--text-muted)]">{`AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# or
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...`}</pre>
          <p className="mt-3 text-[12px] text-[var(--text-dim)]">
            The AI only emits validated JSON specifications. It never generates
            or executes code.
          </p>
        </div>
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-[14px] font-semibold">Rendering</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
            Exports use Remotion’s server-side renderer and FFmpeg (H.264 MP4).
            The render queue is database-backed; for production, run the worker
            process: <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-[12px]">npm run worker --workspace @motionforge/renderer</code>.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
