import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchOpenAiModels } from "./models";
import { AiError } from "./types";

describe("fetchOpenAiModels", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws AiError when api key is empty (no network call)", async () => {
    await expect(
      fetchOpenAiModels({ baseUrl: "https://api.openai.com", apiKey: "" }),
    ).rejects.toBeInstanceOf(AiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GETs {baseUrl}/models with bearer auth and returns sorted unique ids", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: [
          { id: "gpt-4o" },
          { id: "gpt-3.5-turbo" },
          { id: "gpt-4o" }, // duplicate
          { id: "  " }, // blank, ignored
          { id: "llama3.1" },
        ],
      }),
    });
    const res = await fetchOpenAiModels({
      baseUrl: "https://api.openai.com",
      apiKey: "sk-test",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer sk-test" }),
      }),
    );
    expect(res).toEqual(["gpt-3.5-turbo", "gpt-4o", "llama3.1"]);
  });

  it("uses the user-supplied baseUrl verbatim (no auto /v1)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ data: [{ id: "m1" }] }),
    });
    // SDK-style: baseUrl already includes /v1.
    await fetchOpenAiModels({
      baseUrl: "https://my-proxy.example.com/api/v1",
      apiKey: "sk",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://my-proxy.example.com/api/v1/models");
  });

  it("throws AiError on 401, surfacing the provider message", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: { message: "bad key" } }),
    });
    await expect(
      fetchOpenAiModels({ baseUrl: "https://api.openai.com", apiKey: "sk" }),
    ).rejects.toMatchObject({ name: "AiError", status: 401, message: "bad key" });
  });

  it("wraps network errors as AiError", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(
      fetchOpenAiModels({ baseUrl: "https://api.openai.com", apiKey: "sk" }),
    ).rejects.toMatchObject({ name: "AiError", message: expect.stringContaining("Network error") });
  });

  it("returns an empty array when the provider returns no data", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ data: [] }),
    });
    const res = await fetchOpenAiModels({ baseUrl: "https://api.openai.com", apiKey: "sk" });
    expect(res).toEqual([]);
  });
});
