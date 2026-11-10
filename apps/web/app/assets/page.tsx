import { AppShell } from "@/components/app-shell";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TYPES = [
  { label: "Images", detail: "PNG, JPG, WebP, GIF" },
  { label: "Audio", detail: "MP3, WAV, AAC" },
  { label: "Video", detail: "MP4, WebM" },
  { label: "Vectors", detail: "SVG" },
];

export default function AssetsPage() {
  return (
    <AppShell title="Assets" subtitle="Per-project media · validated on upload">
      <div className="mx-auto w-full max-w-[1000px] px-4 py-7 sm:px-7 sm:py-9">
        <section className="mf-rise border-b border-[var(--border)] pb-7">
          <div className="mf-label">Library — stored per project</div>
          <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="mf-display text-[32px] leading-[1.02] tracking-[-0.03em] sm:text-[40px]">
                Assets live inside
                <br />
                <em className="font-normal text-[var(--accent)]">each project.</em>
              </h2>
              <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-[var(--text-muted)]">
                Upload images, audio, video and SVGs from the editor. Files are
                served to the live preview and the server-side renderer, and
                stored locally or in S3-compatible storage.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="mf-focus inline-flex h-9 shrink-0 items-center border border-[var(--ink)] bg-[var(--ink)] px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--paper)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
            >
              Open a project →
            </Link>
          </div>
        </section>

        <section className="mt-7">
          <div className="mf-label mb-2">Accepted formats</div>
          <div className="grid grid-cols-2 border-l border-t border-[var(--border)] sm:grid-cols-4">
            {TYPES.map((t) => (
              <div
                key={t.label}
                className="border-b border-r border-[var(--border)] bg-[var(--bg-elevated)] p-4"
              >
                <div className="mf-display text-[19px] leading-none text-[var(--text)]">
                  {t.label}
                </div>
                <div className="mf-mono mt-2 text-[9.5px] uppercase tracking-[0.06em] text-[var(--text-dim)]">
                  {t.detail}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="mf-panel p-5">
            <div className="mf-label">01 / Validation</div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Uploads are checked for type and size, and stored paths are
              sanitised to prevent traversal. Rendering never executes uploaded
              content.
            </p>
          </div>
          <div className="mf-panel p-5">
            <div className="mf-label">02 / Storage</div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Set{" "}
              <code className="mf-mono border border-[var(--border-subtle)] bg-[var(--bg-sunken)] px-1 py-0.5 text-[10.5px] text-[var(--accent)]">
                STORAGE_DRIVER=local
              </code>{" "}
              for the filesystem, or configure{" "}
              <code className="mf-mono border border-[var(--border-subtle)] bg-[var(--bg-sunken)] px-1 py-0.5 text-[10.5px] text-[var(--accent)]">
                S3_*
              </code>{" "}
              for object storage.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
