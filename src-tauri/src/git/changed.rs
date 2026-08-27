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
    let mut files = Vec::new();
    for line in stdout.lines() {
        // Skip the commit header; records start after the blank line.
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
        match second {
            Some(new) => files.push(ChangedFile {
                status,
                path: new.to_string(),
                old_path: Some(first.to_string()),
            }),
            None => files.push(ChangedFile {
                status,
                path: first.to_string(),
                old_path: None,
            }),
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
}
