import { useEffect, useState } from "react";
import { ArrowLeftIcon, EyeClosedIcon, EyeIcon, SyncIcon } from "@primer/octicons-react";
import {
  DEFAULT_AI_SETTINGS,
  loadAiSettings,
  saveAiSettings,
  type AiSettings,
} from "@/shared/utils/aiSettings";
import { getProvider, providerList } from "@/features/ai/providers/registry";
import { fetchOpenAiModels } from "@/features/ai/providers/models";
import {
  pruneModelCache,
  readModelCache,
  writeModelCache,
} from "@/features/ai/providers/modelCache";
import { testAiConnection } from "@/features/ai";
import { Button, Input, Select, Combobox, ScrollArea } from "@/shared/components/ui";
import { errorMessage } from "@/shared/utils/error";
import { toastError, toastSuccess } from "@/shared/components/Toaster";
import { AiError } from "@/features/ai/providers/types";
import s from "./aiSettings.module.css";

type TestStatus =
  | { kind: "idle" }
  | { kind: "ok"; detail?: string }
  | { kind: "err"; detail: string };

/**
 * AI settings page. Lets the user configure provider, base URL, API
 * key, and model. The "Test" button next to the API key runs a tiny
 * chat request with the unsaved form values so users can validate a
 * custom baseUrl (Ollama, etc.) before saving. The "Refresh" button
 * next to Model fetches the live model list from the provider.
 */
