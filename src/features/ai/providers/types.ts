/**
 * Provider-agnostic AI interface. Any new provider (Anthropic, etc.)
 * implements `AiProvider` and registers itself in `registry.ts` — no
 * call site changes.
 */

export type Role = "system" | "user" | "assistant";

export interface AiMessage {
  role: Role;
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  /** First assistant message text, trimmed. */
  text: string;
  /** Raw provider payload, for debugging / future structured-output use. */
  raw?: unknown;
}

export interface AiProvider {
  /** Registry key, e.g. `"openai-compatible"`. */
  id: string;
  displayName: string;
  /** Available model choices for the settings UI. Empty = user supplies
   *  free-form (recommended — names go stale). */
  models: string[];
  /** Default model when none configured. */
  defaultModel: string;
  /** Endpoint base URL (no trailing slash, no `/v1`). */
  baseUrl: string;
  chat(req: ChatRequest, apiKey: string): Promise<ChatResponse>;
}

/** Thrown by providers when the API call fails. `message` is safe to
 *  surface to the user. */
export class AiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiError";
    this.status = status;
  }
}
