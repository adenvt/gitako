use serde::Serialize;

/// One line inside a diff hunk.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    /// "context" | "add" | "remove"
    pub kind: String,
    pub text: String,
}

/// A single hunk from a unified diff.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

/// A complete diff of one file: full old/new contents plus parsed hunks.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffFile {
    pub old_path: String,
    pub new_path: String,
    pub status: String,
    pub binary: bool,
    pub too_large: bool,
    pub old_lines: Vec<String>,
    pub new_lines: Vec<String>,
    pub hunks: Vec<DiffHunk>,
}

/// Parse the body of a unified diff (everything after the `---`/`+++` headers,
/// or the whole output when `--no-prefix`-style headers are absent).
///
/// Lines:
/// - `@@ -a,b +c,d @@` → hunk header (b/d may be omitted when 1)
/// - ` ` prefix → context line
/// - `+` prefix → added line
/// - `-` prefix → removed line
/// - `\ No newline at end of file` → attached to the previous line as-is
pub fn parse_hunks(diff_body: &str) -> Vec<DiffHunk> {
    let mut hunks = Vec::new();
    let mut current: Option<DiffHunk> = None;

    for line in diff_body.lines() {
        if let Some(header) = line.strip_prefix("@@ ") {
            if let Some(parsed) = parse_hunk_header(header) {
                if let Some(h) = current.take() {
                    hunks.push(h);
                }
                current = Some(parsed);
                continue;
            }
        }

        let hunk = match &mut current {
            Some(h) => h,
            None => continue,
        };

        let (kind, text) = if let Some(t) = line.strip_prefix('+') {
            ("add", t.to_string())
        } else if let Some(t) = line.strip_prefix('-') {
            ("remove", t.to_string())
        } else if let Some(t) = line.strip_prefix(' ') {
            ("context", t.to_string())
        } else if line.starts_with("\\ No newline") {
            // Marker for the previous line — not content, skip it.
            continue;
        } else {
            continue;
        };

        // Only count add/remove/context toward the hunk's declared line counts.
        hunk.lines.push(DiffLine {
            kind: kind.to_string(),
            text,
        });
    }

    if let Some(h) = current.take() {
        hunks.push(h);
    }
    hunks
}

/// Parse `-a,b +c,d` (without the leading `@@ `) into a hunk header.
fn parse_hunk_header(rest: &str) -> Option<DiffHunk> {
    let rest = rest.trim_end();
    let mut parts = rest.splitn(3, ' ');
    let old = parts.next()?; // "-a,b"
    let new = parts.next()?; // "+c,d"
    let (old_start, old_lines) = parse_range(old)?;
    let (new_start, new_lines) = parse_range(new)?;
    Some(DiffHunk {
        old_start,
        old_lines,
        new_start,
        new_lines,
        lines: Vec::new(),
    })
}

/// Parse a range like `-12,6` or `+12` (count defaults to 1).
fn parse_range(s: &str) -> Option<(u32, u32)> {
    let s = &s[1..]; // strip +/- sign
    match s.split_once(',') {
        Some((start, count)) => Some((start.parse().ok()?, count.parse().ok()?)),
        None => Some((s.parse().ok()?, 1)),
    }
}

/// Split file content into lines, preserving empty lines. A trailing newline
/// does not produce an extra empty line.
pub fn split_lines(content: &str) -> Vec<String> {
    if content.is_empty() {
        return Vec::new();
    }
    let mut lines: Vec<String> = content.split('\n').map(|s| s.to_string()).collect();
    // Trailing newline → last element is empty and should be dropped.
    if content.ends_with('\n') {
        lines.pop();
    }
    lines
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_hunk_with_context_add_remove() {
        let body = "@@ -1,3 +1,4 @@\n a\n-b\n+c\n d\n";
        let hunks = parse_hunks(body);
        assert_eq!(hunks.len(), 1);
        let h = &hunks[0];
        assert_eq!(h.old_start, 1);
        assert_eq!(h.old_lines, 3);
        assert_eq!(h.new_start, 1);
        assert_eq!(h.new_lines, 4);
        assert_eq!(h.lines.len(), 4);
        assert_eq!(h.lines[0].kind, "context");
        assert_eq!(h.lines[1].kind, "remove");
        assert_eq!(h.lines[2].kind, "add");
        assert_eq!(h.lines[3].kind, "context");
    }

    #[test]
    fn parses_multiple_hunks_and_single_counts() {
        let body = "@@ -1 +1 @@\n x\n@@ -5,2 +6,3 @@\n y\n-z\n+w\n";
        let hunks = parse_hunks(body);
        assert_eq!(hunks.len(), 2);
        assert_eq!(hunks[0].old_lines, 1);
        assert_eq!(hunks[0].new_lines, 1);
        assert_eq!(hunks[1].old_start, 5);
        assert_eq!(hunks[1].new_start, 6);
    }

    #[test]
    fn ignores_header_lines_and_no_newline_marker() {
        let body = "diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n";
        let hunks = parse_hunks(body);
        assert_eq!(hunks.len(), 1);
        assert_eq!(hunks[0].lines.len(), 2);
        assert_eq!(hunks[0].lines[0].text, "a");
        assert_eq!(hunks[0].lines[1].kind, "remove");
    }

    #[test]
    fn empty_input_yields_no_hunks() {
        assert!(parse_hunks("").is_empty());
    }

    #[test]
    fn splits_lines_without_trailing_extra() {
        assert_eq!(split_lines("a\nb\n"), vec!["a", "b"]);
        assert_eq!(split_lines(""), Vec::<String>::new());
        assert_eq!(split_lines("a\n\nb"), vec!["a", "", "b"]);
    }
}
