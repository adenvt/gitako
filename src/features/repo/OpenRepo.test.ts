import { describe, expect, it, vi } from "vitest";

// Mock the Tauri path API. OpenRepo only uses homeDir() from it.
vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn(),
}));

import { homeDir } from "@tauri-apps/api/path";
import { repoDisplayPath } from "./OpenRepo";

const mockHomeDir = vi.mocked(homeDir);

describe("repoDisplayPath", () => {
  it("returns '~/<rest>' for a path under the home directory", async () => {
    mockHomeDir.mockResolvedValueOnce("/home/user");
    expect(await repoDisplayPath("/home/user/projects/myrepo")).toBe("~/projects/myrepo");
  });

  it("returns '~' (no trailing slash) when the path IS the home directory", async () => {
    // path.slice(home.length) is "" when path === home, so the result is
    // "~" — pin this quirk so a future change is intentional.
    mockHomeDir.mockResolvedValueOnce("/home/user");
    expect(await repoDisplayPath("/home/user")).toBe("~");
  });

  it("returns the original path when it is outside the home directory", async () => {
    mockHomeDir.mockResolvedValueOnce("/home/user");
    expect(await repoDisplayPath("/var/repos/myrepo")).toBe("/var/repos/myrepo");
  });

  it("falls back to the original path when homeDir() throws (plugin unavailable)", async () => {
    // The try/catch in repoDisplayPath is defensive: if the path plugin
    // isn't registered in the Rust backend, we shouldn't crash the picker.
    mockHomeDir.mockRejectedValueOnce(new Error("plugin not found"));
    expect(await repoDisplayPath("/anywhere/repo")).toBe("/anywhere/repo");
  });
});