export function AiSettingsPage({ onBack }: { onBack?: () => void }) {
  const [form, setForm] = useState<AiSettings>(() => loadAiSettings());
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<TestStatus>({ kind: "idle" });

  const [models, setModels] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modelMissing, setModelMissing] = useState(false);

  const currentProvider = getProvider(form.providerId);
  const apiKeyEmpty = form.apiKey.trim().length === 0;

  useEffect(() => {
    const onStorage = () => setForm(loadAiSettings());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Hydrate the model list from cache on first mount. The Refresh
  // button always bypasses the cache; this just avoids a network
  // round-trip every time the user opens AI settings.
  useEffect(() => {
    const cached = readModelCache(form);
    if (cached) setModels(cached);
    // We intentionally only run this once on mount; the user has to
    // hit Refresh to pick up new models after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof AiSettings>(k: K, v: AiSettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const handleTest = async () => {
    setStatus({ kind: "idle" });
    setTesting(true);
    try {
      await testAiConnection(form);
      setStatus({ kind: "ok", detail: "Connected" });
    } catch (e) {
      setStatus({ kind: "err", detail: errorMessage(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleRefreshModels = async () => {
    if (apiKeyEmpty) return;
    setRefreshing(true);
    setModelMissing(false);
    try {
      const list = await fetchOpenAiModels({
        baseUrl: form.baseUrl.trim() || currentProvider.baseUrl,
        apiKey: form.apiKey,
      });
      setModels(list);
      writeModelCache(form, list);
      if (form.model && !list.includes(form.model)) setModelMissing(true);
    } catch (e) {
      const msg = e instanceof AiError ? e.message : errorMessage(e);
      toastError("Could not fetch models", msg);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = () => {
    saveAiSettings(form);
    // Drop any cached model lists for keys the user has rotated out
    // so the cache doesn't grow forever.
    pruneModelCache([form]);
    toastSuccess("AI settings saved");
    onBack?.();
  };

  return (
    <div className={s.page}>
      {onBack && (
        <button className={s.backLink} onClick={onBack} type="button">
          <ArrowLeftIcon size={12} aria-hidden /> back
        </button>
      )}

      <div className={s.heading}>
        <h2>AI settings</h2>
        <p>
          Configure the provider used to generate commit messages. The OpenAI-compatible option also
          works with Ollama, LM Studio, Groq, and any other OpenAI-shaped endpoint.
        </p>
      </div>

      <div className={s.field}>
        <label className={s.fieldLabel} id="ai-provider-label">
          Provider
        </label>
        <Select.Root
          value={form.providerId}
          items={providerList.map((p) => ({ value: p.id, label: p.displayName }))}
          onValueChange={(value) => {
            if (typeof value !== "string") return;
            const id = value as AiSettings["providerId"];
            const p = getProvider(id);
            setForm({
              ...DEFAULT_AI_SETTINGS,
              providerId: id,
              baseUrl: p.baseUrl,
              model: p.defaultModel,
              apiKey: form.apiKey,
            });
            setModels([]);
            setModelMissing(false);
          }}
        >
          <Select.Trigger aria-labelledby="ai-provider-label">
            <Select.Value placeholder="Choose provider" />
            <Select.Icon>▾</Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner sideOffset={4} alignItemWithTrigger={false}>
              <Select.Popup>
                <ScrollArea.Root style={{ flex: "1 1 auto", minHeight: 0 }}>
                  <ScrollArea.Viewport>
                    <Select.List>
                      {providerList.map((p) => (
                        <Select.Item key={p.id} value={p.id}>
                          <Select.ItemText>{p.displayName}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </ScrollArea.Viewport>
                  <ScrollArea.Scrollbar>
                    <ScrollArea.Thumb />
                  </ScrollArea.Scrollbar>
                </ScrollArea.Root>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>

      <div className={s.field}>
        <label className={s.fieldLabel} htmlFor="ai-baseurl">
          API host (base URL)
        </label>
        <Input
          id="ai-baseurl"
          type="text"
          value={form.baseUrl}
          onChange={(e) => update("baseUrl", e.target.value)}
          placeholder={currentProvider.baseUrl}
        />
      </div>

      <div className={s.field}>
        <label className={s.fieldLabel} htmlFor="ai-apikey">
          API key
        </label>
        <div className={s.fieldRow}>
          <div className={s.inputWrap}>
            <Input
              id="ai-apikey"
              type={showKey ? "text" : "password"}
              value={form.apiKey}
              onChange={(e) => update("apiKey", e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className={s.eyeBtn}
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Reveal less of the API key" : "Reveal the API key"}
              aria-pressed={showKey}
              title={showKey ? "Hide" : "Show"}
            >
              {showKey ? (
                <EyeClosedIcon size={14} aria-hidden />
              ) : (
                <EyeIcon size={14} aria-hidden />
              )}
            </button>
          </div>
          <button
            className={s.sideBtn}
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || apiKeyEmpty}
            title={apiKeyEmpty ? "Set an API key first" : "Test connection"}
          >
            {testing ? "Testing…" : "Test"}
          </button>
        </div>
        <span
          className={
            status.kind === "ok" ? s.statusOk : status.kind === "err" ? s.statusErr : s.statusIdle
          }
        >
          {status.kind === "ok" ? status.detail : status.kind === "err" ? status.detail : ""}
        </span>
      </div>

      <div className={s.field}>
        <label className={s.fieldLabel} id="ai-model-label">
          Model
        </label>
        <div className={s.fieldRow}>
          <Combobox.Root
            value={form.model}
            onValueChange={(value) => {
              if (typeof value !== "string") return;
              update("model", value);
              setModelMissing(false);
            }}
            items={(models.length > 0 ? models : [currentProvider.defaultModel]).map((m) => ({
              value: m,
              label: m,
            }))}
            itemToStringValue={(item) => (item as unknown as { value: string }).value}
          >
            <Combobox.InputGroup>
              <Combobox.Input
                aria-labelledby="ai-model-label"
                placeholder={currentProvider.defaultModel}
              />
              <Combobox.Trigger aria-label="Open model list">
                <Combobox.Icon>▾</Combobox.Icon>
              </Combobox.Trigger>
            </Combobox.InputGroup>
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <ScrollArea.Root style={{ flex: "1 1 auto", minHeight: 0 }}>
                    <ScrollArea.Viewport>
                      <Combobox.Empty>No matches</Combobox.Empty>
                      <Combobox.List>
                        {(item: { value: string; label: string }) => (
                          <Combobox.Item key={item.value} value={item.value}>
                            {item.label}
                          </Combobox.Item>
                        )}
                      </Combobox.List>
                    </ScrollArea.Viewport>
                    <ScrollArea.Scrollbar>
                      <ScrollArea.Thumb />
                    </ScrollArea.Scrollbar>
                  </ScrollArea.Root>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <button
            className={s.refreshBtn}
            type="button"
            onClick={() => void handleRefreshModels()}
            disabled={refreshing || apiKeyEmpty}
            aria-label="Refresh model list"
            title={
              apiKeyEmpty
                ? "Set an API key first"
                : refreshing
                  ? "Refreshing…"
                  : "Refresh from provider"
            }
          >
            <SyncIcon size={14} aria-hidden />
          </button>
        </div>
        {modelMissing && (
          <span className={s.warning}>
            <span>Previously selected model is no longer available.</span>
            <button
              className={s.warningBtn}
              type="button"
              onClick={() => {
                update("model", currentProvider.defaultModel);
                setModelMissing(false);
              }}
            >
              Use default
            </button>
          </span>
        )}
      </div>

      <div className={s.actions}>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </div>

      <p className={s.disclosure}>
        Where is my key stored? It lives in the app's local profile directory (browser-style
        storage). It is never logged, never shown in toasts, and only sent to the API host you
        configured above. Follow-up: OS keychain support.
      </p>
    </div>
  );
}
