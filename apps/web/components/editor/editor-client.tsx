"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Player, type PlayerRef } from "@remotion/player";
import { MotionForgeComposition } from "@motionforge/video-components";
import type { Project, Scene, Element } from "@motionforge/video-schema";
import {
  ArrowLeft,
  Download,
  Loader2,
  Pause,
  Play,
  Redo2,
  Save,
  Send,
  Sparkles,
  Undo2,
  Upload,
  Film,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useEditorStore, type ChatMsg } from "@/lib/editor-store";
import { Button, Input, Textarea, Badge } from "@/components/ui";
import { cx, formatDuration, formatTimecode } from "@motionforge/shared";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok)
    throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  return json.data as T;
}

function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function sceneStartFrames(project: Project): number[] {
  const starts: number[] = [];
  let cur = 0;
  for (let i = 0; i < project.scenes.length; i++) {
    starts.push(cur);
    const sc = project.scenes[i];
    const next = project.scenes[i + 1];
    const overlap =
      next && sc.transition?.type !== "none"
        ? Math.min(sc.transition.durationInFrames ?? 0, sc.durationInFrames)
        : 0;
    cur += sc.durationInFrames - overlap;
  }
  return starts;
}

export function EditorClient({ projectId }: { projectId: string }) {
  const store = useEditorStore();
  const playerRef = useRef<PlayerRef>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [renderJob, setRenderJob] = useState<{
    id: string;
    status: string;
    progress: number;
    outputPath?: string | null;
    error?: string | null;
  } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // Load project
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ project: Project }>(`/api/projects/${projectId}`);
        if (cancelled) return;
        store.setProject(data.project, { markClean: true });
        // Load messages
        try {
          const m = await api<{ messages: any[] }>(
            `/api/projects/${projectId}/messages`,
          );
          if (!cancelled)
            store.setMessages(
              (m.messages ?? []).map((x) => ({
                id: x.id,
                role: x.role,
                content: x.content,
                changes: x.metadata?.changes,
              })),
            );
        } catch {}
      } catch (e) {
        if (!cancelled)
          store.setError(e instanceof Error ? e.message : "Failed to load project");
        store.setProject(store.project as any); // stop loading state hack
      } finally {
        if (!cancelled && useEditorStore.getState().loading) {
          useEditorStore.setState({ loading: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Autosave
  useEffect(() => {
    const { project, dirty } = store;
    if (!project || !dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const p = useEditorStore.getState().project;
      if (!p) return;
      useEditorStore.getState().setSaving(true);
      try {
        const data = await api<{ project: Project }>(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: p }),
        });
        useEditorStore.getState().setProject(data.project, { markClean: true });
        useEditorStore.getState().markSaved();
      } catch (e) {
        useEditorStore.getState().setSaving(false);
        useEditorStore
          .getState()
          .setError(e instanceof Error ? e.message : "Save failed");
      }
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [store.project, store.dirty, projectId]);

  // Player frame sync
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      store.setCurrentFrame(e.detail.frame);
    };
    player.addEventListener("frameupdate", onFrame as any);
    return () => player.removeEventListener("frameupdate", onFrame as any);
  }, [store.project]);

  const project = store.project;

  const durationInFrames = useMemo(() => {
    if (!project) return 1;
    return Math.max(
      1,
      project.scenes.reduce((s, sc) => s + sc.durationInFrames, 0),
    );
  }, [project]);

  const seekToScene = useCallback(
    (sceneId: string) => {
      const p = useEditorStore.getState().project;
      if (!p) return;
      const starts = sceneStartFrames(p);
      const idx = p.scenes.findIndex((s) => s.id === sceneId);
      if (idx >= 0) {
        playerRef.current?.seekTo(starts[idx] ?? 0);
        store.selectScene(sceneId);
      }
    },
    [store],
  );

  // Render polling
  useEffect(() => {
    if (!renderJob || !["queued", "rendering"].includes(renderJob.status)) return;
    const t = setInterval(async () => {
      try {
        const data = await api<{ job: any }>(`/api/renders/${renderJob.id}`);
        setRenderJob(data.job);
      } catch {}
    }, 1500);
    return () => clearInterval(t);
  }, [renderJob?.id, renderJob?.status]);

  async function startRender(quality: "draft" | "standard" | "high") {
    if (!project) return;
    // Save first
    await api(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    }).catch(() => {});
    const data = await api<{ job: any }>(`/api/projects/${projectId}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality }),
    });
    setRenderJob(data.job);
    setExportOpen(false);
  }

  if (store.loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)] text-[13px] text-[var(--text-muted)]">
        <Loader2 size={16} className="mf-spin mr-2" /> Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[var(--bg)] text-[13px]">
        <AlertCircle size={20} className="text-red-400" />
        <div className="text-[var(--text-muted)]">
          {store.error ?? "Project not found."}
        </div>
        <Link href="/dashboard" className="text-[var(--accent)] hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const selectedScene =
    project.scenes.find((s) => s.id === store.selectedSceneId) ?? project.scenes[0];
  const selectedElement = selectedScene?.elements.find(
    (e) => e.id === store.selectedElementId,
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="mf-focus flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
            title="Dashboard"
          >
            <ArrowLeft size={15} />
          </Link>
          <div className="h-4 w-px bg-[var(--border)]" />
          <input
            className="h-7 w-56 rounded-md bg-transparent px-2 text-[13px] font-medium text-[var(--text)] outline-none hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)]"
            value={project.name}
            onChange={(e) =>
              store.patchProject((p) => ({ ...p, name: e.target.value }), "Rename")
            }
          />
          <span className="text-[11px] text-[var(--text-dim)]">
            {project.width}×{project.height} · {project.fps}fps ·{" "}
            {formatDuration(durationInFrames / project.fps)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[11px] text-[var(--text-dim)]">
            {store.saving ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={11} className="mf-spin" /> Saving
              </span>
            ) : store.dirty ? (
              "Unsaved"
            ) : store.lastSavedAt ? (
              "Saved"
            ) : (
              ""
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={store.undo}
            disabled={!store.undoStack.length}
            title="Undo"
          >
            <Undo2 size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={store.redo}
            disabled={!store.redoStack.length}
            title="Redo"
          >
            <Redo2 size={15} />
          </Button>
          <div className="relative">
            <Button variant="primary" size="sm" onClick={() => setExportOpen((v) => !v)}>
              <Download size={14} /> Export
            </Button>
            {exportOpen && (
              <div className="absolute right-0 top-9 z-20 w-52 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-xl">
                <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">
                  Render quality
                </div>
                {(["draft", "standard", "high"] as const).map((q) => (
                  <button
                    key={q}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                    onClick={() => void startRender(q)}
                  >
                    <span className="capitalize">{q}</span>
                    <span className="text-[11px] text-[var(--text-dim)]">
                      {q === "draft" ? "Fast" : q === "high" ? "Best" : "Balanced"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {store.error && (
        <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[12px] text-red-300">
          <AlertCircle size={13} /> {store.error}
          <button className="ml-auto underline" onClick={() => store.setError(null)}>
            dismiss
          </button>
        </div>
      )}

      {renderJob && (
        <RenderBanner job={renderJob} onClose={() => setRenderJob(null)} />
      )}

      {/* Main workspace */}
      <div className="flex min-h-0 flex-1">
        {/* Left: AI assistant */}
        <AssistantPanel projectId={projectId} />

        {/* Center: preview */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-[var(--border)]">
          <div className="flex min-h-0 flex-1 items-center justify-center bg-[#050507] p-4">
            <div
              className="relative w-full overflow-hidden rounded-lg border border-[var(--border)] bg-black shadow-2xl"
              style={{ maxWidth: 960, aspectRatio: `${project.width}/${project.height}` }}
            >
              <Player
                ref={playerRef}
                component={MotionForgeComposition as any}
                inputProps={{ project }}
                durationInFrames={durationInFrames}
                compositionWidth={project.width}
                compositionHeight={project.height}
                fps={project.fps}
                style={{ width: "100%", height: "100%" }}
                controls={false}
                clickToPlay
                spaceKeyToPlayOrPause
                acknowledgeRemotionLicense
              />
            </div>
          </div>
          <PlaybackBar
            project={project}
            frame={store.currentFrame}
            playing={store.playing}
            playerRef={playerRef}
            onToggle={() => {
              const p = playerRef.current;
              if (!p) return;
              if (p.isPlaying()) {
                p.pause();
                store.setPlaying(false);
              } else {
                p.play();
                store.setPlaying(true);
              }
            }}
            onSeek={(f) => playerRef.current?.seekTo(f)}
          />
        </div>

        {/* Right: inspector */}
        <InspectorPanel scene={selectedScene ?? null} element={selectedElement ?? null} />
      </div>

      {/* Bottom: timeline */}
      <TimelinePanel
        project={project}
        selectedSceneId={store.selectedSceneId}
        currentFrame={store.currentFrame}
        onSelectScene={(id) => seekToScene(id)}
        onSeek={(f) => playerRef.current?.seekTo(f)}
      />
    </div>
  );
}

function RenderBanner({
  job,
  onClose,
}: {
  job: { id: string; status: string; progress: number; outputPath?: string | null; error?: string | null };
  onClose: () => void;
}) {
  const done = job.status === "completed";
  const failed = job.status === "failed";
  return (
    <div
      className={cx(
        "flex items-center gap-3 border-b px-3 py-1.5 text-[12px]",
        done
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          : failed
            ? "border-red-500/20 bg-red-500/10 text-red-300"
            : "border-[var(--accent)]/20 bg-[var(--accent-dim)] text-[var(--text)]",
      )}
    >
      {done ? (
        <CheckCircle2 size={14} />
      ) : failed ? (
        <AlertCircle size={14} />
      ) : (
        <Loader2 size={14} className="mf-spin" />
      )}
      <span>
        {done
          ? "Render complete."
          : failed
            ? `Render failed: ${job.error ?? "unknown error"}`
            : `Rendering… ${Math.round((job.progress ?? 0) * 100)}%`}
      </span>
      {done && (
        <a
          href={`/api/renders/${job.id}?download=1`}
          className="ml-1 rounded bg-emerald-400/20 px-2 py-0.5 font-medium hover:bg-emerald-400/30"
        >
          Download MP4
        </a>
      )}
      <button className="ml-auto text-[11px] opacity-70 hover:opacity-100" onClick={onClose}>
        close
      </button>
    </div>
  );
}

function PlaybackBar({
  project,
  frame,
  playerRef,
  onToggle,
  onSeek,
}: {
  project: Project;
  frame: number;
  playing: boolean;
  playerRef: React.RefObject<PlayerRef | null>;
  onToggle: () => void;
  onSeek: (f: number) => void;
}) {
  const total = Math.max(1, project.scenes.reduce((s, sc) => s + sc.durationInFrames, 0));
  const isPlaying = playerRef.current?.isPlaying() ?? false;
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-3">
      <button
        className="mf-focus flex h-7 w-7 items-center justify-center rounded-md text-[var(--text)] hover:bg-[var(--bg-hover)]"
        onClick={onToggle}
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <span className="w-28 tabular-nums text-[11px] text-[var(--text-muted)]">
        {formatTimecode(frame, project.fps)} / {formatTimecode(total, project.fps)}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={Math.min(frame, total - 1)}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
      />
    </div>
  );
}

/* ---------- Assistant ---------- */

function AssistantPanel({ projectId }: { projectId: string }) {
  const store = useEditorStore();
  const [prompt, setPrompt] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [store.messages.length, store.aiBusy]);

  const project = store.project;
  const hasContent =
    project && project.scenes.some((s) => s.elements.length > 1 || s.notes);

  async function send() {
    const text = prompt.trim();
    if (!text || store.aiBusy || !project) return;
    setPrompt("");
    const userMsg: ChatMsg = { id: rid("msg"), role: "user", content: text };
    const pendingId = rid("msg");
    store.addMessage(userMsg);
    store.addMessage({
      id: pendingId,
      role: "assistant",
      content: "Thinking…",
      pending: true,
    });
    store.setAiBusy(true);
    try {
      // Heuristic: if project still looks like the blank starter, generate; else edit.
      const isBlank =
        project.scenes.length <= 1 &&
        project.scenes[0]?.elements.every(
          (e) => e.type === "text" && (e as any).text?.includes("Describe"),
        );
      const endpoint = isBlank || /^(generate|create|make)\b/i.test(text)
        ? "/api/ai/generate"
        : "/api/ai/edit";
      const body =
        endpoint === "/api/ai/generate"
          ? { projectId, prompt: text }
          : {
              projectId,
              instruction: text,
              focusedSceneId: store.selectedSceneId,
              selectedElementIds: store.selectedElementId ? [store.selectedElementId] : [],
            };
      const data = await api<{
        project: Project;
        summary: string;
        changes: string[];
      }>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      store.setProject(data.project, { markClean: true });
      store.markSaved();
      store.updateMessage(pendingId, {
        content: data.summary,
        changes: data.changes,
        pending: false,
      });
    } catch (e) {
      store.updateMessage(pendingId, {
        content: `Error: ${e instanceof Error ? e.message : "Request failed"}`,
        pending: false,
      });
    } finally {
      store.setAiBusy(false);
    }
  }

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex h-10 items-center gap-2 border-b border-[var(--border)] px-3">
        <Sparkles size={14} className="text-[var(--accent)]" />
        <span className="text-[12px] font-semibold tracking-wide text-[var(--text)]">
          AI Creative Director
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {store.messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-panel)] p-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
            Describe the video you want to create. Include subject, mood, style,
            and duration — e.g.{" "}
            <span className="text-[var(--text)]">
              “A 45-second cinematic visualization of a computer network with
              glowing nodes and a dark blue/cyan style.”
            </span>
            <div className="mt-2 text-[11px] text-[var(--text-dim)]">
              You can also edit: “make the opening more dramatic”, “add
              particles”, “change to monochrome”, “slow the transition”.
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {store.messages.map((m) => (
            <div
              key={m.id}
              className={cx(
                "rounded-lg px-3 py-2 text-[12px] leading-relaxed",
                m.role === "user"
                  ? "ml-6 bg-[var(--bg-hover)] text-[var(--text)]"
                  : "mr-2 border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-muted)]",
              )}
            >
              {m.pending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={12} className="mf-spin" /> Generating…
                </span>
              ) : (
                m.content
              )}
              {m.changes && m.changes.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-[var(--text-dim)]">
                  {m.changes.slice(0, 8).map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="border-t border-[var(--border)] p-2.5">
        <Textarea
          rows={3}
          placeholder={
            hasContent
              ? "Describe a change… (e.g. make the opening more dramatic)"
              : "Describe your video…"
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
          className="resize-none text-[12px]"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-dim)]">⌘↵ to send</span>
          <Button
            variant="primary"
            size="sm"
            loading={store.aiBusy}
            disabled={!prompt.trim()}
            onClick={() => void send()}
          >
            <Send size={13} /> Send
          </Button>
        </div>
      </div>
    </aside>
  );
}

/* ---------- Inspector ---------- */

function InspectorPanel({
  scene,
  element,
}: {
  scene: Scene | null;
  element: Element | null;
}) {
  const store = useEditorStore();
  const [tab, setTab] = useState<"scene" | "element">("scene");

  useEffect(() => {
    if (element) setTab("element");
  }, [element?.id]);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col bg-[var(--bg-elevated)]">
      <div className="flex h-10 items-center gap-1 border-b border-[var(--border)] px-2">
        <button
          className={cx(
            "rounded-md px-2.5 py-1 text-[12px]",
            tab === "scene"
              ? "bg-[var(--bg-hover)] text-[var(--text)]"
              : "text-[var(--text-muted)] hover:text-[var(--text)]",
          )}
          onClick={() => setTab("scene")}
        >
          Scene
        </button>
        <button
          className={cx(
            "rounded-md px-2.5 py-1 text-[12px]",
            tab === "element"
              ? "bg-[var(--bg-hover)] text-[var(--text)]"
              : "text-[var(--text-muted)] hover:text-[var(--text)]",
          )}
          onClick={() => setTab("element")}
          disabled={!element}
        >
          Element
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tab === "scene" && scene ? (
          <SceneInspector scene={scene} />
        ) : tab === "element" && element && scene ? (
          <ElementInspector sceneId={scene.id} element={element} />
        ) : (
          <div className="text-[12px] text-[var(--text-dim)]">
            Select a scene or element to edit its properties.
          </div>
        )}
      </div>
    </aside>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-medium text-[var(--text-dim)]">{label}</div>
      {children}
    </label>
  );
}

function SceneInspector({ scene }: { scene: Scene }) {
  const store = useEditorStore();
  const p = store.project!;
  return (
    <div className="space-y-3">
      <Field label="Name">
        <Input
          value={scene.name}
          onChange={(e) => store.updateScene(scene.id, { name: e.target.value })}
        />
      </Field>
      <Field label="Duration (seconds)">
        <Input
          type="number"
          min={0.5}
          step={0.5}
          value={+(scene.durationInFrames / p.fps).toFixed(2)}
          onChange={(e) => {
            const s = Number(e.target.value);
            if (Number.isFinite(s) && s > 0)
              store.updateScene(scene.id, {
                durationInFrames: Math.round(s * p.fps),
              });
          }}
        />
      </Field>
      <Field label="Background">
        <select
          className="mf-focus h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-[13px]"
          value={scene.background?.type ?? "solid"}
          onChange={(e) =>
            store.updateScene(scene.id, {
              background: { ...scene.background, type: e.target.value } as any,
            })
          }
        >
          {["solid", "linearGradient", "radialGradient", "mesh", "grid", "dots", "noise"].map(
            (t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ),
          )}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="BG color">
          <Input
            type="color"
            value={scene.background?.color ?? "#07090f"}
            onChange={(e) =>
              store.updateScene(scene.id, {
                background: { ...scene.background, color: e.target.value } as any,
              })
            }
            className="h-9 p-1"
          />
        </Field>
        <Field label="BG color 2">
          <Input
            type="color"
            value={scene.background?.color2 ?? "#11151f"}
            onChange={(e) =>
              store.updateScene(scene.id, {
                background: { ...scene.background, color2: e.target.value } as any,
              })
            }
            className="h-9 p-1"
          />
        </Field>
      </div>
      <Field label="Transition to next">
        <select
          className="mf-focus h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-[13px]"
          value={scene.transition?.type ?? "fade"}
          onChange={(e) =>
            store.updateScene(scene.id, {
              transition: { ...scene.transition, type: e.target.value } as any,
            })
          }
        >
          {["none", "fade", "slideLeft", "slideRight", "slideUp", "wipeLeft", "wipeRight", "circle", "clockWipe", "zoomBlur"].map(
            (t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ),
          )}
        </select>
      </Field>
      <Field label="Notes">
        <Textarea
          rows={3}
          value={scene.notes ?? ""}
          onChange={(e) => store.updateScene(scene.id, { notes: e.target.value })}
          className="text-[12px]"
        />
      </Field>

      <div className="border-t border-[var(--border)] pt-3">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">
          Layers ({scene.elements.length})
        </div>
        <div className="space-y-1">
          {[...scene.elements]
            .sort((a, b) => b.zIndex - a.zIndex)
            .map((el) => (
              <button
                key={el.id}
                className={cx(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px]",
                  store.selectedElementId === el.id
                    ? "bg-[var(--accent-dim)] text-[var(--text)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]",
                )}
                onClick={() => store.selectElement(el.id)}
              >
                <span className="truncate">
                  {el.name || el.type}
                  {el.type === "text" ? (
                    <span className="ml-1 text-[var(--text-dim)]">
                      “{(el as any).text?.slice(0, 18)}”
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] text-[var(--text-dim)]">{el.type}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function ElementInspector({ sceneId, element }: { sceneId: string; element: Element }) {
  const store = useEditorStore();
  const upd = (patch: any) => store.updateElement(sceneId, element.id, patch);
  const isText = element.type === "text";
  const t = element as any;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge tone="accent">{element.type}</Badge>
        <span className="text-[11px] text-[var(--text-dim)]">{element.name}</span>
      </div>
      {isText && (
        <Field label="Text">
          <Textarea
            rows={3}
            value={t.text ?? ""}
            onChange={(e) => upd({ text: e.target.value })}
            className="text-[12px]"
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="X %">
          <Input
            type="number"
            value={Math.round(element.x)}
            onChange={(e) => upd({ x: Number(e.target.value) })}
          />
        </Field>
        <Field label="Y %">
          <Input
            type="number"
            value={Math.round(element.y)}
            onChange={(e) => upd({ y: Number(e.target.value) })}
          />
        </Field>
        <Field label="Scale">
          <Input
            type="number"
            step={0.05}
            value={element.scale}
            onChange={(e) => upd({ scale: Number(e.target.value) })}
          />
        </Field>
        <Field label="Opacity">
          <Input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={element.opacity}
            onChange={(e) => upd({ opacity: Number(e.target.value) })}
          />
        </Field>
      </div>
      {isText && (
        <>
          <Field label="Color">
            <Input
              type="color"
              value={t.color ?? "#f8fafc"}
              onChange={(e) => upd({ color: e.target.value })}
              className="h-9 p-1"
            />
          </Field>
          <Field label="Variant">
            <select
              className="mf-focus h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-[13px]"
              value={t.variant ?? "heading"}
              onChange={(e) => upd({ variant: e.target.value })}
            >
              {["display", "heading", "subheading", "body", "caption", "label"].map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Max width (px)">
            <Input
              type="number"
              value={t.maxWidth ?? ""}
              placeholder="auto"
              onChange={(e) =>
                upd({ maxWidth: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
        </>
      )}
      <Field label="Entrance">
        <select
          className="mf-focus h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-[13px]"
          value={element.animation?.entrance?.type ?? "fade"}
          onChange={(e) =>
            upd({
              animation: {
                ...element.animation,
                entrance: { ...element.animation?.entrance, type: e.target.value },
              },
            })
          }
        >
          {["none", "fade", "slideUp", "slideDown", "slideLeft", "slideRight", "scale", "pop", "blur", "maskUp", "wipeLeft", "letterStagger", "wordStagger", "typewriter"].map(
            (v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ),
          )}
        </select>
      </Field>
      <Field label="Z-index">
        <Input
          type="number"
          value={element.zIndex}
          onChange={(e) => upd({ zIndex: Number(e.target.value) })}
        />
      </Field>
    </div>
  );
}

/* ---------- Timeline ---------- */

function TimelinePanel({
  project,
  selectedSceneId,
  currentFrame,
  onSelectScene,
  onSeek,
}: {
  project: Project;
  selectedSceneId: string | null;
  currentFrame: number;
  onSelectScene: (id: string) => void;
  onSeek: (f: number) => void;
}) {
  const store = useEditorStore();
  const starts = useMemo(() => sceneStartFrames(project), [project]);
  const total = Math.max(1, project.scenes.reduce((s, sc) => s + sc.durationInFrames, 0));
  const pxPerFrame = 0.18; // compact

  return (
    <div className="flex h-[148px] shrink-0 flex-col border-t border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex h-8 items-center justify-between border-b border-[var(--border)] px-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">
          <Film size={12} /> Timeline
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => store.addScene(selectedSceneId)}
            className="h-6 px-2 text-[11px]"
          >
            <Plus size={12} /> Scene
          </Button>
          {selectedSceneId && project.scenes.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => store.duplicateScene(selectedSceneId)}
                className="h-6 px-2 text-[11px]"
              >
                <Copy size={12} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => store.removeScene(selectedSceneId)}
                className="h-6 px-2 text-[11px] text-red-300 hover:text-red-200"
              >
                <Trash2 size={12} />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto">
        <div
          className="relative h-full"
          style={{ width: Math.max(total * pxPerFrame + 40, 600), minWidth: "100%" }}
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            onSeek(Math.max(0, Math.min(total - 1, Math.round(x / pxPerFrame))));
          }}
        >
          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-0 z-10 h-full w-px bg-[var(--accent)]"
            style={{ left: currentFrame * pxPerFrame }}
          >
            <div className="absolute -left-[4px] top-0 h-2 w-2 rotate-45 bg-[var(--accent)]" />
          </div>
          {/* Scenes */}
          <div className="flex h-full items-stretch gap-px p-2 pt-3">
            {project.scenes.map((sc, i) => {
              const w = Math.max(48, sc.durationInFrames * pxPerFrame);
              const selected = sc.id === selectedSceneId;
              return (
                <button
                  key={sc.id}
                  style={{ width: w }}
                  className={cx(
                    "relative shrink-0 overflow-hidden rounded-md border px-2 py-1.5 text-left transition-colors",
                    selected
                      ? "border-[var(--accent)]/50 bg-[var(--accent-dim)]"
                      : "border-[var(--border)] bg-[var(--bg-panel)] hover:border-[#33333d]",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectScene(sc.id);
                  }}
                >
                  <div className="truncate text-[11px] font-medium text-[var(--text)]">
                    {i + 1}. {sc.name}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[var(--text-dim)]">
                    {(sc.durationInFrames / project.fps).toFixed(1)}s ·{" "}
                    {sc.elements.length} layers
                  </div>
                  <div className="absolute bottom-0 left-0 h-[2px] bg-[var(--accent)]/30" style={{ width: "100%" }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
