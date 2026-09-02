// SECURITY: The API key is currently stored in localStorage as plaintext.
// This is acceptable for local-only desktop apps where the profile
// directory is OS-protected, but a follow-up should move it to the OS
// keychain (Tauri stronghold or the `keyring` crate). Until then, the
// key is never logged, never included in error toasts, and never sent
// anywhere except the configured provider endpoint.

export interface AiSettings {
  providerId: "openai-compatible";
  /** Provider API key. Empty string = not configured. */
  apiKey: string;
  /** Override the provider's default base URL (e.g. for Ollama, LM Studio). */
  baseUrl: string;
  /** Model identifier (free-form). */
  model: string;
}

const STORAGE_KEY = "gitako.ai";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  providerId: "openai-compatible",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
};

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      providerId: "openai-compatible",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseUrl:
        typeof parsed.baseUrl === "string" && parsed.baseUrl.length > 0
          ? parsed.baseUrl
          : DEFAULT_AI_SETTINGS.baseUrl,
      model:
        typeof parsed.model === "string" && parsed.model.length > 0
          ? parsed.model
          : DEFAULT_AI_SETTINGS.model,
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable (private mode etc.) — non-fatal.
  }
}

export function isAiConfigured(settings: AiSettings): boolean {
  return settings.apiKey.trim().length > 0;
}
