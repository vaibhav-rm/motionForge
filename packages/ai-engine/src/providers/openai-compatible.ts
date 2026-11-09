import type { AIProvider, CompletionRequest, CompletionResponse } from "./types.js";
import { AIProviderError } from "./types.js";

/**
 * OpenAI-compatible provider.
 *
 * Works against OpenAI itself and any service exposing the same
 * `/chat/completions` shape: Groq, OpenRouter, Together, Fireworks,
 * DeepSeek, Ollama, LM Studio and others. Only the base URL and model
 * change, which is what makes the layer provider-independent.
 */

export interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Extra headers, e.g. for gateways that require them. */
  headers?: Record<string, string>;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly id = "openai";
  readonly name = "OpenAI-compatible";
  readonly requiresApiKey = true;

  private readonly config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const endpoint = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;

    const body: Record<string, unknown> = {
      model: request.model || this.config.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    };

    // `response_format` is only honoured by some compatible servers; a 400
    // falls back to a plain request with the JSON instruction in the prompt.
    if (request.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          ...this.config.headers,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        if (response.status === 400 && request.jsonMode) {
          return this.completeWithoutJsonMode(request);
        }
        throw new AIProviderError(
          this.id,
          `Provider responded with ${response.status}: ${errorText.slice(0, 400)}`,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const text = payload.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) {
        throw new AIProviderError(this.id, "Provider returned an empty response.");
      }

      return {
        text,
        model: payload.model ?? this.config.model,
        usage: {
          promptTokens: payload.usage?.prompt_tokens ?? 0,
          completionTokens: payload.usage?.completion_tokens ?? 0,
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

  /** Retry without `response_format` for servers that reject it. */
  private async completeWithoutJsonMode(
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    const endpoint = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
      },
      body: JSON.stringify({
        model: request.model || this.config.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new AIProviderError(
        this.id,
        `Provider responded with ${response.status}.`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };

    return {
      text: payload.choices?.[0]?.message?.content ?? "",
      model: payload.model ?? this.config.model,
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }
}
