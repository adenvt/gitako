import { describe, expect, it } from "vitest";
import { buildCommitMessagePrompt, parseCommitMessage } from "./commitMessage";

describe("parseCommitMessage", () => {
  it("splits on the first blank line into subject + description", () => {
    const reply =
      "Fix typo in user list\n\nThe user list filter was\napplying twice. Now it applies once.";
    expect(parseCommitMessage(reply)).toEqual({
      subject: "Fix typo in user list",
      description: "The user list filter was\napplying twice. Now it applies once.",
    });
  });

  it("returns the whole reply as subject when there is no blank line", () => {
    const reply = "Single line subject";
    expect(parseCommitMessage(reply)).toEqual({
      subject: "Single line subject",
      description: "",
    });
  });

  it("trims surrounding whitespace from the model reply", () => {
    const reply = "  \n  subject here  \n\n  body  \n  ";
    expect(parseCommitMessage(reply)).toEqual({
      subject: "subject here",
      description: "body",
    });
  });

  it("handles CRLF line endings", () => {
    const reply = "subject\r\n\r\nbody line";
    expect(parseCommitMessage(reply)).toEqual({
      subject: "subject",
      description: "body line",
    });
  });

  it("treats multiple blank lines as part of the description", () => {
    const reply = "subject\n\nline1\n\nline2";
    expect(parseCommitMessage(reply)).toEqual({
      subject: "subject",
      description: "line1\n\nline2",
    });
  });
});

describe("buildCommitMessagePrompt", () => {
  it("includes a system prompt and the diff in a fenced code block", () => {
    const diff = "diff --git a/x b/x\n+hello\n";
    const [system, user] = buildCommitMessagePrompt(diff);
    expect(system.role).toBe("system");
    expect(user.role).toBe("user");
    expect(user.content).toContain("```diff");
    expect(user.content).toContain("+hello");
  });

  it("truncates very large diffs and marks them as truncated", () => {
    const big = "x".repeat(20_000);
    const [, user] = buildCommitMessagePrompt(big);
    expect(user.content).toContain("... (truncated)");
    // The truncation must respect char boundaries — no broken surrogate.
    expect(user.content.length).toBeLessThan(big.length);
  });

  it("does not truncate diffs under the cap", () => {
    const small = "small diff";
    const [, user] = buildCommitMessagePrompt(small);
    expect(user.content).not.toContain("... (truncated)");
    expect(user.content).toContain(small);
  });
});
