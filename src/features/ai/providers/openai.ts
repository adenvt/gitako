import { AiError, type AiProvider, type ChatRequest, type ChatResponse } from "./types";

interface OpenAiProviderOptions {
  baseUrl?: string;
  /** Override the default model. The settings page handles persistence. */
  defaultModel?: string;
}

export function createOpenAiProvider(opts: OpenAiProviderOptions = {}): AiProvider {
  // Use the baseUrl as-is. Users enter the full URL including any
  // path prefix they want (OpenAI SDK convention is to include `/v1`;
  // some proxies use `/api/v1` etc.). The default below ships with
  // `/v1` so the common case works out of the box.
  const baseUrl = opts.baseUrl ?? "https://api.openai.com/v1";
  const defaultModel = opts.defaultModel ?? "gpt-4o-mini";

  return {
    id: "openai-compatible",
    displayName: "OpenAI-compatible",
    models: [], // Free-form — names like gpt-4o-mini go stale. User types.
    defaultModel,
    baseUrl,
    async chat(req: ChatRequest, apiKey: string): Promise<ChatResponse> {
      if (!apiKey) {
        throw new AiError("API key is not set. Configure it in AI settings.");
      }
      const url = `${baseUrl}/chat/completions`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: req.model,
            messages: req.messages,
            ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
            ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
            // Pass through structured-output directives. Only set
            // `response_format` when the caller actually provided one;
            // some non-OpenAI endpoints (Ollama, LM Studio) reject an
            // empty/unknown value.
            ...(req.responseFormat !== undefined
              ? { response_format: req.responseFormat }
              : {}),
          }),
          // Forward the abort signal so callers (e.g. a "Cancel" button
          // on a loading toast) can cancel the in-flight request. When
          // the signal is already aborted, fetch rejects immediately
          // with an AbortError DOMException — we let that bubble and
          // let the caller distinguish via `signal.aborted`.
          ...(req.signal ? { signal: req.signal } : {}),
        });
      } catch (e) {
        // Re-throw abort errors verbatim so callers can detect a
        // user-initiated cancel via `signal.aborted` without parsing
        // the message.
        if (req.signal?.aborted) throw e;
        // Network failure — sanitize the message so the API key isn't
        // accidentally embedded by some browser error formatter.
        const msg = e instanceof Error ? e.message : String(e);
        throw new AiError(`Network error: ${msg}`);
      }

      if (!res.ok) {
        const status = res.status;
        let body = "";
        try {
          const json = (await res.json()) as { error?: { message?: string } };
          body = json.error?.message ?? "";
        } catch {
          try {
            body = await res.text();
          } catch {
            /* ignore */
          }
        }
        const message = body || `${status} ${res.statusText}`;
        throw new AiError(message, status);
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      return { text, raw: json };
    },
  };
}