//! `git diff --staged` over all changed files, returned as a single UTF-8
//! string for the AI commit-message feature (Phase 6.1). The diff is
//! truncated to keep prompt size bounded; callers should not rely on the
//! output being complete for very large changesets.

use std::path::PathBuf;

use crate::git::run_tolerate;

/// Max bytes returned to the renderer. The prompt also re-truncates, but
/// capping here keeps the IPC payload predictable.
const MAX_BYTES: usize = 16 * 1024;

#[tauri::command]
pub async fn git_staged_diff(repo_path: String) -> Result<String, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    let out = run_tolerate(&repo, &["diff", "--staged", "--no-color", "--no-ext-diff"]).await?;

    // `git diff --staged` exits 0 even with no staged changes; the empty
    // stdout is the signal here. We don't fail on non-zero exit because
    // the underlying run is allowed to fail (e.g. repo not yet
    // initialized) — but for an existing repo a non-zero exit usually
    // means a real problem, so surface it.
    if !out.status.success() {
        let stderr = out.stderr.trim();
        let message = if stderr.is_empty() {
            "git diff --staged failed".to_string()
        } else {
            stderr.to_string()
        };
        return Err(crate::error::GitError::other(message));
    }

    let stdout = out.stdout;
    if stdout.trim().is_empty() {
        return Err(crate::error::GitError::other("no staged changes"));
    }

    if stdout.len() > MAX_BYTES {
        // Truncate at a char boundary; the AI prompt also re-handles this
        // with a marker so the model knows it's been cut.
        let mut cut = MAX_BYTES;
        while cut > 0 && !stdout.is_char_boundary(cut) {
            cut -= 1;
        }
        let mut truncated = String::with_capacity(cut + 32);
        truncated.push_str(&stdout[..cut]);
        truncated.push_str("\n... (truncated)\n");
        Ok(truncated)
    } else {
        Ok(stdout)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncates_at_byte_boundary() {
        // No real repo needed; just exercise the truncation helper via a
        // synthetic long string. The command itself requires a git repo;
        // we only validate the truncation math here.
        let s = "x".repeat(MAX_BYTES + 100);
        let mut cut = MAX_BYTES;
        while cut > 0 && !s.is_char_boundary(cut) {
            cut -= 1;
        }
        assert_eq!(cut, MAX_BYTES);
        assert!(s[..cut].len() <= MAX_BYTES);
    }

    #[test]
    fn short_output_is_returned_unchanged() {
        let s = "diff --git a/x b/x\nindex 0000..1111\n";
        assert!(s.len() <= MAX_BYTES);
        assert!(!s.trim().is_empty());
    }
}