import { AiError } from "./types";

interface FetchModelsOptions {
  baseUrl: string;
  apiKey: string;
}

/** GET {baseUrl}/models with `Authorization: Bearer ${key}`. The
 *  baseUrl is used verbatim — no normalization, no automatic `/v1`
 *  append. Users may enter either the bare host or the SDK-style
 *  host with `/v1` already included. */
export async function fetchOpenAiModels({
  baseUrl,
  apiKey,
}: FetchModelsOptions): Promise<string[]> {
  if (!apiKey.trim()) {
    throw new AiError("API key is empty. Set it before refreshing the model list.");
  }
  const url = `${baseUrl}/models`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AiError(`Network error: ${msg}`);
  }
  if (!res.ok) {
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
    throw new AiError(body || `${res.status} ${res.statusText}`, res.status);
  }
  const json = (await res.json()) as { data?: { id?: string }[] };
  const ids = (json.data ?? [])
    .map((m) => (typeof m.id === "string" ? m.id.trim() : ""))
    .filter((id): id is string => id.length > 0);
  const unique = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
  return unique;
}
