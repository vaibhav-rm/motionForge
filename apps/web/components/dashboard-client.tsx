"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Film,
  MoreHorizontal,
  Trash2,
  Copy,
  Pencil,
} from "lucide-react";
import { Button, EmptyState, Input, Kbd, Textarea } from "./ui";
import { formatDuration, formatRelativeTime } from "@motionforge/shared";

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  thumbnail: string | null;
  fps: number;
  width: number;
  height: number;
  duration: number;
  updatedAt: string;
  sceneCount: number;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Request failed");
  return json.data as T;
}

const PROMPT_IDEAS = [
  "A 30-second cinematic visualization of a computer network with glowing nodes",
  "A calm documentary intro about the deep ocean, deep blue palette",
  "A punchy product launch teaser for a futuristic smartwatch",
];

function slateNumber(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return String((hash % 900) + 100);
}

export function DashboardClient({ showComposer = true }: { showComposer?: boolean }) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function load() {
    try {
      const data = await api<{ projects: ProjectRow[] }>("/api/projects");
      setProjects(data.projects);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
      setProjects([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  async function create() {
    const text = prompt.trim();
    setCreating(true);
    setError(null);
    try {
      const data = await api<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ description: text || undefined }),
      });
      setPrompt("");
      const query = text ? `?prompt=${encodeURIComponent(text)}` : "";
      router.push(`/editor/${data.project.id}${query}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
    }
  }

  async function duplicate(id: string) {
    setMenu(null);
    try {
      await api(`/api/projects/${id}/duplicate`, { method: "POST" });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate project");
    }
  }

  async function commitRename(id: string) {
    const v = renameValue.trim();
    if (v) {
      await api(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: v }),
      }).catch(() => {});
    }
    setRenaming(null);
    void load();
  }

  const stats = useMemo(() => {
    const list = projects ?? [];
    const totalScenes = list.reduce((n, p) => n + p.sceneCount, 0);
    const totalSeconds = list.reduce((n, p) => n + p.duration / Math.max(1, p.fps), 0);
    return { count: list.length, totalScenes, totalSeconds };
  }, [projects]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
      {showComposer && (
        <section className="mf-rise border-y border-[var(--border)]">
          <div className="grid gap-8 py-7 lg:grid-cols-[1fr_240px] lg:gap-12 lg:py-9">
            <div>
              <div className="mf-label">Brief no. 001 — new composition</div>
              <h2 className="mf-display mt-4 text-[38px] leading-[0.98] tracking-[-0.035em] sm:text-[52px] lg:text-[58px]">
                Imagine it.
                <br />
                <em className="font-normal text-[var(--accent)]">Make it move.</em>
              </h2>
              <p className="mt-4 max-w-[46ch] text-[13.5px] leading-relaxed text-[var(--text-muted)]">
                Describe a video in plain language. MotionForge drafts an editable,
                multi-scene composition — then you refine it by conversation.
              </p>
            </div>

            <div className="hidden border-l border-[var(--border)] pl-6 lg:block">
              {[
                ["Engine", "Remotion"],
                ["Output", "H.264 · MP4"],
                ["Scenes", "AI planned"],
                ["Status", "Ready"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between border-b border-[var(--border-subtle)] py-2 last:border-0"
                >
                  <span className="mf-label text-[8.5px]">{k}</span>
                  <span className="mf-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text)]">
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pb-7 sm:pb-9">
            <div className="mf-panel">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3.5 py-2">
                <span className="mf-label text-[8.5px]">The brief</span>
                <span className="hidden items-center gap-1 text-[10px] text-[var(--text-dim)] sm:inline-flex">
                  <Kbd>⌘</Kbd>
                  <Kbd>↵</Kbd>
                  <span className="ml-1 font-mono uppercase tracking-[0.08em]">
                    to generate
                  </span>
                </span>
              </div>
              <Textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void create();
                }}
                placeholder="A 30-second cinematic visualization of a computer network with glowing nodes and a deep blue palette…"
                className="resize-none rounded-none border-0 bg-transparent px-4 py-3.5 text-[14px] leading-relaxed hover:border-0 focus:shadow-none focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="mf-label text-[8.5px]">Try</span>
                  {PROMPT_IDEAS.map((idea) => (
                    <button
                      key={idea}
                      onClick={() => setPrompt(idea)}
                      className="mf-focus max-w-full truncate text-left text-[11px] text-[var(--text-muted)] underline decoration-[var(--border-strong)] decoration-1 underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
                    >
                      {idea.length > 54 ? idea.slice(0, 54) + "…" : idea}
                    </button>
                  ))}
                </div>
                <Button
                  variant="primary"
                  loading={creating}
                  onClick={() => void create()}
                  className="ml-auto"
                >
                  Generate video →
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {projects && projects.length > 0 && (
        <div className="mt-6 grid grid-cols-3 border-y border-[var(--border)]">
          {[
            { label: "Projects", value: String(stats.count) },
            { label: "Scenes", value: String(stats.totalScenes) },
            { label: "Runtime", value: formatDuration(stats.totalSeconds) },
          ].map((s, i) => (
            <div
              key={s.label}
              className={
                i > 0
                  ? "border-l border-[var(--border)] px-4 py-3.5 sm:px-5"
                  : "px-4 py-3.5 sm:px-5"
              }
            >
              <div className="mf-display text-[26px] leading-none tracking-[-0.03em] sm:text-[30px]">
                {s.value}
              </div>
              <div className="mf-label mt-2 text-[8px]">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-5 border-l-2 border-[var(--danger)] bg-[var(--danger)]/5 px-3.5 py-2.5 text-[12.5px] text-[var(--danger)]">
          {error}
        </div>
      )}

      <div className="mt-8">
        <div className="mb-4 flex items-end justify-between border-b border-[var(--border)] pb-2.5">
          <h3 className="mf-display text-[24px] leading-none tracking-[-0.02em]">
            Recent projects
            {projects && projects.length > 0 && (
              <sup className="mf-mono ml-2 align-top text-[10px] text-[var(--text-dim)]">
                {String(projects.length).padStart(2, "0")}
              </sup>
            )}
          </h3>
          {projects && projects.length > 0 && (
            <Link
              href="/projects"
              className="mf-focus font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
            >
              View all →
            </Link>
          )}
        </div>

        {projects === null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-[var(--border)] bg-[var(--bg-panel)]">
                <div className="mf-shimmer aspect-video" />
                <div className="space-y-2 p-3.5">
                  <div className="mf-shimmer h-2.5 w-2/3" />
                  <div className="mf-shimmer h-2 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="mf-panel">
            <EmptyState
              icon={<Film size={19} />}
              title="The page is blank"
              description="Describe a video above and MotionForge will plan the scenes, build the graphics, and hand you a full editable composition."
              action={
                <Button variant="primary" loading={creating} onClick={() => void create()}>
                  <Plus size={13} /> Create first project
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {projects.map((p, index) => {
              const slate = slateNumber(p.id);
              return (
                <article
                  key={p.id}
                  className="mf-card mf-rise group"
                  style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                >
                  <Link href={`/editor/${p.id}`} className="block">
                    <div className="relative aspect-video overflow-hidden border-b border-[var(--border)] bg-[#14120d]">
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <>
                          <span className="mf-display absolute left-3 top-1/2 -translate-y-1/2 text-[64px] leading-none text-[#f0e9d8]/[0.13]">
                            {slate}
                          </span>
                          <span className="absolute left-2.5 top-2.5 h-[2px] w-7 bg-[var(--accent)]" />
                          <span className="mf-mono absolute right-2.5 top-2.5 text-[8.5px] uppercase tracking-[0.14em] text-[#f0e9d8]/45">
                            {p.sceneCount} sc
                          </span>
                        </>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-white/10 bg-[#14120d]/80 px-2.5 py-1.5">
                        <span className="mf-mono text-[8.5px] uppercase tracking-[0.12em] text-[#f0e9d8]/60">
                          {p.width}×{p.height}
                        </span>
                        <span className="mf-mono text-[8.5px] uppercase tracking-[0.12em] text-[#f0e9d8]/60">
                          {formatDuration(p.duration / Math.max(1, p.fps))}
                        </span>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-[#14120d]/55 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="border border-[#f0e9d8]/40 px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#f0e9d8]">
                          Open editor →
                        </span>
                      </div>
                    </div>
                  </Link>

                  <div className="p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="mf-mono mt-[3px] text-[9px] text-[var(--text-dim)]">
                        {String(index + 1).padStart(3, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        {renaming === p.id ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void commitRename(p.id);
                                if (e.key === "Escape") setRenaming(null);
                              }}
                              className="h-7 text-[12px]"
                            />
                            <Button size="sm" onClick={() => void commitRename(p.id)}>
                              Save
                            </Button>
                          </div>
                        ) : (
                          <Link
                            href={`/editor/${p.id}`}
                            className="mf-display mf-focus block truncate text-[16px] leading-snug tracking-[-0.01em] text-[var(--text)] decoration-[var(--accent)] decoration-1 underline-offset-4 hover:underline"
                          >
                            {p.name}
                          </Link>
                        )}
                        <div className="mf-mono mt-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.08em] text-[var(--text-dim)]">
                          <span>{p.fps} fps</span>
                          <span>·</span>
                          <span>{formatRelativeTime(p.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute right-2 top-2 z-20">
                    <button
                      aria-label="Project actions"
                      className="mf-focus flex h-7 w-7 items-center justify-center border border-[#f0e9d8]/25 bg-[#14120d]/60 text-[#f0e9d8]/85 transition-colors hover:bg-[#14120d] hover:text-[#f0e9d8]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu(menu === p.id ? null : p.id);
                      }}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {menu === p.id && (
                      <div
                        className="absolute right-0 top-8 w-40 border border-[var(--border-strong)] bg-[var(--bg-elevated)] py-1 shadow-[4px_4px_0_var(--ink)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                          onClick={() => {
                            setRenaming(p.id);
                            setRenameValue(p.name);
                            setMenu(null);
                          }}
                        >
                          <Pencil size={12} /> Rename
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                          onClick={() => void duplicate(p.id)}
                        >
                          <Copy size={12} /> Duplicate
                        </button>
                        <div className="my-1 h-px bg-[var(--border-subtle)]" />
                        <button
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10"
                          onClick={() => {
                            setMenu(null);
                            void remove(p.id);
                          }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
