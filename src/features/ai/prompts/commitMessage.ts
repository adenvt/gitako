import type { AiMessage } from "../providers/types";

/**
 * Hard cap on the diff bytes included in the user prompt. Even though
 * the Tauri command also truncates, re-truncating here keeps the
 * model prompt independently safe (and lets the test exercise the
 * truncation path without a backend).
 */
const MAX_USER_DIFF_CHARS = 12_000;

const SYSTEM_PROMPT = `You write git commit messages. Output only the commit message — a short subject line (72 chars or fewer, imperative mood, no trailing period) followed by a blank line and an optional longer description. No preamble, no code fences, no labels, no commentary.`;

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
