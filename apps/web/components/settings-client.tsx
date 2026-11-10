"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MonitorPlay,
  PlugZap,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Input, Select } from "./ui";
import type { PublicSettings, RenderQuality } from "@/lib/settings";

type ProviderId = "local" | "openai" | "anthropic";

type FormState = {
  provider: ProviderId;
  openaiBaseUrl: string;
  openaiModel: string;
  anthropicModel: string;
  temperature: number;
  width: number;
  height: number;
  fps: number;
  quality: RenderQuality;
};

const PRESETS = [
  { label: "16:9 · 1920×1080", width: 1920, height: 1080 },
  { label: "16:9 · 1280×720", width: 1280, height: 720 },
  { label: "9:16 · 1080×1920", width: 1080, height: 1920 },
  { label: "1:1 · 1080×1080", width: 1080, height: 1080 },
  { label: "4:5 · 1080×1350", width: 1080, height: 1350 },
];

const QUALITIES: { id: RenderQuality; label: string; hint: string }[] = [
  { id: "draft", label: "Draft", hint: "Fastest · review cuts" },
  { id: "standard", label: "Standard", hint: "Balanced default" },
  { id: "high", label: "High", hint: "Best quality · slowest" },
];

function toForm(settings: PublicSettings): FormState {
  return {
    provider: settings.ai.provider,
    openaiBaseUrl: settings.ai.openaiBaseUrl,
    openaiModel: settings.ai.openaiModel,
    anthropicModel: settings.ai.anthropicModel,
    temperature: settings.ai.temperature,
    width: settings.defaults.width,
    height: settings.defaults.height,
    fps: settings.defaults.fps,
    quality: settings.defaults.quality,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json?.error?.message ?? "Request failed");
  }
  return json.data as T;
}

