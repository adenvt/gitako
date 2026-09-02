import type { AiProvider } from "./types";
import { createOpenAiProvider } from "./openai";

/** Lazy factories so adding a new provider is a one-line change. */
const factories: Record<string, () => AiProvider> = {
  "openai-compatible": () => createOpenAiProvider(),
};

/** Provider descriptors for the settings page (id + display name only —
 *  the actual provider instance is constructed on demand). */
export const providerList: { id: string; displayName: string }[] = [
  { id: "openai-compatible", displayName: "OpenAI-compatible" },
];

export function getProvider(id: string): AiProvider {
  const factory = factories[id];
  if (!factory) {
    throw new Error(`Unknown AI provider: ${id}`);
  }
  return factory();
}
