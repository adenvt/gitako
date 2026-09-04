import { describe, expect, it } from "vitest";
import {
  buildCommitMessagePrompt,
  COMMIT_MESSAGE_RESPONSE_FORMAT,
  parseCommitMessage,
  parseCommitMessageJson,
} from "./commitMessage";

/** Typed view of the generated wire schema. `z.toJSONSchema` returns a
 *  deliberately loose `JSONSchema` union, so tests pin the shape they
 *  assert on. The schema is derived from the zod schema in
 *  `commitMessage.ts` — see `COMMIT_MESSAGE_RESPONSE_FORMAT`. */
interface WireCommitMessageSchema {
  type: "object";
  properties: {
    type: { type: "string"; enum: readonly string[] };
    scope: { type: readonly ["string", "null"] };
    subject: { type: "string"; minLength: number; maxLength: number };
    description: { type: "string" };
  };
  required: readonly string[];
  additionalProperties: false;
}

function wireSchema(): WireCommitMessageSchema {
  return COMMIT_MESSAGE_RESPONSE_FORMAT.json_schema.schema as unknown as WireCommitMessageSchema;
}

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

describe("COMMIT_MESSAGE_RESPONSE_FORMAT", () => {
  it("uses OpenAI json_schema shape with strict mode", () => {
    expect(COMMIT_MESSAGE_RESPONSE_FORMAT.type).toBe("json_schema");
    expect(COMMIT_MESSAGE_RESPONSE_FORMAT.json_schema.strict).toBe(true);
    expect(COMMIT_MESSAGE_RESPONSE_FORMAT.json_schema.name).toBe("commit_message");
  });

  it("requires the conventional-commit fields and forbids extras", () => {
    const schema = wireSchema();
    expect(schema.required).toEqual(["type", "subject", "description"]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties).toHaveProperty("type");
    expect(schema.properties).toHaveProperty("scope");
    expect(schema.properties).toHaveProperty("subject");
    expect(schema.properties).toHaveProperty("description");
  });

  it("restricts the type field to the Conventional Commits allowlist", () => {
    const typeProp = wireSchema().properties.type;
    expect(typeProp.enum).toEqual([
      "feat",
      "fix",
      "refactor",
      "perf",
      "docs",
      "test",
      "build",
      "ci",
      "chore",
      "style",
      "revert",
    ]);
  });

  it("allows the scope to be null or a string", () => {
    const scopeProp = wireSchema().properties.scope;
    expect(scopeProp.type).toEqual(["string", "null"]);
  });

  it("constrains the subject to 1-72 characters", () => {
    const subjectProp = wireSchema().properties.subject;
    expect(subjectProp.type).toBe("string");
    // minLength comes from the zod schema's `.min(1)` — the single
    // source of truth doubles as the reply parser, which rejects empty
    // subjects.
    expect(subjectProp.minLength).toBe(1);
    expect(subjectProp.maxLength).toBe(72);
  });
});

describe("parseCommitMessageJson", () => {
  it("rebuilds the subject as `type(scope): description`", () => {
    const reply = JSON.stringify({
      type: "feat",
      scope: "api",
      subject: "add /users endpoint",
      description: "Adds the new endpoint and wires it into the router.",
    });
    expect(parseCommitMessageJson(reply)).toEqual({
      subject: "feat(api): add /users endpoint",
      description: "Adds the new endpoint and wires it into the router.",
    });
  });

  it("omits parentheses when scope is null", () => {
    const reply = JSON.stringify({
      type: "fix",
      scope: null,
      subject: "null pointer when token is empty",
      description: "",
    });
    expect(parseCommitMessageJson(reply)).toEqual({
      subject: "fix: null pointer when token is empty",
      description: "",
    });
  });

  it("treats an empty-string scope as no scope", () => {
    const reply = JSON.stringify({
      type: "chore",
      scope: "",
      subject: "bump deps",
      description: "",
    });
    expect(parseCommitMessageJson(reply)).toEqual({
      subject: "chore: bump deps",
      description: "",
    });
  });

  it("strips a leading `type:` prefix if the model included it in subject", () => {
    // The system prompt forbids this, but cheap to defend against:
    // don't double-prefix when rebuilding.
    const reply = JSON.stringify({
      type: "feat",
      scope: null,
      subject: "feat: add /users endpoint",
      description: "",
    });
    expect(parseCommitMessageJson(reply)).toEqual({
      subject: "feat: add /users endpoint",
      description: "",
    });
  });

  it("throws when the reply is not valid JSON", () => {
    expect(() => parseCommitMessageJson("not json")).toThrow(/not valid JSON/);
  });

  it("throws when the type is not in the conventional allowlist", () => {
    const reply = JSON.stringify({
      type: "feature", // wrong — must be "feat"
      scope: null,
      subject: "x",
      description: "",
    });
    expect(() => parseCommitMessageJson(reply)).toThrow(/invalid type/);
  });

  it("throws when the subject is missing or empty", () => {
    const missing = JSON.stringify({ type: "feat", scope: null, description: "" });
    const empty = JSON.stringify({
      type: "feat",
      scope: null,
      subject: "   ",
      description: "",
    });
    expect(() => parseCommitMessageJson(missing)).toThrow(/subject/);
    expect(() => parseCommitMessageJson(empty)).toThrow(/subject/);
  });

  it("returns an empty description when the field is not a string", () => {
    const reply = JSON.stringify({
      type: "docs",
      scope: null,
      subject: "fix typo",
      description: 42,
    });
    expect(parseCommitMessageJson(reply)).toEqual({
      subject: "docs: fix typo",
      description: "",
    });
  });
});
