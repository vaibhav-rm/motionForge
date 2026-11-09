import type { AIProvider, CompletionRequest, CompletionResponse } from "./types.js";
import { AIProviderError } from "./types.js";

/**
 * Anthropic provider.
 *
 * Uses the Messages API. Kept separate from the OpenAI-compatible provider
 * so adding a new vendor never requires touching the existing ones.
 */

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic";
  readonly requiresApiKey = true;

  private readonly config: AnthropicConfig;

  constructor(config: AnthropicConfig) {
    this.config = config;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const baseUrl = (this.config.baseUrl ?? "https://api.anthropic.com").replace(
      /\/$/,
      "",
    );
    const systemMessages = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const messages = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role, content: message.content }));

    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: request.model || this.config.model,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          ...(systemMessages ? { system: systemMessages } : {}),
          messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new AIProviderError(
          this.id,
          `Provider responded with ${response.status}: ${errorText.slice(0, 400)}`,
        );
      }

      const payload = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
        model?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const text = (payload.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("");

      if (!text.trim()) {
        throw new AIProviderError(this.id, "Provider returned an empty response.");
      }

      return {
        text,
        model: payload.model ?? this.config.model,
        usage: {
          promptTokens: payload.usage?.input_tokens ?? 0,
          completionTokens: payload.usage?.output_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(
        this.id,
        `Could not reach the AI provider: ${(error as Error).message}`,
        error,
      );
    }
  }
}
