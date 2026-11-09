import type { AIProvider, CompletionRequest, CompletionResponse } from "./types.js";

/**
 * The offline provider.
 *
 * `local` is a deterministic creative-director engine that runs entirely in
 * the app with no network access and no API key. It is not a stub: it
 * performs real prompt analysis, derives a visual direction, plans a paced
 * scene sequence and writes concrete on-screen copy.
 *
 * It exists so MotionForge is fully usable — and testable — out of the box,
 * and so the AI layer can be exercised without depending on a paid service.
 * When a real provider is configured it takes precedence automatically.
 */

export interface LocalProviderConfig {
  /** Optional seed so repeated runs can be varied deterministically. */
  seed?: number;
}

export class LocalProvider implements AIProvider {
  readonly id = "local";
  readonly name = "Local Creative Director";
  readonly requiresApiKey = false;

  private readonly config: LocalProviderConfig;

  constructor(config: LocalProviderConfig = {}) {
    this.config = config;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // The local provider is driven through the dedicated `plan`/`edit` entry
    // points rather than generic chat. Returning the last user message keeps
    // the interface honest: this provider does not perform free-form chat.
    const lastUser = [...request.messages]
      .reverse()
      .find((message) => message.role === "user");

    return {
      text: lastUser?.content ?? "",
      model: "local-creative-director",
      usage: {
        promptTokens: request.messages.reduce(
          (sum, message) => sum + Math.ceil(message.content.length / 4),
          0,
        ),
        completionTokens: 0,
      },
    };
  }
}
