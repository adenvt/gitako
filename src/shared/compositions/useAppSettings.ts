import { useEffect, useState } from "react";
import { loadSettings, type AppSettings } from "@/shared/utils/settings";

/** Reactive access to persisted app settings. Re-reads when another tab (or a
 * future settings page) writes to localStorage. */
export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    const onStorage = () => setSettings(loadSettings());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return settings;
}
