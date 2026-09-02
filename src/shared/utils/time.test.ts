import { describe, expect, it } from "vitest";
import { formatDate, timeAgo } from "./time";

describe("timeAgo", () => {
  const nowSec = Date.now() / 1000;

  it("returns 'just now' for anything within the last 60 seconds", () => {
    expect(timeAgo(nowSec)).toBe("just now");
    expect(timeAgo(nowSec - 30)).toBe("just now");
    expect(timeAgo(nowSec - 59)).toBe("just now");
  });

  it("formats minutes for events under an hour old", () => {
    expect(timeAgo(nowSec - 60)).toBe("1m");
    expect(timeAgo(nowSec - 60 * 5)).toBe("5m");
    expect(timeAgo(nowSec - 60 * 59)).toBe("59m");
  });

  it("formats hours for events under a day old", () => {
    expect(timeAgo(nowSec - 3600)).toBe("1h");
    expect(timeAgo(nowSec - 3600 * 23)).toBe("23h");
  });

  it("formats days for events under a month old", () => {
    expect(timeAgo(nowSec - 86400)).toBe("1d");
    expect(timeAgo(nowSec - 86400 * 29)).toBe("29d");
  });

  it("formats months for events older than a month", () => {
    expect(timeAgo(nowSec - 86400 * 30)).toBe("1mo");
    expect(timeAgo(nowSec - 86400 * 365)).toBe("12mo");
  });
});

describe("formatDate", () => {
  it("produces a non-empty string", () => {
    const out = formatDate(1700000000);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same input (no Date.now() leak)", () => {
    expect(formatDate(1700000000)).toBe(formatDate(1700000000));
  });

  it("produces different output for different timestamps", () => {
    expect(formatDate(1700000000)).not.toBe(formatDate(1700000001));
  });
});
