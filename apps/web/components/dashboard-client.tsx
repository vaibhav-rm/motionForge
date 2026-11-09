"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Film,
  MoreHorizontal,
  Trash2,
  Copy,
  Pencil,
  Clock,
  Loader2,
} from "lucide-react";
import { Button, EmptyState, Input } from "./ui";
import { formatDuration } from "@motionforge/shared";

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

export function DashboardClient() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
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

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const data = await api<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      setName("");
      router.push(`/editor/${data.project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await api(`/api/projects/${id}`, { method: "DELETE" });
    void load();
  }

  async function duplicate(id: string) {
    setMenu(null);
    await api(`/api/projects/${id}/duplicate`, { method: "POST" });
    void load();
  }

  async function commitRename(id: string) {
    const v = renameValue.trim();
    if (v) {
      await api(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: v }),
      });
    }
    setRenaming(null);
    void load();
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[15px] font-semibold tracking-[-0.01em]">
            Create a new project
          </div>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Describe any video idea — cinematic, educational, abstract — and
            MotionForge will generate an editable Remotion composition.
          </p>
        </div>
        <div className="flex w-full max-w-md items-center gap-2">
          <Input
            placeholder="Project name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void create()}
          />
          <Button variant="primary" loading={creating} onClick={create} className="shrink-0">
            <Plus size={15} /> New project
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      {projects === null ? (
        <div className="flex items-center gap-2 py-16 text-[13px] text-[var(--text-muted)]">
          <Loader2 size={15} className="mf-spin" /> Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<Film size={20} />}
          title="No projects yet"
          description="Create your first project, then describe a video to generate scenes, motion graphics, and a full composition."
          action={
            <Button variant="primary" loading={creating} onClick={create}>
              <Plus size={15} /> Create a project
            </Button>
          }
        />
      ) : (
        <div>
          <div className="mb-3 text-[12px] font-medium uppercase tracking-wide text-[var(--text-dim)]">
            Recent projects
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] transition-colors hover:border-[#33333d]"
              >
                <Link href={`/editor/${p.id}`} className="block">
                  <div className="flex aspect-video items-center justify-center border-b border-[var(--border-subtle)] bg-[linear-gradient(135deg,#0d1017,#141922)]">
                    <Film size={22} className="text-[var(--text-dim)]" />
                  </div>
                </Link>
                <div className="p-3.5">
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
                        className="h-7 text-[13px]"
                      />
                      <Button size="sm" onClick={() => void commitRename(p.id)}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Link
                      href={`/editor/${p.id}`}
                      className="block truncate text-[13px] font-medium text-[var(--text)] hover:text-white"
                    >
                      {p.name}
                    </Link>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--text-dim)]">
                    <span>{p.width}×{p.height}</span>
                    <span>{p.sceneCount} scenes</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      {formatDuration(p.duration / Math.max(1, p.fps))}
                    </span>
                  </div>
                </div>
                <div className="absolute right-2 top-2">
                  <button
                    className="mf-focus flex h-7 w-7 items-center justify-center rounded-md bg-black/35 text-white/70 opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-black/55 hover:text-white"
                    onClick={() => setMenu(menu === p.id ? null : p.id)}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {menu === p.id && (
                    <div className="absolute right-0 top-8 z-10 w-40 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-1 shadow-xl">
                      <button
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                        onClick={() => {
                          setRenaming(p.id);
                          setRenameValue(p.name);
                          setMenu(null);
                        }}
                      >
                        <Pencil size={13} /> Rename
                      </button>
                      <button
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                        onClick={() => void duplicate(p.id)}
                      >
                        <Copy size={13} /> Duplicate
                      </button>
                      <button
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-red-300 hover:bg-red-500/10"
                        onClick={() => {
                          setMenu(null);
                          void remove(p.id);
                        }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
