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
 * OpenAI Structured Outputs schema for commit messages. The schema is
 * standard JSON Schema so any OpenAI-compatible provider that supports
 * `response_format.json_schema` (OpenRouter, Groq, Together, etc.) can
 * use it as-is. Providers that don't support `response_format` will
 * ignore the directive; the caller falls back to text parsing.
 */
export const COMMIT_MESSAGE_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "commit_message",
    strict: true,
    schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...CONVENTIONAL_TYPES] },
        scope: { type: ["string", "null"] },
        subject: { type: "string", maxLength: 72 },
        description: { type: "string" },
      },
      required: ["type", "subject", "description"],
      additionalProperties: false,
    },
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

interface RawCommitMessageJson {
  type?: unknown;
  scope?: unknown;
  subject?: unknown;
  description?: unknown;
}

function isConventionalType(value: unknown): value is (typeof CONVENTIONAL_TYPES)[number] {
  return typeof value === "string" && (CONVENTIONAL_TYPES as readonly string[]).includes(value);
}

/** Parse a Structured-Outputs reply. Throws on malformed input — the
 *  caller is expected to fall back to `parseCommitMessage` (text). */
export function parseCommitMessageJson(reply: string): ParsedCommitMessage {
  let raw: RawCommitMessageJson;
  try {
    raw = JSON.parse(reply) as RawCommitMessageJson;
  } catch {
    throw new Error("AI reply was not valid JSON.");
  }
  if (!isConventionalType(raw.type)) {
    throw new Error(`AI reply has invalid type: ${String(raw.type)}`);
  }
  if (typeof raw.subject !== "string" || raw.subject.trim() === "") {
    throw new Error("AI reply is missing a non-empty subject.");
  }
  // Some models strip the `type` prefix from `subject`; some include
  // it. Strip a leading `type[(scope)]:` from `subject` if present so
  // we never double-prefix when we rebuild.
  const subjectRaw = raw.subject.trim();
  const subjectText = stripConventionalPrefix(subjectRaw, raw.type);
  const scope = typeof raw.scope === "string" && raw.scope.trim() !== "" ? raw.scope.trim() : null;
  const subject = scope ? `${raw.type}(${scope}): ${subjectText}` : `${raw.type}: ${subjectText}`;
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  return { subject, description };
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