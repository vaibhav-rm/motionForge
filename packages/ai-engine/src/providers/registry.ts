import type { AIProvider } from "./types.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import { AnthropicProvider } from "./anthropic.js";
import { LocalProvider } from "./local.js";

/**
 * Provider registry.
 *
 * The AI provider is selected by configuration, never hardcoded into the
 * generation pipeline. `local` is the default so the application works with
 * no credentials at all.
 */

export interface AIEngineConfig {
  /** `local` | `openai` | `anthropic`. */
  provider?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
}

let cachedProvider: AIProvider | null = null;
let cachedKey = "";

/** Read configuration from the environment. */
export function configFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AIEngineConfig {
  return {
    provider: env.AI_PROVIDER?.toLowerCase() || "local",
    openaiApiKey: env.OPENAI_API_KEY,
    openaiBaseUrl: env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    openaiModel: env.OPENAI_MODEL || "gpt-4o-mini",
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    anthropicModel: env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
  };
}

/** Build a provider from an explicit configuration. */
export function createProvider(config: AIEngineConfig): AIProvider {
  const provider = (config.provider ?? "local").toLowerCase();

  switch (provider) {
    case "openai":
    case "openai-compatible":
    case "groq":
    case "openrouter":
    case "ollama":
      if (!config.openaiApiKey) {
        throw new Error(
          `AI_PROVIDER="${provider}" requires OPENAI_API_KEY to be set.`,
        );
      }
      return new OpenAICompatibleProvider({
        apiKey: config.openaiApiKey,
        baseUrl: config.openaiBaseUrl ?? "https://api.openai.com/v1",
        model: config.openaiModel ?? "gpt-4o-mini",
      });

    case "anthropic":
    case "claude":
      if (!config.anthropicApiKey) {
        throw new Error(
          'AI_PROVIDER="anthropic" requires ANTHROPIC_API_KEY to be set.',
        );
      }
      return new AnthropicProvider({
        apiKey: config.anthropicApiKey,
        model: config.anthropicModel ?? "claude-3-5-sonnet-latest",
      });

    case "local":
    case "offline":
    default:
      return new LocalProvider();
  }
}

/**
 * Get the active provider.
 *
 * The provider is created once and cached. If the configured provider cannot
 * be created (for example a missing API key), the engine falls back to the
 * local creative director rather than failing the whole request — the
 * application remains usable and the user is not blocked.
 */
export function getProvider(config?: AIEngineConfig): AIProvider {
  const resolved = config ?? configFromEnv();
  const key = JSON.stringify(resolved);

  if (cachedProvider && cachedKey === key) return cachedProvider;

  try {
    cachedProvider = createProvider(resolved);
  } catch {
    cachedProvider = new LocalProvider();
  }
  cachedKey = key;
  return cachedProvider;
}

/** Reset the cached provider (used by tests). */
export function resetProvider(): void {
  cachedProvider = null;
  cachedKey = "";
}
