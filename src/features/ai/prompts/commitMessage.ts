import { z } from "zod";
import type { AiMessage } from "../providers/types";

/**
 * Hard cap on the diff bytes included in the user prompt. Even though
 * the Tauri command also truncates, re-truncating here keeps the
 * model prompt independently safe (and lets the test exercise the
 * truncation path without a backend).
 */
const MAX_USER_DIFF_CHARS = 12_000;

/**
 * Conventional Commits type allowlist. `revert` is included so the
 * schema can carry a `revert:` subject directly; a `BREAKING CHANGE:`
 * footer convention is intentionally out of scope for this prompt
 * (the model puts the breaking note in `description`).
 */
const CONVENTIONAL_TYPES = [
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
] as const;

const SYSTEM_PROMPT = `You write git commit messages that follow the Conventional Commits specification.

Subject line format: <type>(<optional-scope>): <description>

Rules:
- <type> MUST be one of: feat, fix, refactor, perf, docs, test, build, ci, chore, style, revert.
- <scope> is OPTIONAL. Use a short noun in parentheses when it adds clarity (e.g. "api", "parser", "ui"). Omit when the change is repo-wide.
- <description> is a short summary in the imperative mood ("add", not "added"; "fix", not "fixes"). No trailing period. 72 characters or fewer.
- The <description> must be the colon-separated part after <type>[(<scope>)]. Do NOT include the type or scope in the description value.
- Description body (optional): separated from the subject by a blank line. Wrap at 72 columns. Explain *why*, not *what* — the diff shows the what.
- Output ONLY the structured fields requested. No preamble, no labels, no code fences.`;

/**
 * Single source of truth for the structured commit-message reply. It
 * plays two roles:
 *
 * 1. Parsing — `parseCommitMessageJson` validates the model's reply
 *    against this schema before rebuilding the final subject.
 * 2. JSON Schema — `z.toJSONSchema` derives the `response_format`
 *    schema below from it, so the contract we send the model and the
 *    one we enforce locally can never drift apart.
 *
 * The leniencies are deliberate and mirror real model behavior that
 * the generated JSON Schema cannot express (the schema can only say
 * `description` is a string, not "or tolerate garbage"):
 * - A missing or non-string `description` falls back to `""`.
 * - A non-string `scope` falls back to `null` (no scope). An
 *   empty/whitespace-only string scope is normalized away later, in
 *   `assembleCommitMessage`.
 * - `subject` is trimmed and must be non-empty (≤ 72 chars).
 */
const commitMessageSchema = z.object({
  type: z.enum(CONVENTIONAL_TYPES),
  scope: z.nullable(z.string()).optional().catch(null),
  subject: z.string().trim().min(1).max(72),
  description: z.string().catch(""),
});

type CommitMessageReply = z.infer<typeof commitMessageSchema>;

/**
 * OpenAI Structured Outputs schema for commit messages, derived from
 * `commitMessageSchema` via `z.toJSONSchema`. The result is standard
 * JSON Schema, so any OpenAI-compatible provider that supports
 * `response_format.json_schema` (OpenRouter, Groq, Together, etc.) can
 * use it as-is. Providers that don't support `response_format` will
 * ignore the directive; the caller falls back to text parsing.
 *
 * `z.toJSONSchema` emits two things OpenAI's strict mode rejects, so
 * they are removed here:
 * - `$schema` (a document-level annotation, not part of the schema),
 * - `default`, added for the `.catch()`/missing-key fallbacks above.
 */
const { $schema: _unused, ...COMMIT_MESSAGE_JSON_SCHEMA } = z.toJSONSchema(commitMessageSchema, {
  override: (ctx) => {
    delete (ctx.jsonSchema as { default?: unknown }).default;
  },
});

export const COMMIT_MESSAGE_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "commit_message",
    strict: true,
    schema: COMMIT_MESSAGE_JSON_SCHEMA,
  },
} as const;

/** True if `i` lies on a Unicode code-point boundary in `s`. UTF-16
 *  surrogate halves (a high surrogate at i-1 + low surrogate at i) are
 *  not boundaries. */
function isCharBoundary(s: string, i: number): boolean {
  if (i < 0 || i > s.length) return false;
  if (i === 0 || i === s.length) return true;
  // Code-unit at i-1 should not be a high surrogate (0xD800-0xDBFF),
  // otherwise we'd split a surrogate pair.
  const prev = s.charCodeAt(i - 1);
  return !(prev >= 0xd800 && prev <= 0xdbff);
}

