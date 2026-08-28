use serde::Serialize;

/// A single file changed by a commit, as reported by `git show --name-status`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    /// Status letter: A/M/D/R/C/T/U/X/B plus optional score for R/C.
    pub status: String,
    /// Path relative to the repo root.
    pub path: String,
    /// For renames/copies: the original path.
    pub old_path: Option<String>,
}

/// Parse `git show --name-status` output into changed files.
///
/// Expected format (records are newline-separated):
///
/// ```text
/// <status>\t<path>
/// R100\t<old>\t<new>
/// ```
///
/// Anything before the first blank line (the commit header) is ignored, as are
/// lines without a status letter.
pub fn parse_show(stdout: &str) -> Vec<ChangedFile> {
    let mut files: Vec<ChangedFile> = Vec::new();
    // With `git show -m`, the same path can appear more than once (one record
    // per parent that changed it). Keep the first occurrence so the file is
    // listed once in the UI, matching what the user would see with a non-merge
    // commit. New paths still appear (first occurrence is appended in order).
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for line in stdout.lines() {
        // Skip the commit header; records start after the blank line.
        // With `-m`, also skip the "merge parent N" header lines.
        if !line.contains('\t') {
            continue;
        }
        let mut parts = line.splitn(3, '\t');
        let status = parts.next().unwrap_or("").to_string();
        let first = parts.next().unwrap_or("");
        let second = parts.next();
        if status.is_empty() || first.is_empty() {
            continue;
        }
        // Renames/copies have two paths; treat the first as old, second as new.
        let file = match second {
            Some(new) => ChangedFile {
                status,
                path: new.to_string(),
                old_path: Some(first.to_string()),
            },
            None => ChangedFile {
                status,
                path: first.to_string(),
                old_path: None,
            },
        };
        if seen.insert(file.path.clone()) {
            files.push(file);
        }
    }
    files
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_show() -> &'static str {
        "commit abc123\nAuthor: Ada <ada@x.dev>\n\n    Fix things\n\nM\tREADME.md\nA\tsrc/new.rs\nR100\told.rs\trenamed.rs\n"
    }

    #[test]
    fn parses_modified_added_and_renamed() {
        let files = parse_show(sample_show());
        assert_eq!(files.len(), 3);

        assert_eq!(files[0].status, "M");
        assert_eq!(files[0].path, "README.md");
        assert_eq!(files[0].old_path, None);

        assert_eq!(files[1].status, "A");
        assert_eq!(files[1].path, "src/new.rs");

        assert_eq!(files[2].status, "R100");
        assert_eq!(files[2].path, "renamed.rs");
        assert_eq!(files[2].old_path.as_deref(), Some("old.rs"));
    }

    #[test]
    fn ignores_header_lines() {
        assert!(parse_show("commit deadbeef\n\n").is_empty());
        assert!(parse_show("").is_empty());
    }

    #[test]
    fn dedupes_repeated_paths_from_m_flag() {
        // `git show -m` repeats a path once per parent that changed it. The
        // first occurrence wins so the file is listed once.
        let out = "merge parent 1\n\nM\tsrc/x.ts\n\nmerge parent 2\n\nM\tsrc/x.ts\nA\tsrc/y.ts\n";
        let files = parse_show(out);
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].path, "src/x.ts");
        assert_eq!(files[0].status, "M");
        assert_eq!(files[1].path, "src/y.ts");
        assert_eq!(files[1].status, "A");
    }
}
