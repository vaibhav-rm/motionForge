import { NextRequest } from "next/server";
import { createProvider, AIProviderError } from "@motionforge/ai-engine";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { loadSettings, TestConnectionSchema } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Validate a provider configuration by sending one tiny completion.
 * Uses the stored key when the form leaves the key field untouched.
 */
export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const parsed = await readJson(request, TestConnectionSchema);
    if (!parsed.ok) return parsed.response;

    const input = parsed.data;
    const saved = await loadSettings();

    if (input.provider === "local") {
      return jsonOk({
        provider: "local",
        model: "local-creative-director",
        message: "Offline director is ready — no key or network required.",
      });
    }

    const provider = createProvider({
      provider: input.provider,
      openaiApiKey:
        input.openaiApiKey?.trim() ||
        saved.ai.openaiApiKey ||
        process.env.OPENAI_API_KEY,
      openaiBaseUrl:
        input.openaiBaseUrl?.trim() || saved.ai.openaiBaseUrl,
      openaiModel: input.openaiModel?.trim() || saved.ai.openaiModel,
      anthropicApiKey:
        input.anthropicApiKey?.trim() ||
        saved.ai.anthropicApiKey ||
        process.env.ANTHROPIC_API_KEY,
      anthropicModel:
        input.anthropicModel?.trim() || saved.ai.anthropicModel,
    });

    const started = Date.now();
    const response = await provider.complete({
      messages: [
        {
          role: "user",
          content:
            'Reply with exactly the JSON object {"ok":true} and nothing else.',
        },
      ],
      model: "",
      temperature: 0,
      maxTokens: 24,
      jsonMode: true,
    });

    return jsonOk({
      provider: provider.id,
      model: response.model || undefined,
      latencyMs: Date.now() - started,
      message: `Connected in ${Date.now() - started}ms.`,
      sample: response.text.slice(0, 120),
    });
  } catch (error) {
    if (error instanceof AIProviderError) {
      return jsonError(error.message, 502, "PROVIDER_ERROR");
    }
    if (error instanceof Error && /requires .*API_KEY/.test(error.message)) {
      return jsonError(error.message, 400, "MISSING_API_KEY");
    }
    return handleApiError(error);
  }
}
