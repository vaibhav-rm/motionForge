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
  Send,
  Undo2,
  Film,
  Plus,
  Trash2,
  Copy,
  PanelLeft,
  PanelRight,
  AlertCircle,
  CheckCircle2,
  Wand2,
  Layers,
  Clock,
  Gauge,
  Type,
  Box,
  X,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore, type ChatMsg } from "@/lib/editor-store";
import { Button, Input, Textarea, Badge, Select, Kbd } from "@/components/ui";
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

const SUGGESTIONS = [
  { label: "Make it cinematic", prompt: "Make the whole video more cinematic and dramatic." },
  { label: "Add particles", prompt: "Add subtle floating particles to the current scene." },
  { label: "Monochrome", prompt: "Change the palette to monochrome." },
  { label: "Slow it down", prompt: "Slow the pacing and make transitions smoother." },
];

export function EditorClient({
  projectId,
  defaultQuality = "standard",
}: {
  projectId: string;
  defaultQuality?: "draft" | "standard" | "high";
}) {
  // Subscribe only to the data this shell renders. `currentFrame` changes on
  // every rendered frame; subscribing to it here would re-render the whole
  // editor (and the Remotion player) 30 times a second.
  const {
    project,
    loading,
    error,
    saving,
    dirty,
    lastSavedAt,
    selectedSceneId,
    selectedElementId,
    canUndo,
    canRedo,
  } = useEditorStore(
    useShallow((s) => ({
      project: s.project,
      loading: s.loading,
      error: s.error,
      saving: s.saving,
      dirty: s.dirty,
      lastSavedAt: s.lastSavedAt,
      selectedSceneId: s.selectedSceneId,
      selectedElementId: s.selectedElementId,
      canUndo: s.undoStack.length > 0,
      canRedo: s.redoStack.length > 0,
    })),
  );
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
  const [exportQuality, setExportQuality] = useState<"draft" | "standard" | "high">(
    defaultQuality,
  );
  const [renderStarting, setRenderStarting] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"assistant" | "inspector" | null>(
    null,
  );
  const [seedPrompt, setSeedPrompt] = useState<string | null>(null);

  // Pick up a prompt handed off from the dashboard / templates.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get("prompt");
    if (!prompt) return;
    setSeedPrompt(prompt);
    params.delete("prompt");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );
  }, []);

  // Load project
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ project: Project }>(`/api/projects/${projectId}`);
        if (cancelled) return;
        useEditorStore.getState().setProject(data.project, { markClean: true });
        try {
          const m = await api<{ messages: any[] }>(
            `/api/projects/${projectId}/messages`,
          );
          if (!cancelled)
            useEditorStore.getState().setMessages(
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
          useEditorStore
            .getState()
            .setError(e instanceof Error ? e.message : "Failed to load project");
        if (!cancelled) useEditorStore.setState({ loading: false });
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
  }, [project, dirty, projectId]);

  // Player frame + play state sync
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      useEditorStore.getState().setCurrentFrame(e.detail.frame);
    };
    const onPlay = () => useEditorStore.getState().setPlaying(true);
    const onPause = () => useEditorStore.getState().setPlaying(false);
    player.addEventListener("frameupdate", onFrame as any);
    player.addEventListener("play", onPlay as any);
    player.addEventListener("pause", onPause as any);
    return () => {
      player.removeEventListener("frameupdate", onFrame as any);
      player.removeEventListener("play", onPlay as any);
      player.removeEventListener("pause", onPause as any);
    };
  }, [project]);

  // Undo / redo shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useEditorStore.getState().redo();
        else useEditorStore.getState().undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        useEditorStore.getState().selectScene(sceneId);
        setMobilePanel(null);
      }
    },
    [],
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
    if (!project || renderStarting) return;
    setRenderStarting(true);
    try {
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
    } finally {
      setRenderStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="mf-bay flex h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] text-[13px] text-[var(--text-muted)]">
        <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] mf-accent-gradient">
          <Loader2 size={16} className="mf-spin" />
        </div>
        <div className="text-center">
          <div className="mf-display text-[18px] leading-none text-[var(--text)]">
            Loading studio
          </div>
          <div className="mf-label mt-2 text-[8px]">Cutting room</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mf-bay flex h-screen flex-col items-center justify-center gap-3 bg-[var(--bg)] text-[13px]">
        <AlertCircle size={22} className="text-[var(--danger)]" />
        <div className="text-[var(--text-muted)]">
          {error ?? "Project not found."}
        </div>
        <Link href="/dashboard" className="text-[var(--accent)] hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const selectedScene =
    project.scenes.find((s) => s.id === selectedSceneId) ?? project.scenes[0];
  const selectedElement = selectedScene?.elements.find(
    (e) => e.id === selectedElementId,
  );

  return (
    <div className="mf-bay flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* Top bar */}
      <header className="mf-glass relative z-40 flex h-[54px] shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-2.5 sm:px-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/dashboard"
            className="mf-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
            title="Dashboard"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="mf-display flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--accent)] text-[13px] leading-none text-[var(--accent-contrast)]">
            M
          </div>
          <input
            className="mf-focus-ring h-8 w-32 min-w-0 rounded-[2px] border border-transparent bg-transparent px-2 text-[13px] font-medium text-[var(--text)] transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-hover)] sm:w-48 lg:w-64"
            value={project.name}
            onChange={(e) =>
              useEditorStore
                .getState()
                .patchProject((p) => ({ ...p, name: e.target.value }), "Rename")
            }
            title="Project name"
          />
          <div className="ml-1 hidden items-center gap-1.5 lg:flex">
            <Badge>
              {project.width}×{project.height}
            </Badge>
            <Badge>{project.fps} fps</Badge>
            <Badge tone="accent">
              {formatDuration(durationInFrames / project.fps)}
            </Badge>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="mr-1 hidden items-center gap-1.5 text-[11px] text-[var(--text-dim)] sm:flex">
            {saving ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={11} className="mf-spin" /> Saving
              </span>
            ) : dirty ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Unsaved
              </span>
            ) : lastSavedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Saved
              </span>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => useEditorStore.getState().undo()}
            disabled={!canUndo}
            title="Undo (⌘Z)"
          >
            <Undo2 size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => useEditorStore.getState().redo()}
            disabled={!canRedo}
            title="Redo (⇧⌘Z)"
          >
            <Redo2 size={15} />
          </Button>
          <div className="mx-0.5 h-5 w-px bg-[var(--border)]" />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() =>
              setMobilePanel((v) => (v === "assistant" ? null : "assistant"))
            }
            title="AI assistant"
          >
            <PanelLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden"
            onClick={() =>
              setMobilePanel((v) => (v === "inspector" ? null : "inspector"))
            }
            title="Inspector"
          >
            <PanelRight size={16} />
          </Button>
          <div className="relative">
            <Button variant="primary" size="sm" onClick={() => setExportOpen((v) => !v)}>
              <Download size={14} /> <span className="hidden sm:inline">Export</span>
            </Button>
            {exportOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setExportOpen(false)}
                />
                <div className="mf-panel absolute right-0 top-9 z-30 w-64 p-2 shadow-[4px_4px_0_#000]">
                  <div className="mf-label px-2 py-1 text-[8.5px]">
                    Render quality
                  </div>
                  {(
                    [
                      { id: "draft", label: "Draft", hint: "Fastest · review" },
                      { id: "standard", label: "Standard", hint: "Balanced" },
                      { id: "high", label: "High", hint: "Best quality" },
                    ] as const
                  ).map((q) => (
                    <button
                      key={q.id}
                      className={cx(
                        "mf-focus flex w-full items-center justify-between rounded-[2px] px-2.5 py-2 text-left transition-colors",
                        exportQuality === q.id
                          ? "bg-[var(--accent-dim)] text-[var(--text)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]",
                      )}
                      onClick={() => setExportQuality(q.id)}
                    >
                      <span className="flex items-center gap-1.5 text-[12px] font-medium">
                        {exportQuality === q.id ? (
                          <CheckCircle2 size={12} className="text-[var(--accent)]" />
                        ) : (
                          <span className="h-3 w-3" />
                        )}
                        {q.label}
                      </span>
                      <span className="text-[10px] text-[var(--text-dim)]">{q.hint}</span>
                    </button>
                  ))}
                  <div className="mt-1 border-t border-[var(--border-subtle)] px-2 py-1.5 text-[10px] leading-relaxed text-[var(--text-dim)]">
                    H.264 MP4 · same composition as the preview
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-1.5 w-full"
                    loading={renderStarting}
                    onClick={() => void startRender(exportQuality)}
                  >
                    Start render
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3.5 py-2 text-[12px] text-[var(--danger)]">
          <AlertCircle size={13} /> {error}
          <button
            className="ml-auto text-[11px] underline opacity-80 hover:opacity-100"
            onClick={() => useEditorStore.getState().setError(null)}
          >
            dismiss
          </button>
        </div>
      )}

      {renderJob && <RenderBanner job={renderJob} onClose={() => setRenderJob(null)} />}

      {/* Main workspace */}
      <div className="relative flex min-h-0 flex-1">
        {mobilePanel && (
          <button
            aria-label="Close panel"
            className="absolute inset-0 z-30 bg-black/60 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobilePanel(null)}
          />
        )}

        {/* Left: AI assistant */}
        <AssistantPanel
          projectId={projectId}
          seedPrompt={seedPrompt}
          onSeedConsumed={() => setSeedPrompt(null)}
          mobileOpen={mobilePanel === "assistant"}
          onClose={() => setMobilePanel(null)}
        />

        {/* Center: preview */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mf-stage-glow relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-5">
            <div className="pointer-events-none absolute inset-0 mf-dot-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />
            <div
              className="relative w-full overflow-hidden border border-[var(--border)] bg-black"
              style={{ maxWidth: 1000, aspectRatio: `${project.width}/${project.height}` }}
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
            <div className="mf-label pointer-events-none absolute bottom-3 left-4 hidden items-center gap-2 text-[8px] sm:flex">
              <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
              Live preview
            </div>
          </div>
          <PlaybackBar
            project={project}
            onToggle={() => {
              const p = playerRef.current;
              if (!p) return;
              if (p.isPlaying()) {
                p.pause();
                useEditorStore.getState().setPlaying(false);
              } else {
                p.play();
                useEditorStore.getState().setPlaying(true);
              }
            }}
            onSeek={(f) => playerRef.current?.seekTo(f)}
          />
        </div>

        {/* Right: inspector */}
        <InspectorPanel
          scene={selectedScene ?? null}
          element={selectedElement ?? null}
          mobileOpen={mobilePanel === "inspector"}
          onClose={() => setMobilePanel(null)}
        />
      </div>

      {/* Bottom: timeline */}
      <TimelinePanel
        project={project}
        selectedSceneId={selectedSceneId}
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
  job: {
    id: string;
    status: string;
    progress: number;
    outputPath?: string | null;
    error?: string | null;
  };
  onClose: () => void;
}) {
  const done = job.status === "completed";
  const failed = job.status === "failed";
  const progress = Math.round((job.progress ?? 0) * 100);
  return (
    <div
      className={cx(
        "relative flex items-center gap-2.5 border-b px-3.5 py-2 text-[12px]",
        done
          ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-200"
          : failed
            ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
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
            : `Rendering… ${progress}%`}
      </span>
      {!done && !failed && (
        <div className="mx-2 hidden h-1 w-40 overflow-hidden bg-[var(--bg-hover)] sm:block">
          <div
            className="h-full rounded-full mf-accent-gradient transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {done && (
        <a
          href={`/api/renders/${job.id}?download=1`}
          className="ml-1 rounded-lg bg-emerald-400/15 px-2.5 py-1 font-medium text-emerald-100 transition-colors hover:bg-emerald-400/25"
        >
          Download MP4
        </a>
      )}
      <button
        className="ml-auto flex h-6 w-6 items-center justify-center rounded-[2px] text-[11px] opacity-60 transition hover:bg-[var(--bg-hover)] hover:opacity-100"
        onClick={onClose}
        title="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function PlaybackBar({
  project,
  onToggle,
  onSeek,
}: {
  project: Project;
  onToggle: () => void;
  onSeek: (f: number) => void;
}) {
  // The transport is the only part of the shell that needs the frame clock.
  const frame = useEditorStore((s) => s.currentFrame);
  const playing = useEditorStore((s) => s.playing);
  const total = Math.max(
    1,
    project.scenes.reduce((s, sc) => s + sc.durationInFrames, 0),
  );
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-3.5">
      <button
        className="mf-focus flex h-8 w-8 items-center justify-center mf-accent-gradient transition hover:brightness-110 active:translate-y-px"
        onClick={onToggle}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause size={14} className="fill-[var(--accent-contrast)]" />
        ) : (
          <Play size={14} className="ml-0.5 fill-[var(--accent-contrast)]" />
        )}
      </button>
      <span className="mf-mono hidden w-[112px] shrink-0 text-[10px] text-[var(--text-muted)] sm:block">
        {formatTimecode(frame, project.fps)}
        <span className="text-[var(--text-dim)]">
          {" "}
          / {formatTimecode(total, project.fps)}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={Math.min(frame, total - 1)}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="mf-range h-4 min-w-0 flex-1"
        aria-label="Timeline scrubber"
      />
      <span className="mf-mono hidden shrink-0 border border-[var(--border)] px-2 py-0.5 text-[9.5px] text-[var(--text-dim)] md:block">
        f{frame}
      </span>
    </div>
  );
}

