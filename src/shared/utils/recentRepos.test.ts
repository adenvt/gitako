import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addRecentRepo,
  loadRecentRepos,
  removeRecentRepo,
  type RecentRepo,
} from "./recentRepos";

const STORAGE_KEY = "gitako.recentRepos";

function getStorage(): RecentRepo[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as RecentRepo[]) : null;
}

function setStorage(repos: RecentRepo[] | null): void {
  if (repos === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("loadRecentRepos", () => {
  it("returns an empty array when nothing is stored", () => {
    expect(loadRecentRepos()).toEqual([]);
  });

  it("returns an empty array when the stored JSON is not an array", () => {
    setStorage({ foo: "bar" } as unknown as RecentRepo[]);
    expect(loadRecentRepos()).toEqual([]);
  });

  it("filters out entries without a string path", () => {
    setStorage([
      { path: "/ok", name: "ok", lastOpened: 1 },
      { path: 42, name: "bad", lastOpened: 1 },
      null,
    ] as unknown as RecentRepo[]);
    const out = loadRecentRepos();
    expect(out).toHaveLength(1);
    expect(out[0]?.path).toBe("/ok");
  });

  it("returns an empty array when the stored value is malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json{");
    expect(loadRecentRepos()).toEqual([]);
  });
});

describe("addRecentRepo", () => {
  it("stores a new repo with the basename as the name", () => {
    addRecentRepo("/home/user/projects/myrepo");
    const out = getStorage();
    expect(out).toHaveLength(1);
    expect(out?.[0]).toMatchObject({ path: "/home/user/projects/myrepo", name: "myrepo" });
    expect(typeof out?.[0]?.lastOpened).toBe("number");
  });

  it("moves an existing repo to the front (dedup by path)", () => {
    addRecentRepo("/a");
    addRecentRepo("/b");
    addRecentRepo("/a");
    const out = getStorage()!;
    expect(out.map((r) => r.path)).toEqual(["/a", "/b"]);
  });

  it("truncates to the most recent 20 entries", () => {
    for (let i = 0; i < 25; i++) addRecentRepo(`/p${i}`);
    expect(getStorage()).toHaveLength(20);
    expect(getStorage()![0]?.path).toBe("/p24");
  });

  it("falls back to the full path when there is no basename", () => {
    addRecentRepo("/");
    expect(getStorage()?.[0]?.name).toBe("/");
  });
});

describe("removeRecentRepo", () => {
  it("removes the entry with the given path", () => {
    addRecentRepo("/a");
    addRecentRepo("/b");
    removeRecentRepo("/a");
    const out = getStorage()!;
    expect(out.map((r) => r.path)).toEqual(["/b"]);
  });

  it("is a no-op when the path is not present", () => {
    addRecentRepo("/a");
    removeRecentRepo("/missing");
    expect(getStorage()).toHaveLength(1);
  });
});