export function SettingsClient() {
  const [saved, setSaved] = useState<PublicSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [clearOpenAI, setClearOpenAI] = useState(false);
  const [clearAnthropic, setClearAnthropic] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    request<{ settings: PublicSettings }>("/api/settings")
      .then((data) => {
        if (cancelled) return;
        setSaved(data.settings);
        setForm(toForm(data.settings));
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus({ tone: "err", text: e instanceof Error ? e.message : "Could not load settings" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => {
    if (!form || !saved) return false;
    return (
      JSON.stringify(form) !== JSON.stringify(toForm(saved)) ||
      openaiKey.length > 0 ||
      anthropicKey.length > 0 ||
      clearOpenAI ||
      clearAnthropic
    );
  }, [form, saved, openaiKey, anthropicKey, clearOpenAI, clearAnthropic]);

  function patch(next: Partial<FormState>) {
    setForm((current) => (current ? { ...current, ...next } : current));
    setStatus(null);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setStatus(null);
    try {
      const data = await request<{ settings: PublicSettings }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          ai: {
            provider: form.provider,
            openaiBaseUrl: form.openaiBaseUrl,
            openaiModel: form.openaiModel,
            anthropicModel: form.anthropicModel,
            temperature: form.temperature,
            ...(openaiKey.trim() ? { openaiApiKey: openaiKey.trim() } : {}),
            ...(clearOpenAI ? { clearOpenAIKey: true } : {}),
            ...(anthropicKey.trim() ? { anthropicApiKey: anthropicKey.trim() } : {}),
            ...(clearAnthropic ? { clearAnthropicKey: true } : {}),
          },
          defaults: {
            width: Math.round(form.width),
            height: Math.round(form.height),
            fps: Math.round(form.fps),
            quality: form.quality,
          },
        }),
      });
      setSaved(data.settings);
      setForm(toForm(data.settings));
      setOpenaiKey("");
      setAnthropicKey("");
      setClearOpenAI(false);
      setClearAnthropic(false);
      setStatus({ tone: "ok", text: "Settings saved. New generations use them immediately." });
    } catch (e) {
      setStatus({ tone: "err", text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (!form) return;
    setTesting(true);
    setStatus(null);
    try {
      const data = await request<{ message: string; model?: string }>(
        "/api/settings/ai/test",
        {
          method: "POST",
          body: JSON.stringify({
            provider: form.provider,
            openaiBaseUrl: form.openaiBaseUrl,
            openaiModel: form.openaiModel,
            anthropicModel: form.anthropicModel,
            ...(openaiKey.trim() ? { openaiApiKey: openaiKey.trim() } : {}),
            ...(anthropicKey.trim() ? { anthropicApiKey: anthropicKey.trim() } : {}),
          }),
        },
      );
      setStatus({
        tone: "ok",
        text: [data.message, data.model ? `Model: ${data.model}` : null]
          .filter(Boolean)
          .join(" · "),
      });
    } catch (e) {
      setStatus({ tone: "err", text: e instanceof Error ? e.message : "Connection failed" });
    } finally {
      setTesting(false);
    }
  }

  if (!form || !saved) {
    return (
      <div className="mx-auto flex w-full max-w-[880px] items-center gap-2.5 px-4 py-14 text-[12.5px] text-[var(--text-muted)] sm:px-7">
        <Loader2 size={14} className="mf-spin" /> Loading configuration…
      </div>
    );
  }

  const needsKey = form.provider !== "local";
  const hasKey =
    form.provider === "anthropic"
      ? saved.ai.hasAnthropicKey || anthropicKey.trim().length > 0
      : saved.ai.hasOpenAIKey || openaiKey.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 py-7 sm:px-7 sm:py-9">
      <div className="mf-rise border-b border-[var(--border)] pb-5">
        <div className="mf-label">Configuration — workspace level</div>
        <h2 className="mf-display mt-3 text-[32px] leading-none tracking-[-0.03em] sm:text-[38px]">
          How the studio runs.
        </h2>
        <p className="mt-3 max-w-[62ch] text-[12.5px] leading-relaxed text-[var(--text-muted)]">
          Bring your own model, or keep the offline director. Keys are stored on
          this server and never sent back to the browser.
        </p>
      </div>

      <section className="border-b border-[var(--border)] py-6">
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <div>
            <div className="mf-label">01 / Director</div>
            <h3 className="mf-display mt-1.5 text-[21px] leading-tight">
              AI provider
            </h3>
            <div className="mt-2">
              {form.provider === "local" ? (
                <Badge tone="success">Offline engine</Badge>
              ) : hasKey ? (
                <Badge tone="success">Key configured</Badge>
              ) : (
                <Badge tone="warn">Key required</Badge>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Provider
                </span>
                <span className="mf-label text-[8px]">applies immediately</span>
              </div>
              <Select
                value={form.provider}
                onChange={(e) => patch({ provider: e.target.value as ProviderId })}
              >
                <option value="local">Local creative director — no key</option>
                <option value="openai">OpenAI-compatible — OpenAI, Groq, OpenRouter, Ollama</option>
                <option value="anthropic">Anthropic — Claude models</option>
              </Select>
            </label>

            {form.provider === "openai" && (
              <div className="space-y-4 border-l-2 border-[var(--accent)] pl-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    <KeyRound size={11} /> API key
                  </span>
                  <div className="flex gap-1.5">
                    <Input
                      type={reveal ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      value={openaiKey}
                      onChange={(e) => {
                        setOpenaiKey(e.target.value);
                        setClearOpenAI(false);
                      }}
                      placeholder={
                        saved.ai.storedOpenAIKey
                          ? "•••••••• stored — leave blank to keep"
                          : saved.ai.openAIKeyFromEnv
                            ? "Using OPENAI_API_KEY from environment"
                            : "sk-…"
                      }
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setReveal((v) => !v)}
                      title={reveal ? "Hide key" : "Show key"}
                    >
                      {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10.5px] text-[var(--text-dim)]">
                      {saved.ai.storedOpenAIKey
                        ? "A key is stored for this workspace."
                        : saved.ai.openAIKeyFromEnv
                          ? "Environment key detected — saving an override replaces it."
                          : "Never committed. Stored in the workspace settings file."}
                    </span>
                    {saved.ai.storedOpenAIKey && (
                      <button
                        className="shrink-0 text-[10.5px] text-[var(--danger)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--danger)]"
                        onClick={() => {
                          setClearOpenAI(true);
                          setOpenaiKey("");
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {clearOpenAI && (
                    <div className="mt-1.5 text-[10.5px] text-[var(--warn)]">
                      Key will be removed when you save.
                    </div>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    Base URL
                  </span>
                  <Input
                    value={form.openaiBaseUrl}
                    onChange={(e) => patch({ openaiBaseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    spellCheck={false}
                  />
                  <span className="mt-1 block text-[10.5px] text-[var(--text-dim)]">
                    Any OpenAI-compatible endpoint: Groq, OpenRouter, Together,
                    DeepSeek, Ollama, LM Studio.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    Model
                  </span>
                  <Input
                    value={form.openaiModel}
                    onChange={(e) => patch({ openaiModel: e.target.value })}
                    placeholder="gpt-4o-mini"
                    spellCheck={false}
                  />
                </label>
              </div>
            )}

            {form.provider === "anthropic" && (
              <div className="space-y-4 border-l-2 border-[var(--accent)] pl-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    <KeyRound size={11} /> API key
                  </span>
                  <div className="flex gap-1.5">
                    <Input
                      type={reveal ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      value={anthropicKey}
                      onChange={(e) => {
                        setAnthropicKey(e.target.value);
                        setClearAnthropic(false);
                      }}
                      placeholder={
                        saved.ai.storedAnthropicKey
                          ? "•••••••• stored — leave blank to keep"
                          : saved.ai.anthropicKeyFromEnv
                            ? "Using ANTHROPIC_API_KEY from environment"
                            : "sk-ant-…"
                      }
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setReveal((v) => !v)}
                      title={reveal ? "Hide key" : "Show key"}
                    >
                      {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10.5px] text-[var(--text-dim)]">
                      {saved.ai.storedAnthropicKey
                        ? "A key is stored for this workspace."
                        : saved.ai.anthropicKeyFromEnv
                          ? "Environment key detected — saving an override replaces it."
                          : "Never committed. Stored in the workspace settings file."}
                    </span>
                    {saved.ai.storedAnthropicKey && (
                      <button
                        className="shrink-0 text-[10.5px] text-[var(--danger)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--danger)]"
                        onClick={() => {
                          setClearAnthropic(true);
                          setAnthropicKey("");
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {clearAnthropic && (
                    <div className="mt-1.5 text-[10.5px] text-[var(--warn)]">
                      Key will be removed when you save.
                    </div>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    Model
                  </span>
                  <Input
                    value={form.anthropicModel}
                    onChange={(e) => patch({ anthropicModel: e.target.value })}
                    placeholder="claude-3-5-sonnet-latest"
                    spellCheck={false}
                  />
                </label>
              </div>
            )}

            <label className="block">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Temperature
                </span>
                <span className="mf-mono text-[10px] text-[var(--text-muted)]">
                  {form.temperature.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={form.temperature}
                onChange={(e) => patch({ temperature: Number(e.target.value) })}
                className="mf-range h-4 w-full"
              />
              <span className="mt-1 block text-[10.5px] text-[var(--text-dim)]">
                Lower is steadier and more literal. Higher is more varied.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4">
              <Button
                variant="outline"
                onClick={() => void test()}
                loading={testing}
                disabled={needsKey && !hasKey}
              >
                <PlugZap size={13} /> Test connection
              </Button>
              <span className="text-[10.5px] text-[var(--text-dim)]">
                Sends one tiny request — no project is changed.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--border)] py-6">
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <div>
            <div className="mf-label">02 / Defaults</div>
            <h3 className="mf-display mt-1.5 text-[21px] leading-tight">
              New projects
            </h3>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-dim)]">
              Used for every composition created from the dashboard or templates.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <span className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
                <MonitorPlay size={11} /> Resolution
              </span>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => {
                  const active =
                    form.width === preset.width && form.height === preset.height;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => patch({ width: preset.width, height: preset.height })}
                      className={`mf-focus rounded-[2px] border px-2.5 py-1 font-mono text-[10.5px] transition-colors ${
                        active
                          ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] text-[var(--text-dim)]">Width</span>
                  <Input
                    type="number"
                    min={320}
                    max={7680}
                    value={form.width}
                    onChange={(e) => patch({ width: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] text-[var(--text-dim)]">Height</span>
                  <Input
                    type="number"
                    min={240}
                    max={4320}
                    value={form.height}
                    onChange={(e) => patch({ height: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Frame rate
                </span>
                <Select
                  value={String(form.fps)}
                  onChange={(e) => patch({ fps: Number(e.target.value) })}
                >
                  {[24, 25, 30, 60].map((fps) => (
                    <option key={fps} value={fps}>
                      {fps} fps
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Render quality
                </span>
                <Select
                  value={form.quality}
                  onChange={(e) => patch({ quality: e.target.value as RenderQuality })}
                >
                  {QUALITIES.map((quality) => (
                    <option key={quality.id} value={quality.id}>
                      {quality.label} — {quality.hint}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--border)] py-6">
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <div>
            <div className="mf-label">03 / Output</div>
            <h3 className="mf-display mt-1.5 text-[21px] leading-tight">
              Rendering
            </h3>
          </div>
          <div>
            <div className="mf-mono mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] uppercase tracking-[0.08em] text-[var(--text-dim)]">
              <span>Remotion</span>
              <span>·</span>
              <span>FFmpeg</span>
              <span>·</span>
              <span>H.264 MP4</span>
              <span>·</span>
              <span>{form.fps} fps</span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Exports use Remotion&apos;s server-side renderer and FFmpeg. The
              render queue is database-backed; for production, run the worker
              process separately:
            </p>
            <pre className="mt-3 overflow-auto border border-[var(--border)] bg-[var(--bg-sunken)] p-3 font-mono text-[11px] text-[var(--text-muted)]">{`npm run worker --workspace @motionforge/renderer`}</pre>
          </div>
        </div>
      </section>

      <section className="py-6">
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <div>
            <div className="mf-label">04 / Control</div>
            <h3 className="mf-display mt-1.5 text-[21px] leading-tight">
              Editor shortcuts
            </h3>
          </div>
          <div className="border-t border-[var(--border)]">
            {[
              ["Play / pause", "Space"],
              ["Send to director", "⌘ Enter"],
              ["Undo", "⌘ Z"],
              ["Redo", "⇧ ⌘ Z"],
            ].map(([label, keys]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-[var(--border-subtle)] py-2.5"
              >
                <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
                <kbd className="mf-mono border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[9.5px] text-[var(--text-dim)]">
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--bg)]/95 px-4 py-3 sm:-mx-7 sm:px-7">
        <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!dirty}>
          <Save size={13} /> Save settings
        </Button>
        {status ? (
          <span
            className={`inline-flex min-w-0 items-center gap-1.5 text-[11.5px] ${
              status.tone === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"
            }`}
          >
            {status.tone === "ok" ? <Check size={12} /> : <ShieldCheck size={12} />}
            <span className="min-w-0 truncate">{status.text}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
            <Cpu size={12} />
            {dirty ? "Unsaved changes" : "Everything up to date"}
          </span>
        )}
      </div>
    </div>
  );
}