/* ---------- Assistant ---------- */

function AssistantPanel({
  projectId,
  seedPrompt,
  onSeedConsumed,
  mobileOpen,
  onClose,
}: {
  projectId: string;
  seedPrompt: string | null;
  onSeedConsumed: () => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const { messages, aiBusy, project, selectedSceneId, selectedElementId } =
    useEditorStore(
      useShallow((s) => ({
        messages: s.messages,
        aiBusy: s.aiBusy,
        project: s.project,
        selectedSceneId: s.selectedSceneId,
        selectedElementId: s.selectedElementId,
      })),
    );
  const [prompt, setPrompt] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, aiBusy]);
  const isBlank =
    !!project &&
    project.scenes.length <= 1 &&
    project.scenes[0]?.elements.every(
      (e) => e.type === "text" && ((e as any).text ?? "").includes("Describe"),
    );
  const hasContent = project && !isBlank;

  useEffect(() => {
    if (!seedPrompt || seeded.current || !project) return;
    seeded.current = true;
    onSeedConsumed();
    void send(seedPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedPrompt, project]);

  async function send(override?: string) {
    const text = (override ?? prompt).trim();
    if (!text || aiBusy || !project) return;
    if (!override) setPrompt("");
    const userMsg: ChatMsg = { id: rid("msg"), role: "user", content: text };
    const pendingId = rid("msg");
    useEditorStore.getState().addMessage(userMsg);
    useEditorStore.getState().addMessage({
      id: pendingId,
      role: "assistant",
      content: "Thinking…",
      pending: true,
    });
    useEditorStore.getState().setAiBusy(true);
    try {
      const endpoint = isBlank || /^(generate|create|make)\b/i.test(text)
        ? "/api/ai/generate"
        : "/api/ai/edit";
      const body =
        endpoint === "/api/ai/generate"
          ? { projectId, prompt: text }
          : {
              projectId,
              instruction: text,
              focusedSceneId: selectedSceneId,
              selectedElementIds: selectedElementId
                ? [selectedElementId]
                : [],
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
      useEditorStore.getState().setProject(data.project, { markClean: true });
      useEditorStore.getState().markSaved();
      useEditorStore.getState().updateMessage(pendingId, {
        content: data.summary,
        changes: data.changes,
        pending: false,
      });
    } catch (e) {
      useEditorStore.getState().updateMessage(pendingId, {
        content: `Error: ${e instanceof Error ? e.message : "Request failed"}`,
        pending: false,
      });
    } finally {
      useEditorStore.getState().setAiBusy(false);
    }
  }

  return (
    <aside
      className={cx(
        "absolute inset-y-0 left-0 z-40 flex w-[320px] max-w-[85vw] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] transition-transform duration-200 lg:static lg:z-auto lg:max-w-none lg:translate-x-0",
        mobileOpen ? "translate-x-0 shadow-[4px_4px_0_#000]" : "-translate-x-full",
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-3.5">
        <div className="flex h-7 w-7 items-center justify-center border border-[var(--border)] bg-[var(--accent-dim)] text-[var(--accent)]">
          <Wand2 size={13} />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-[12.5px] font-medium text-[var(--text)]">
            Creative Director
          </div>
          <div className="mf-label mt-1 text-[7.5px]">
            Scene planning & edits
          </div>
        </div>
        <button
          className="mf-focus ml-auto flex h-6 w-6 items-center justify-center rounded-[2px] text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] lg:hidden"
          onClick={onClose}
          aria-label="Close assistant"
        >
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {messages.length === 0 && (
          <div className="mf-rise space-y-3">
            <div className="mf-panel p-3.5">
              <div className="text-[12.5px] font-medium text-[var(--text)]">
                Describe the video you want.
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
                Include subject, mood, style and duration. MotionForge plans
                scenes, then compiles them into motion graphics.
              </p>
              <p className="mt-2 border border-[var(--border-subtle)] bg-[var(--bg-sunken)] p-2 text-[11px] leading-relaxed text-[var(--text-dim)]">
                “A 45-second cinematic visualization of a computer network with
                glowing nodes and a deep blue/cyan palette.”
              </p>
            </div>
            <div>
              <div className="mf-label mb-2 px-0.5 text-[8px]">
                Quick directives
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    disabled={aiBusy}
                    onClick={() => void send(s.prompt)}
                    className="mf-focus rounded-[2px] border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-50"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 flex flex-col gap-2.5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cx(
                "mf-rise rounded-[2px] px-3 py-2.5 text-[12px] leading-relaxed",
                m.role === "user"
                  ? "ml-6 border border-[var(--accent)]/30 bg-[var(--accent-dim)] text-[var(--text)]"
                  : "mr-1 border border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-[var(--text-muted)]",
              )}
            >
              {m.role === "assistant" && (
                <div className="mf-label mb-1.5 flex items-center gap-1.5 text-[8px] text-[var(--accent)]">
                  <span className="h-[4px] w-[4px] bg-[var(--accent)]" /> Director
                </div>
              )}
              {m.pending ? (
                <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Loader2 size={12} className="mf-spin" /> Thinking…
                </span>
              ) : (
                m.content
              )}
              {m.changes && m.changes.length > 0 && (
                <ul className="mt-2 space-y-1 border border-[var(--border-subtle)] bg-black/20 p-2 text-[11px] text-[var(--text-dim)]">
                  {m.changes.slice(0, 8).map((c, i) => (
                    <li key={i} className="flex gap-1.5">
                      <CheckCircle2
                        size={11}
                        className="mt-0.5 shrink-0 text-emerald-400/70"
                      />
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-[var(--border)] p-2.5">
        <div className="mf-panel p-1">
          <Textarea
            rows={3}
            placeholder={
              hasContent
                ? "Describe a change… e.g. make the opening more dramatic"
                : "Describe your video…"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
            }}
            className="resize-none border-0 bg-transparent px-2.5 py-2 text-[12px] hover:border-0 focus:ring-0"
          />
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-dim)]">
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd>
            </span>
            <Button
              variant="primary"
              size="sm"
              loading={aiBusy}
              disabled={!prompt.trim()}
              onClick={() => void send()}
            >
              <Send size={13} /> Send
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ---------- Inspector ---------- */

function InspectorPanel({
  scene,
  element,
  mobileOpen,
  onClose,
}: {
  scene: Scene | null;
  element: Element | null;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"scene" | "element">("scene");

  useEffect(() => {
    if (element) setTab("element");
  }, [element?.id]);

  return (
    <aside
      className={cx(
        "absolute inset-y-0 right-0 z-40 flex w-[286px] max-w-[85vw] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)] transition-transform duration-200 xl:static xl:z-auto xl:max-w-none xl:translate-x-0 xl:border-l",
        mobileOpen ? "translate-x-0 shadow-[4px_4px_0_#000]" : "translate-x-full",
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-2.5">
        <div className="flex border border-[var(--border)] bg-black/25 p-0.5">
          {(["scene", "element"] as const).map((t) => (
            <button
              key={t}
              className={cx(
                "mf-focus rounded-[2px] px-3 py-1 text-[11px] font-medium capitalize transition-colors",
                tab === t
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text-muted)]",
              )}
              onClick={() => setTab(t)}
              disabled={t === "element" && !element}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          className="mf-focus flex h-6 w-6 items-center justify-center rounded-[2px] text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] xl:hidden"
          onClick={onClose}
          aria-label="Close inspector"
        >
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tab === "scene" && scene ? (
          <SceneInspector scene={scene} />
        ) : tab === "element" && element && scene ? (
          <ElementInspector sceneId={scene.id} element={element} />
        ) : (
          <div className="border border-dashed border-[var(--border)] p-3 text-[12px] leading-relaxed text-[var(--text-dim)]">
            Select a scene or element to edit its properties.
          </div>
        )}
      </div>
    </aside>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5 border-t border-[var(--border-subtle)] pt-3 first:border-0 first:pt-0">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
        {icon}
        {title}
      </div>
      {children}
    </div>
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
      <div className="mb-1 text-[10.5px] font-medium text-[var(--text-dim)]">
        {label}
      </div>
      {children}
    </label>
  );
}

function SceneInspector({ scene }: { scene: Scene }) {
  const p = useEditorStore((s) => s.project)!;
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  return (
    <div className="space-y-3">
      <Section title="Scene" icon={<Film size={11} />}>
        <Field label="Name">
          <Input
            value={scene.name}
            onChange={(e) => useEditorStore.getState().updateScene(scene.id, { name: e.target.value })}
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
                useEditorStore.getState().updateScene(scene.id, {
                  durationInFrames: Math.round(s * p.fps),
                });
            }}
          />
        </Field>
      </Section>

      <Section title="Background" icon={<Layers size={11} />}>
        <Field label="Style">
          <Select
            value={scene.background?.type ?? "solid"}
            onChange={(e) =>
              useEditorStore.getState().updateScene(scene.id, {
                background: { ...scene.background, type: e.target.value } as any,
              })
            }
          >
            {[
              "solid",
              "linearGradient",
              "radialGradient",
              "mesh",
              "grid",
              "dots",
              "noise",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Color">
            <div className="flex items-center gap-1.5">
              <Input
                type="color"
                value={scene.background?.color ?? "#07090f"}
                onChange={(e) =>
                  useEditorStore.getState().updateScene(scene.id, {
                    background: {
                      ...scene.background,
                      color: e.target.value,
                    } as any,
                  })
                }
                className="h-9 w-10 shrink-0 p-1"
              />
              <span className="truncate text-[10px] uppercase tabular-nums text-[var(--text-dim)]">
                {scene.background?.color ?? "#07090f"}
              </span>
            </div>
          </Field>
          <Field label="Accent">
            <div className="flex items-center gap-1.5">
              <Input
                type="color"
                value={scene.background?.color2 ?? "#11151f"}
                onChange={(e) =>
                  useEditorStore.getState().updateScene(scene.id, {
                    background: {
                      ...scene.background,
                      color2: e.target.value,
                    } as any,
                  })
                }
                className="h-9 w-10 shrink-0 p-1"
              />
              <span className="truncate text-[10px] uppercase tabular-nums text-[var(--text-dim)]">
                {scene.background?.color2 ?? "#11151f"}
              </span>
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Transition" icon={<Clock size={11} />}>
        <Select
          value={scene.transition?.type ?? "fade"}
          onChange={(e) =>
            useEditorStore.getState().updateScene(scene.id, {
              transition: { ...scene.transition, type: e.target.value } as any,
            })
          }
        >
          {[
            "none",
            "fade",
            "slideLeft",
            "slideRight",
            "slideUp",
            "wipeLeft",
            "wipeRight",
            "circle",
            "clockWipe",
            "zoomBlur",
          ].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Section>

      <Section title="Notes" icon={<Type size={11} />}>
        <Textarea
          rows={3}
          value={scene.notes ?? ""}
          onChange={(e) => useEditorStore.getState().updateScene(scene.id, { notes: e.target.value })}
          className="text-[12px]"
          placeholder="Direction for this scene…"
        />
      </Section>

      <Section title={`Layers · ${scene.elements.length}`} icon={<Box size={11} />}>
        <div className="space-y-1">
          {[...scene.elements]
            .sort((a, b) => b.zIndex - a.zIndex)
            .map((el) => (
              <button
                key={el.id}
                className={cx(
                  "flex w-full items-center gap-2 rounded-[2px] border px-2 py-1.5 text-left text-[11.5px] transition-colors",
                  selectedElementId === el.id
                    ? "border-[var(--accent)]/40 bg-[var(--accent-dim)] text-[var(--text)]"
                    : "border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--bg-hover)]",
                )}
                onClick={() => useEditorStore.getState().selectElement(el.id)}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center bg-[var(--bg-hover)] text-[var(--text-dim)]">
                  {el.type === "text" ? <Type size={10} /> : <Box size={10} />}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {el.name || el.type}
                </span>
                <span className="shrink-0 text-[9.5px] uppercase tracking-wide text-[var(--text-dim)]">
                  {el.type}
                </span>
              </button>
            ))}
        </div>
      </Section>
    </div>
  );
}

function ElementInspector({ sceneId, element }: { sceneId: string; element: Element }) {
  const upd = (patch: any) =>
    useEditorStore.getState().updateElement(sceneId, element.id, patch);
  const isText = element.type === "text";
  const t = element as any;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 border border-[var(--border)] bg-[var(--bg-sunken)] px-2.5 py-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-medium text-[var(--text)]">
            {element.name || element.type}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
            {element.type} layer
          </div>
        </div>
        <Badge tone="accent">{element.type}</Badge>
      </div>

      {isText && (
        <Section title="Content" icon={<Type size={11} />}>
          <Textarea
            rows={3}
            value={t.text ?? ""}
            onChange={(e) => upd({ text: e.target.value })}
            className="text-[12px]"
          />
          <Field label="Color">
            <div className="flex items-center gap-1.5">
              <Input
                type="color"
                value={t.color ?? "#f8fafc"}
                onChange={(e) => upd({ color: e.target.value })}
                className="h-9 w-10 shrink-0 p-1"
              />
              <span className="truncate text-[10px] uppercase tabular-nums text-[var(--text-dim)]">
                {t.color ?? "#f8fafc"}
              </span>
            </div>
          </Field>
          <Field label="Variant">
            <Select
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
            </Select>
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
        </Section>
      )}

      <Section title="Transform" icon={<Gauge size={11} />}>
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
      </Section>

      <Section title="Animation" icon={<Wand2 size={11} />}>
        <Field label="Entrance">
          <Select
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
            {[
              "none",
              "fade",
              "slideUp",
              "slideDown",
              "slideLeft",
              "slideRight",
              "scale",
              "pop",
              "blur",
              "maskUp",
              "wipeLeft",
              "letterStagger",
              "wordStagger",
              "typewriter",
            ].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Z-index">
          <Input
            type="number"
            value={element.zIndex}
            onChange={(e) => upd({ zIndex: Number(e.target.value) })}
          />
        </Field>
      </Section>
    </div>
  );
}

/* ---------- Timeline ---------- */

function TimelinePanel({
  project,
  selectedSceneId,
  onSelectScene,
  onSeek,
}: {
  project: Project;
  selectedSceneId: string | null;
  onSelectScene: (id: string) => void;
  onSeek: (f: number) => void;
}) {
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const starts = useMemo(() => sceneStartFrames(project), [project]);
  const total = Math.max(
    1,
    project.scenes.reduce((s, sc) => s + sc.durationInFrames, 0),
  );
  const pxPerFrame = Math.max(0.32, Math.min(2.4, 1400 / total));
  const pad = 10;
  const tickStep = total * pxPerFrame > 2400 ? project.fps * 5 : project.fps;
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let f = 0; f <= total; f += tickStep) out.push(f);
    return out;
  }, [total, tickStep]);

  return (
    <div className="flex h-[164px] shrink-0 flex-col border-t border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex h-9 items-center justify-between gap-2 border-b border-[var(--border)] px-3">
        <div className="mf-label flex items-center gap-2 text-[8px]">
          <Film size={10} /> Timeline
          <span className="border border-[var(--border)] px-1.5 py-0.5 text-[8.5px] tracking-[0.08em]">
            {project.scenes.length} scenes
          </span>
          <span className="mf-mono hidden text-[9px] tracking-[0.04em] text-[var(--text-dim)] sm:inline">
            {formatTimecode(currentFrame, project.fps)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => useEditorStore.getState().addScene(selectedSceneId)}
            className="h-6 px-2 text-[11px]"
          >
            <Plus size={12} /> <span className="hidden sm:inline">Scene</span>
          </Button>
          {selectedSceneId && project.scenes.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => useEditorStore.getState().duplicateScene(selectedSceneId)}
                className="h-6 px-2 text-[11px]"
                title="Duplicate scene"
              >
                <Copy size={12} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => useEditorStore.getState().removeScene(selectedSceneId)}
                className="h-6 px-2 text-[11px] text-rose-300 hover:text-rose-200"
                title="Delete scene"
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
          style={{
            width: Math.max(total * pxPerFrame + pad * 2, 600),
            minWidth: "100%",
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = e.clientX - rect.left - pad;
            onSeek(Math.max(0, Math.min(total - 1, Math.round(x / pxPerFrame))));
          }}
        >
          {/* Ruler */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-5">
            {ticks.map((f) => (
              <div
                key={f}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: f * pxPerFrame + pad }}
              >
                <span className="h-1.5 w-px bg-[var(--border-strong)]" />
                <span className="mf-mono mt-0.5 text-[8px] text-[var(--text-dim)]">
                  {Math.floor(f / project.fps)}s
                </span>
              </div>
            ))}
          </div>

          {/* Playhead */}
          <div
            className="pointer-events-none absolute bottom-2 top-0 z-20 w-px bg-[var(--accent)]"
            style={{ left: currentFrame * pxPerFrame + pad }}
          >
            <div className="absolute -left-[3px] top-0 h-[7px] w-[7px] rotate-45 bg-[var(--accent)]" />
          </div>

          {/* Scene blocks */}
          <div className="absolute inset-x-0 bottom-2 top-7">
            {project.scenes.map((sc, i) => {
              const w = Math.max(46, sc.durationInFrames * pxPerFrame - 2);
              const selected = sc.id === selectedSceneId;
              return (
                <button
                  key={sc.id}
                  style={{
                    left: (starts[i] ?? 0) * pxPerFrame + pad,
                    width: w,
                  }}
                  className={cx(
                    "absolute top-1 bottom-1 overflow-hidden rounded-[2px] border px-2 py-1.5 text-left transition-all duration-200",
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                      : "border-[var(--border)] bg-[var(--bg-sunken)] hover:border-[var(--border-strong)]",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectScene(sc.id);
                  }}
                  title={sc.name}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cx(
                        "flex h-4 w-4 shrink-0 items-center justify-center text-[9px] font-semibold",
                        selected
                          ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                          : "bg-[var(--bg-hover)] text-[var(--text-dim)]",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={cx(
                        "truncate text-[10.5px] font-medium",
                        selected ? "text-[var(--text)]" : "text-[var(--text-muted)]",
                      )}
                    >
                      {sc.name}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[9.5px] text-[var(--text-dim)]">
                    {(sc.durationInFrames / project.fps).toFixed(1)}s ·{" "}
                    {sc.elements.length} layers
                  </div>
                  <div
                    className={cx(
                      "absolute bottom-0 left-0 h-[2px]",
                      selected ? "bg-[var(--accent)]" : "bg-[var(--border)]",
                    )}
                    style={{ width: "100%" }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