export interface ParsedCommitMessage {
  subject: string;
  description: string;
}

/** Turn a zod rejection into the error thrown by `parseCommitMessageJson`
 *  (whose caller falls back to `parseCommitMessage` on any throw). */
function describeReplyError(error: z.ZodError): Error {
  const issue = error.issues[0];
  const field = String(issue.path[0] ?? "");
  const received = JSON.stringify(issue.input);
  if (field === "type") {
    return new Error(`AI reply has invalid type: ${received}`);
  }
  if (field === "subject") {
    const empty =
      issue.code === "too_small" ||
      issue.input === undefined ||
      (typeof issue.input === "string" && issue.input.trim() === "");
    return new Error(
      empty
        ? "AI reply is missing a non-empty subject."
        : `AI reply has invalid subject: ${received}`,
    );
  }
  return new Error(`AI reply has invalid field ${field}: ${received}`);
}

/** Rebuild the final subject as `type(scope): description` and drop the
 *  raw structured fields. */
function assembleCommitMessage(reply: CommitMessageReply): ParsedCommitMessage {
  // Missing / null / empty / whitespace-only scope all mean "no scope".
  const scope =
    typeof reply.scope === "string" && reply.scope.trim() !== "" ? reply.scope.trim() : null;
  // The schema already trimmed the subject. Some models strip the
  // `type` prefix from `subject`; some include it. Strip a leading
  // `type[(scope)]:` from `subject` if present so we never
  // double-prefix when we rebuild.
  const subjectText = stripConventionalPrefix(reply.subject, reply.type);
  const subject = scope
    ? `${reply.type}(${scope}): ${subjectText}`
    : `${reply.type}: ${subjectText}`;
  return { subject, description: reply.description.trim() };
}

/** Parse a Structured-Outputs reply. Throws on malformed input — the
 *  caller is expected to fall back to `parseCommitMessage` (text). */
export function parseCommitMessageJson(reply: string): ParsedCommitMessage {
  let raw: unknown;
  try {
    raw = JSON.parse(reply);
  } catch {
    throw new Error("AI reply was not valid JSON.");
  }
  const parsed = commitMessageSchema.safeParse(raw);
  if (!parsed.success) {
    throw describeReplyError(parsed.error);
  }
  return assembleCommitMessage(parsed.data);
}

/** If `text` begins with `<type>:` or `<type>(<scope>):`, drop that
 *  prefix. We don't enforce a specific scope match here — the
 *  structured `scope` field is the source of truth for the rebuild;
 *  the prefix-strip is purely cosmetic to avoid `feat: feat: ...`. */
function stripConventionalPrefix(text: string, type: string): string {
  const head = `${type}:`;
  if (text.toLowerCase().startsWith(head.toLowerCase())) {
    return text.slice(head.length).trimStart();
  }
  return text;
}

/** Split the model's reply into (subject, description) on the first
 *  blank line. If no blank line, the whole reply is the subject. */
export function parseCommitMessage(reply: string): ParsedCommitMessage {
  const text = reply.trim();
  // Split on the first blank line (a line that is just whitespace).
  const lines = text.split(/\r?\n/);
  let splitAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      splitAt = i;
      break;
    }
  }
  if (splitAt === -1) {
    return { subject: text.trim(), description: "" };
  }
  const subject = lines.slice(0, splitAt).join("\n").trim();
  const description = lines
    .slice(splitAt + 1)
    .join("\n")
    .trim();
  return { subject, description };
}

/** Build the (system, user) messages for the commit-message prompt.
 *  The user message carries a truncated unified diff of the staged
 *  changes. */
export function buildCommitMessagePrompt(diff: string): AiMessage[] {
  let userDiff = diff;
  if (userDiff.length > MAX_USER_DIFF_CHARS) {
    // Cut to the largest valid char boundary ≤ MAX_USER_DIFF_CHARS.
    let cut = MAX_USER_DIFF_CHARS;
    while (cut > 0 && !isCharBoundary(userDiff, cut)) cut -= 1;
    userDiff = `${userDiff.slice(0, cut)}\n... (truncated)\n`;
  }
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Here is the unified diff of staged changes:\n\n\`\`\`diff\n${userDiff}\n\`\`\`\n\nWrite the commit message.`,
    },
  ];
}
