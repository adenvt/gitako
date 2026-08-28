import { createHighlighter, type BundledLanguage, type Highlighter } from "shiki";

/** A single colored token within a line. */
export interface Token {
  text: string;
  color?: string;
}

/** One highlighted line = an array of tokens. */
export type Line = Token[];

const THEME = "github-dark";

/** Map a file extension to a shiki language id; unknown -> plaintext. */
export function langForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const base = path.split("/").pop()?.toLowerCase() ?? "";
  const MAP: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    mjs: "javascript",
    cjs: "javascript",
    rs: "rust",
    py: "python",
    go: "go",
    rb: "ruby",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    hpp: "cpp",
    cs: "csharp",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    htm: "html",
    json: "json",
    md: "markdown",
    markdown: "markdown",
    yml: "yaml",
    yaml: "yaml",
    sh: "shellscript",
    bash: "shellscript",
    zsh: "shellscript",
    sql: "sql",
    toml: "toml",
    xml: "xml",
    vue: "vue",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    kts: "kotlin",
    dart: "dart",
    lua: "lua",
    r: "r",
    zig: "zig",
    dockerfile: "docker",
  };
  if (base === "dockerfile") return "docker";
  return MAP[ext] ?? "plaintext";
}

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({ themes: [THEME], langs: [] });
  }
  return highlighterPromise;
}

const lineCache = new Map<string, Line[]>();

/**
 * Highlight `code` for the given language, returning per-line tokens.
 * Unknown/unsupported languages fall back to plaintext (single token per line).
 */
export async function highlightLines(code: string, lang: string): Promise<Line[]> {
  const cacheKey = `${lang}\n${code}`;
  const cached = lineCache.get(cacheKey);
  if (cached) return cached;

  let result: Line[];
  try {
    const hl = await getHighlighter();
    const loaded = hl.getLoadedLanguages();
    let useLang = lang;
    if (lang !== "plaintext" && !loaded.includes(lang)) {
      try {
        await hl.loadLanguage(lang as BundledLanguage);
      } catch {
        useLang = "plaintext";
      }
    }
    const { tokens } = hl.codeToTokens(code, {
      lang: useLang as BundledLanguage,
      theme: THEME,
    });
    result = tokens.map((lineTokens) =>
      lineTokens.map((t) => ({ text: t.content, color: t.color })),
    );
  } catch {
    // Fall back to plain lines.
    result = code.split("\n").map((l) => [{ text: l }]);
  }

  lineCache.set(cacheKey, result);
  return result;
}
