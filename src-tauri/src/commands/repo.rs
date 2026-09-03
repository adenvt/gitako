use crate::git;

/// Resolve a revision to its full hash. Empty string means HEAD.
#[tauri::command]
pub async fn git_rev_parse(repo_path: String, rev: String) -> Result<String, crate::error::GitError> {
    let repo = std::path::PathBuf::from(&repo_path);
    git::resolve_revision(&repo, &rev).await
}

/// Get the top-level directory of the repo containing a path.
#[tauri::command]
pub async fn git_repo_root(path: String) -> Result<String, crate::error::GitError> {
    let root = git::repo_root(std::path::Path::new(&path)).await?;
    Ok(root.to_string_lossy().into_owned())
}

/// Return the local branch name HEAD is currently on, or a short hash for
/// detached HEAD. We use `symbolic-ref --short` first because it returns
/// just the branch name and errors out cleanly for detached HEAD; the
/// fallback then resolves HEAD to a 7-char hash.
#[tauri::command]
pub async fn git_head_branch(repo_path: String) -> Result<String, crate::error::GitError> {
    let repo = std::path::PathBuf::from(&repo_path);
    if let Ok(out) = git::run_ok(&repo, &["symbolic-ref", "--short", "HEAD"]).await {
        let name = out.stdout.trim().to_string();
        if !name.is_empty() {
            return Ok(name);
        }
    }
    // Detached HEAD — return a short hash so the UI can show something
    // distinguishable from "no repo" or a hard error.
    let hash = git::resolve_revision(&repo, "HEAD").await?;
    Ok(hash[..7.min(hash.len())].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::run;
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    // Tests run in parallel; suffix the temp dir with the test name plus a
    // monotonic counter to avoid collisions on shared paths.
    fn tmp_repo() -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("gitako-rp-{nanos}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        for args in [
            &["init", "-q", "-b", "main"][..],
            &["config", "user.email", "t@t"][..],
            &["config", "user.name", "t"][..],
            &["commit", "--allow-empty", "-q", "-m", "c1"][..],
            &["commit", "--allow-empty", "-q", "-m", "c2"][..],
            &["branch", "feature"][..],
        ] {
            Command::new("git").args(args).current_dir(&dir).output().unwrap();
        }
        dir
    }

    #[tokio::test]
    async fn head_branch_returns_local_branch_name() {
        let dir = tmp_repo();
        // HEAD starts on `main` (the init branch).
        let name = git_head_branch(dir.to_string_lossy().into_owned()).await.unwrap();
        assert_eq!(name, "main");

        // Switch to a different branch — must reflect the new HEAD.
        Command::new("git")
            .args(["checkout", "-q", "feature"])
            .current_dir(&dir)
            .output()
            .unwrap();
        let name = git_head_branch(dir.to_string_lossy().into_owned()).await.unwrap();
        assert_eq!(name, "feature");
    }

    #[tokio::test]
    async fn head_branch_returns_short_hash_for_detached_head() {
        let dir = tmp_repo();
        // Detach HEAD onto a specific commit (the tip of `main`).
        let tip = run(&dir, &["rev-parse", "HEAD"]).await.unwrap().stdout;
        Command::new("git")
            .args(["checkout", "-q", "--detach", tip.trim()])
            .current_dir(&dir)
            .output()
            .unwrap();

        let result = git_head_branch(dir.to_string_lossy().into_owned()).await.unwrap();
        // Should be the 7-char prefix of HEAD's hash, NOT the literal "HEAD".
        assert_ne!(result, "HEAD");
        assert_eq!(result.len(), 7);
        assert!(tip.trim().starts_with(&result));
    }
}
