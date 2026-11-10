"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Idea = {
  title: string;
  blurb: string;
  prompt: string;
  tag: string;
};

const IDEAS: Idea[] = [
  {
    title: "Cinematic network",
    blurb: "Glowing nodes, deep blue palette, sweeping camera motion.",
    prompt:
      "A 30-second cinematic visualization of a computer network with glowing nodes, connecting lines, and a deep blue and cyan palette.",
    tag: "Tech",
  },
  {
    title: "Product teaser",
    blurb: "Punchy, high-contrast launch spot for a new device.",
    prompt:
      "A 15-second punchy product launch teaser for a futuristic smartwatch. Bold typography, dark backdrop, electric accents, quick cuts.",
    tag: "Product",
  },
  {
    title: "Data story",
    blurb: "Animated charts that build up with a clean editorial look.",
    prompt:
      "A 40-second data story about global internet adoption. Animated bar and line charts, editorial typography, calm neutral palette.",
    tag: "Data",
  },
  {
    title: "Kinetic type",
    blurb: "Words in motion — tempo, rhythm, and emphasis.",
    prompt:
      "A 20-second kinetic typography piece about focus and momentum. Minimal monochrome palette, bold display type, rhythmic reveals.",
    tag: "Type",
  },
  {
    title: "Documentary intro",
    blurb: "Slow, atmospheric opener for a nature film.",
    prompt:
      "A 35-second documentary intro about the deep ocean. Slow camera drift, dark teal and indigo palette, subtle particles, understated titles.",
    tag: "Story",
  },
  {
    title: "Simply cinematic",
    blurb: "A confident, minimal opener with strong pacing.",
    prompt:
      "A 25-second cinematic opener about creativity. Minimal composition, dramatic pacing, monochrome palette, elegant serif-style titles.",
    tag: "Cinema",
  },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Request failed");
  return json.data as T;
}

export function TemplatesClient() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function usePrompt(idea: Idea) {
    setBusy(idea.title);
    setError(null);
    try {
      const data = await api<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ description: idea.prompt }),
      });
      router.push(`/editor/${data.project.id}?prompt=${encodeURIComponent(idea.prompt)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-7 sm:py-9">
      <div className="mf-rise border-b border-[var(--border)] pb-5">
        <div className="mf-label">Catalogue — six starting briefs</div>
        <h2 className="mf-display mt-3 text-[32px] leading-[1] tracking-[-0.03em] sm:text-[42px]">
          Pick a direction.
          <br />
          <em className="font-normal text-[var(--accent)]">Make it yours.</em>
        </h2>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-[var(--text-muted)]">
          Each entry seeds the creative director with a prompt. Everything it
          produces stays editable — swap scenes, restyle, and export.
        </p>
      </div>

      {error && (
        <div className="mt-4 border-l-2 border-[var(--danger)] bg-[var(--danger)]/5 px-3.5 py-2.5 text-[12.5px] text-[var(--danger)]">
          {error}
        </div>
      )}

      <div className="divide-y divide-[var(--border)] border-b border-[var(--border)]">
        {IDEAS.map((idea, i) => {
          const loading = busy === idea.title;
          return (
            <button
              key={idea.title}
              onClick={() => void usePrompt(idea)}
              disabled={!!busy}
              style={{ animationDelay: `${i * 30}ms` }}
              className="mf-rise mf-focus group grid w-full grid-cols-[36px_1fr] items-start gap-x-4 gap-y-2 py-5 text-left transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-60 sm:grid-cols-[48px_1fr_150px] sm:items-center sm:px-2"
            >
              <span className="mf-mono pt-1 text-[10px] tracking-[0.06em] text-[var(--text-dim)] sm:pt-0">
                {String(i + 1).padStart(2, "0")}
              </span>

              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="mf-display text-[22px] leading-tight tracking-[-0.02em] text-[var(--text)] decoration-[var(--accent)] decoration-1 underline-offset-[6px] group-hover:underline">
                    {idea.title}
                  </span>
                  <span className="mf-label text-[8px]">{idea.tag}</span>
                </span>
                <span className="mt-1.5 block max-w-[62ch] text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                  {idea.blurb}
                </span>
                <span className="mf-mono mt-2 line-clamp-2 block max-w-[70ch] text-[10.5px] leading-relaxed text-[var(--text-dim)]">
                  “{idea.prompt}”
                </span>
              </span>

              <span className="mf-mono col-start-2 inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.12em] text-[var(--text-dim)] transition-colors group-hover:text-[var(--accent)] sm:col-start-3 sm:justify-end">
                {loading ? "Creating…" : "Generate →"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-start gap-2.5 text-[11px] leading-relaxed text-[var(--text-dim)]">
        <span className="mt-1.5 h-[5px] w-[5px] shrink-0 bg-[var(--accent)]" />
        Templates are prompts, not fixed layouts. Length, palette and pacing all
        come from the brief — edit any of it by talking to the director.
      </div>
    </div>
  );
}
