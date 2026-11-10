import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { AIEngineConfig } from "@motionforge/ai-engine";

/**
 * Workspace settings.
 *
 * Stored as a single JSON document next to the local asset storage so the
 * app keeps working without a database migration. API keys never leave the
 * server: the public shape only reports whether a key is present.
 */

const ProviderSchema = z.enum(["local", "openai", "anthropic"]);
export type ProviderId = z.infer<typeof ProviderSchema>;

const AISettingsSchema = z.object({
  provider: ProviderSchema.default("local"),
  openaiApiKey: z.string().default(""),
  openaiBaseUrl: z
    .string()
    .default("https://api.openai.com/v1")
    .refine((value) => /^https?:\/\//i.test(value), "Base URL must be http(s)."),
  openaiModel: z.string().default("gpt-4o-mini"),
  anthropicApiKey: z.string().default(""),
  anthropicModel: z.string().default("claude-3-5-sonnet-latest"),
  temperature: z.number().min(0).max(1.5).default(0.7),
});

const DefaultsSchema = z.object({
  width: z.number().int().min(320).max(7680).default(1920),
  height: z.number().int().min(240).max(4320).default(1080),
  fps: z.number().int().min(1).max(120).default(30),
  quality: z.enum(["draft", "standard", "high"]).default("standard"),
});

export const WorkspaceSettingsSchema = z.object({
  version: z.literal(1).default(1),
  ai: AISettingsSchema,
  defaults: DefaultsSchema,
});

export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;
export type RenderQuality = WorkspaceSettings["defaults"]["quality"];

export const SettingsUpdateSchema = z.object({
  ai: z.object({
    provider: ProviderSchema.optional(),
    openaiApiKey: z.string().max(400).optional(),
    clearOpenAIKey: z.boolean().optional(),
    openaiBaseUrl: z.string().max(500).optional(),
    openaiModel: z.string().max(120).optional(),
    anthropicApiKey: z.string().max(400).optional(),
    clearAnthropicKey: z.boolean().optional(),
    anthropicModel: z.string().max(120).optional(),
    temperature: z.number().min(0).max(1.5).optional(),
  }).default({}),
  defaults: DefaultsSchema.partial().default({}),
});
export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;

export const TestConnectionSchema = z.object({
  provider: ProviderSchema,
  openaiApiKey: z.string().max(400).optional(),
  openaiBaseUrl: z.string().max(500).optional(),
  openaiModel: z.string().max(120).optional(),
  anthropicApiKey: z.string().max(400).optional(),
  anthropicModel: z.string().max(120).optional(),
});

const ENV_PROVIDER: ProviderId = (() => {
  const value = (process.env.AI_PROVIDER ?? "local").toLowerCase();
  if (value === "openai" || value === "openai-compatible" || value === "groq" || value === "openrouter" || value === "ollama") {
    return "openai";
  }
  if (value === "anthropic" || value === "claude") return "anthropic";
  return "local";
})();

/** Defaults for a fresh install, with the environment as the initial hint. */
export function defaultSettings(): WorkspaceSettings {
  return WorkspaceSettingsSchema.parse({
    version: 1,
    ai: {
      provider: ENV_PROVIDER,
      openaiApiKey: "",
      openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      anthropicApiKey: "",
      anthropicModel: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      temperature: 0.7,
    },
    defaults: {
      width: 1920,
      height: 1080,
      fps: 30,
      quality: "standard",
    },
  });
}

export function settingsPath(): string {
  if (process.env.MOTIONFORGE_SETTINGS_PATH) {
    return path.resolve(process.env.MOTIONFORGE_SETTINGS_PATH);
  }
  const root = process.env.STORAGE_LOCAL_ROOT
    ? path.resolve(process.env.STORAGE_LOCAL_ROOT)
    : path.join(process.cwd(), "storage");
  return path.join(root, "settings.json");
}

export async function loadSettings(): Promise<WorkspaceSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    const parsed = WorkspaceSettingsSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // No settings file yet, or an unreadable one: fall back to defaults.
  }
  return defaultSettings();
}

/** Persist a patch. Keys are only replaced when explicitly supplied. */
export async function saveSettings(patch: SettingsUpdate): Promise<WorkspaceSettings> {
  const current = await loadSettings();

  const nextPatch = patch.ai;
  const ai = {
    ...current.ai,
    provider: nextPatch.provider ?? current.ai.provider,
    openaiApiKey:
      nextPatch.clearOpenAIKey
        ? ""
        : nextPatch.openaiApiKey !== undefined
          ? nextPatch.openaiApiKey.trim()
          : current.ai.openaiApiKey,
    openaiBaseUrl:
      nextPatch.openaiBaseUrl !== undefined
        ? nextPatch.openaiBaseUrl.trim()
        : current.ai.openaiBaseUrl,
    openaiModel:
      nextPatch.openaiModel !== undefined
        ? nextPatch.openaiModel.trim()
        : current.ai.openaiModel,
    anthropicApiKey:
      nextPatch.clearAnthropicKey
        ? ""
        : nextPatch.anthropicApiKey !== undefined
          ? nextPatch.anthropicApiKey.trim()
          : current.ai.anthropicApiKey,
    anthropicModel:
      nextPatch.anthropicModel !== undefined
        ? nextPatch.anthropicModel.trim()
        : current.ai.anthropicModel,
    temperature: nextPatch.temperature ?? current.ai.temperature,
  };

  const defaults = { ...current.defaults, ...patch.defaults };
  const next = WorkspaceSettingsSchema.parse({ version: 1, ai, defaults });

  const file = settingsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(tmp, file);

  return next;
}

/** Shape sent to the browser — no secrets. */
export function publicSettings(settings: WorkspaceSettings) {
  return {
    ai: {
      provider: settings.ai.provider,
      openaiBaseUrl: settings.ai.openaiBaseUrl,
      openaiModel: settings.ai.openaiModel,
      anthropicModel: settings.ai.anthropicModel,
      temperature: settings.ai.temperature,
      hasOpenAIKey: Boolean(settings.ai.openaiApiKey || process.env.OPENAI_API_KEY),
      hasAnthropicKey: Boolean(
        settings.ai.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      ),
      openAIKeyFromEnv: !settings.ai.openaiApiKey && Boolean(process.env.OPENAI_API_KEY),
      anthropicKeyFromEnv:
        !settings.ai.anthropicApiKey && Boolean(process.env.ANTHROPIC_API_KEY),
      storedOpenAIKey: Boolean(settings.ai.openaiApiKey),
      storedAnthropicKey: Boolean(settings.ai.anthropicApiKey),
    },
    defaults: settings.defaults,
  };
}

export type PublicSettings = ReturnType<typeof publicSettings>;

/** Turn stored settings into an explicit engine configuration. */
export function resolveAIConfig(settings: WorkspaceSettings): AIEngineConfig {
  const { ai } = settings;
  return {
    provider: ai.provider,
    openaiApiKey: ai.openaiApiKey || process.env.OPENAI_API_KEY,
    openaiBaseUrl: ai.openaiBaseUrl,
    openaiModel: ai.openaiModel,
    anthropicApiKey: ai.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    anthropicModel: ai.anthropicModel,
  };
}
