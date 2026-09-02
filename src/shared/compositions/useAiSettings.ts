import { useEffect, useState } from "react";
import { loadAiSettings, type AiSettings } from "@/shared/utils/aiSettings";

/**
 * Reactive access to persisted AI settings. Re-reads when another tab
 * (or the settings page in the same tab) writes to localStorage.
 *
 * Mirrors `useAppSettings` — the settings page writes via
 * `saveAiSettings` and other readers re-read via the storage event.
 */
export function useAiSettings(): AiSettings {
  const [settings, setSettings] = useState<AiSettings>(loadAiSettings);

  useEffect(() => {
    const onStorage = () => setSettings(loadAiSettings());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return settings;
}
