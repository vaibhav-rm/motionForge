import { z } from "zod";

/**
 * Provider-independent AI interface.
 *
 * The AI layer is responsible for *creative interpretation* only: it turns
 * natural language into a validated plan or edit operation list. It never
 * emits executable code, and the rendering engine never talks to it.
 */

export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const CompletionRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  /** Model identifier, provider specific. */
  model: z.string().default(""),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(64).max(32000).default(4096),
  /** Ask the provider for a JSON object response when supported. */
  jsonMode: z.boolean().default(true),
});
export type CompletionRequest = z.infer<typeof CompletionRequestSchema>;

export const CompletionResponseSchema = z.object({
  text: z.string(),
  model: z.string().default(""),
  /** Provider-reported token usage, when available. */
  usage: z
    .object({
      promptTokens: z.number().int().min(0).default(0),
      completionTokens: z.number().int().min(0).default(0),
    })
    .default({ promptTokens: 0, completionTokens: 0 }),
});
export type CompletionResponse = z.infer<typeof CompletionResponseSchema>;

export interface AIProvider {
  /** Stable identifier, e.g. `openai`, `anthropic`, `local`. */
  readonly id: string;
  /** Human readable name for the UI. */
  readonly name: string;
  /** Whether the provider needs credentials to operate. */
  readonly requiresApiKey: boolean;
  /** Perform a chat completion. */
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

/** Thrown when a provider fails; carries a user-safe message. */
export class AIProviderError extends Error {
  readonly provider: string;
  override readonly cause?: unknown;

  constructor(provider: string, message: string, cause?: unknown) {
    super(message);
    this.name = "AIProviderError";
    this.provider = provider;
    this.cause = cause;
  }
}
