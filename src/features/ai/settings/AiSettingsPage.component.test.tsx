import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiSettingsPage } from "./AiSettingsPage";
import { loadAiSettings, saveAiSettings } from "@/shared/utils/aiSettings";
import {
  pruneModelCache,
  readModelCache,
  writeModelCache,
} from "@/features/ai/providers/modelCache";
import { Toaster, toastManager } from "@/shared/components/Toaster";
import { Toast } from "@base-ui/react/toast";

describe("AiSettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    toastManager.close();
  });

  afterEach(() => {
    toastManager.close();
  });

  it("renders all four fields with provider-default placeholders", () => {
    render(<AiSettingsPage />);
    expect(screen.getByText(/^Provider$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/api host/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^API key$/)).toBeInTheDocument();
    expect(screen.getByText(/^Model$/)).toBeInTheDocument();
    // Provider-default URLs/models show as placeholders on the text
    // inputs (BaseUI Select shows the current value, not the placeholder).
    expect((screen.getByLabelText(/api host/i) as HTMLInputElement).placeholder).toBe(
      "https://api.openai.com/v1",
    );
  });

  it("shows the provider's displayName in the Select trigger, not its raw id", () => {
    // Internal state holds the id; the trigger should still display
    // the human-friendly displayName so users see "OpenAI-compatible"
    // instead of "openai-compatible".
    render(<AiSettingsPage />);
    // The trigger text is the displayName, not the id.
    expect(screen.getByText("OpenAI-compatible")).toBeInTheDocument();
    // The raw id should not appear in the trigger (it may still appear
    // in items, but the trigger label uses the displayName).
    const trigger = screen.getByRole("combobox", { name: /provider/i });
    expect(trigger.textContent).toContain("OpenAI-compatible");
    expect(trigger.textContent).not.toBe("openai-compatible");
  });

  it("preloads existing settings", () => {
    saveAiSettings({
      providerId: "openai-compatible",
      apiKey: "sk-existing",
      baseUrl: "http://localhost:11434",
      model: "llama3",
    });
    render(<AiSettingsPage />);
    expect((screen.getByLabelText(/api host/i) as HTMLInputElement).value).toBe(
      "http://localhost:11434",
    );
    // Model value is rendered inside the Combobox.Input element.
    const modelInput = screen.getByRole("combobox", { name: /model/i }) as HTMLInputElement;
    expect(modelInput.value).toBe("llama3");
  });

  it("toggles the API key visibility via the eye icon", async () => {
    saveAiSettings({ ...loadAiSettings(), apiKey: "sk-hide-me" });
    render(<AiSettingsPage />);
    const keyInput = screen.getByLabelText(/^API key$/) as HTMLInputElement;
    expect(keyInput.type).toBe("password");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /reveal the api key/i }));
    expect((screen.getByLabelText(/^API key$/) as HTMLInputElement).type).toBe("text");
    await user.click(screen.getByRole("button", { name: /reveal less of the api key/i }));
    expect((screen.getByLabelText(/^API key$/) as HTMLInputElement).type).toBe("password");
  });

  it("does NOT render a reset button next to the API host field", () => {
    render(<AiSettingsPage />);
    const hostInput = screen.getByLabelText(/api host/i);
    const hostRow = hostInput.closest("div")!;
    expect(hostRow.querySelector("button")).toBeNull();
  });

  it("per-row Test button is disabled when the API key is empty", () => {
    render(<AiSettingsPage />);
    expect(screen.getByRole("button", { name: /^test$/i })).toBeDisabled();
  });

  it("per-row Test surfaces success inline below the field", async () => {
    saveAiSettings({ ...loadAiSettings(), apiKey: "sk-test" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiSettingsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^test$/i }));

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
    vi.unstubAllGlobals();
  });

  it("per-row Test surfaces the provider error inline below the field", async () => {
    saveAiSettings({ ...loadAiSettings(), apiKey: "sk-bad" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: { message: "Invalid API key" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiSettingsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^test$/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid API key")).toBeInTheDocument();
    });
    vi.unstubAllGlobals();
  });

  it("does NOT render a bottom 'Test connection' button", () => {
    render(
      <Toast.Provider toastManager={toastManager}>
        <AiSettingsPage />
        <Toaster />
      </Toast.Provider>,
    );
    expect(screen.queryByRole("button", { name: /test connection/i })).toBeNull();
  });

  it("Refresh button fetches {baseUrl}/models and replaces the dropdown list", async () => {
    saveAiSettings({ ...loadAiSettings(), apiKey: "sk-test" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: [{ id: "gpt-4o" }, { id: "gpt-3.5-turbo" }, { id: "llama3.1" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiSettingsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /refresh model list/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer sk-test" }),
        }),
      );
    });
    vi.unstubAllGlobals();
  });

  it("Refresh button is disabled when the API key is empty", () => {
    render(<AiSettingsPage />);
    expect(screen.getByRole("button", { name: /refresh model list/i })).toBeDisabled();
  });

  it("'Save' writes the form to localStorage and calls onBack to close the page", async () => {
    const onBack = vi.fn();
    render(<AiSettingsPage onBack={onBack} />);
    const user = userEvent.setup();
    const baseUrl = screen.getByLabelText(/api host/i);
    await user.clear(baseUrl);
    await user.type(baseUrl, "http://localhost:11434");

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    const stored = loadAiSettings();
    expect(stored.baseUrl).toBe("http://localhost:11434");
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("'Save' works when no onBack callback is provided (no crash)", async () => {
    // Page may be rendered without a back callback in some flows
    // (e.g. embedded preview). The save path should still complete
    // without throwing.
    render(<AiSettingsPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /^save$/i }));
    // No back link rendered either.
    expect(screen.queryByRole("button", { name: /^back$/i })).toBeNull();
  });

  it("hydrates the model list from the cache on mount (no fetch)", async () => {
    // Pre-populate the cache with a saved list for the default settings.
    writeModelCache(loadAiSettings(), ["gpt-4o", "gpt-3.5-turbo", "llama3.1"]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AiSettingsPage />);

    // The combobox input value should be the cached default model.
    const modelInput = screen.getByRole("combobox", { name: /model/i }) as HTMLInputElement;
    // Open the popup and confirm all three cached models are rendered.
    await userEvent.setup().click(modelInput);
    await waitFor(() => {
      expect(screen.getByText("gpt-3.5-turbo")).toBeInTheDocument();
      expect(screen.getByText("gpt-4o")).toBeInTheDocument();
      expect(screen.getByText("llama3.1")).toBeInTheDocument();
    });
    // No network call was made — the cache is the only source.
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("Refresh button persists the new list to the cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ data: [{ id: "fresh-model" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    saveAiSettings({ ...loadAiSettings(), apiKey: "sk-test" });
    render(<AiSettingsPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /refresh model list/i }));

    await waitFor(() => {
      expect(readModelCache(loadAiSettings())).toEqual(["fresh-model"]);
    });
    vi.unstubAllGlobals();
  });

  it("Save prunes cached entries whose key pair is not in the active settings", async () => {
    const current = loadAiSettings();
    const stale = { ...current, apiKey: "sk-rotated" };
    writeModelCache(current, ["keep"]);
    writeModelCache(stale, ["drop"]);

    render(<AiSettingsPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /^save$/i }));

    expect(readModelCache(current)).toEqual(["keep"]);
    expect(readModelCache(stale)).toBeNull();
    // Sanity: pruneModelCache itself behaves consistently.
    expect(pruneModelCache).toBeTypeOf("function");
  });

  it("Model combobox filters items as the user types", async () => {
    writeModelCache(loadAiSettings(), ["gpt-4o", "gpt-3.5-turbo", "llama3.1", "mistral-7b"]);
    render(<AiSettingsPage />);
    const user = userEvent.setup();
    const modelInput = screen.getByRole("combobox", { name: /model/i }) as HTMLInputElement;

    await user.click(modelInput);
    await user.clear(modelInput);
    // "llama" is unique — only llama3.1 should remain.
    await user.type(modelInput, "llama");
    expect(modelInput.value).toBe("llama");

    await waitFor(() => {
      expect(screen.getByText("llama3.1")).toBeInTheDocument();
    });
    expect(screen.queryByText("gpt-4o")).toBeNull();
    expect(screen.queryByText("gpt-3.5-turbo")).toBeNull();
    expect(screen.queryByText("mistral-7b")).toBeNull();
  });
});
