import { fetchStagedDiff } from "@/state/git";
import { createOpenAiProvider } from "./providers/openai";
import { getProvider } from "./providers/registry";
import type { AiProvider } from "./providers/types";
import { buildCommitMessagePrompt, parseCommitMessage } from "./prompts/commitMessage";
import type { AiSettings } from "@/shared/utils/aiSettings";
import type { ParsedCommitMessage } from "./prompts/commitMessage";

export { parseCommitMessage } from "./prompts/commitMessage";
export type { ParsedCommitMessage } from "./prompts/commitMessage";

export interface GenerateCommitMessageOptions {
  /** Settings read from localStorage by the caller. */
  settings: AiSettings;
  /** Repo root (passed to the staged_diff Tauri command). */
  repoPath: string;
}

/** Build a provider instance honoring the user's overridden baseUrl
 *  (Ollama, LM Studio, etc.). Falls back to the registry default. */
function providerFor(settings: AiSettings): AiProvider {
  const provider = getProvider(settings.providerId);
  const baseUrl = settings.baseUrl.trim();
  const model = settings.model.trim() || provider.defaultModel;

  if (settings.providerId === "openai-compatible" && baseUrl && baseUrl !== provider.baseUrl) {
    return { ...createOpenAiProvider({ baseUrl }), defaultModel: model };
  }
  return { ...provider, defaultModel: model };
}

/** Generate a (subject, description) commit message from the staged
 *  diff of `repoPath`. */
export async function generateCommitMessage(
  opts: GenerateCommitMessageOptions,
): Promise<ParsedCommitMessage> {
  const { settings, repoPath } = opts;

  if (!settings.apiKey.trim()) {
    throw new Error("AI is not set up. Add your API key in AI settings.");
  }

  const diff = await fetchStagedDiff(repoPath);
  const provider = providerFor(settings);

  const messages = buildCommitMessagePrompt(diff);
  const res = await provider.chat(
    { model: provider.defaultModel, messages, temperature: 0.2, maxTokens: 400 },
    settings.apiKey,
  );

  return parseCommitMessage(res.text);
}

/** Tiny "are we alive" call used by the AI settings page's
 *  "Test connection" button. */
export async function testAiConnection(settings: AiSettings): Promise<void> {
  if (!settings.apiKey.trim()) {
    throw new Error("API key is empty.");
  }
  const provider = providerFor(settings);
  await provider.chat(
    { model: provider.defaultModel, messages: [{ role: "user", content: "ping" }], maxTokens: 4 },
    settings.apiKey,
  );
}
