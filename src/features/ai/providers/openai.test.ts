import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createOpenAiProvider } from "./openai";
import { AiError } from "./types";

describe("openai-compatible provider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseReq = {
    model: "gpt-test",
    messages: [{ role: "user" as const, content: "ping" }],
    maxTokens: 4,
  };

  it("POSTs to {baseUrl}/chat/completions with bearer auth", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        choices: [{ message: { content: "pong" } }],
      }),
    });
    const provider = createOpenAiProvider({ baseUrl: "https://api.example.com" });
    const res = await provider.chat(baseReq, "sk-test");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        }),
      }),
    );
    expect(res.text).toBe("pong");
  });

  it("uses the user-supplied baseUrl verbatim (no auto /v1)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    // SDK-style: baseUrl already includes /v1.
    const provider = createOpenAiProvider({
      baseUrl: "https://my-proxy.example.com/api/v1",
    });
    await provider.chat(baseReq, "sk-test");
    expect(fetchMock.mock.calls[0][0]).toBe("https://my-proxy.example.com/api/v1/chat/completions");
  });

  it("uses https://api.openai.com/v1 as the default base URL", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    const provider = createOpenAiProvider();
    await provider.chat(baseReq, "sk-test");
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("throws AiError when the API key is empty", async () => {
    const provider = createOpenAiProvider();
    await expect(provider.chat(baseReq, "")).rejects.toBeInstanceOf(AiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws AiError with status on 401 (unauthorized)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: { message: "invalid api key" } }),
    });
    const provider = createOpenAiProvider();
    await expect(provider.chat(baseReq, "sk-test")).rejects.toMatchObject({
      name: "AiError",
      status: 401,
      message: "invalid api key",
    });
  });

  it("throws AiError on 500 with status text fallback", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    });
    const provider = createOpenAiProvider();
    await expect(provider.chat(baseReq, "sk-test")).rejects.toMatchObject({
      status: 500,
    });
  });

  it("wraps network errors as AiError", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const provider = createOpenAiProvider();
    await expect(provider.chat(baseReq, "sk-test")).rejects.toMatchObject({
      name: "AiError",
      message: expect.stringContaining("Network error"),
    });
  });

  it("trims the response text", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ choices: [{ message: { content: "  hello  \n" } }] }),
    });
    const provider = createOpenAiProvider();
    const res = await provider.chat(baseReq, "sk-test");
    expect(res.text).toBe("hello");
  });

  it("forwards AbortSignal to fetch and the request rejects when aborted", async () => {
    // The Cancel button on a long-running AI request aborts the signal;
    // fetch rejects with an AbortError DOMException that we want to
    // bubble out of `chat()` so the caller can detect the cancel.
    const controller = new AbortController();
    const abortError = new DOMException("aborted", "AbortError");
    fetchMock.mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(abortError);
    });
    const provider = createOpenAiProvider();
    await expect(provider.chat({ ...baseReq, signal: controller.signal }, "sk-test")).rejects.toBe(
      abortError,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("does not wrap an aborted fetch in an AiError (preserves signal.aborted detection)", async () => {
    // The provider must NOT swallow the abort into a generic
    // "Network error: aborted" AiError — the composer relies on
    // `signal.aborted` to know the failure was user-initiated.
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException("aborted", "AbortError");
    fetchMock.mockRejectedValueOnce(abortError);
    const provider = createOpenAiProvider();
    try {
      await provider.chat({ ...baseReq, signal: controller.signal }, "sk-test");
      throw new Error("expected chat() to reject");
    } catch (e) {
      expect(e).toBe(abortError);
      expect(e instanceof Error && e.name).toBe("AbortError");
    }
  });
});
