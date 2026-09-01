use std::path::PathBuf;

use crate::git;

/// Switch HEAD to a local branch. Resolves the ref to its full hash so the
/// frontend can confirm the switch before the UI updates. Errors from git
/// (e.g. uncommitted changes would be overwritten) bubble up as `GitError`.
#[tauri::command]
pub fn git_checkout(repo_path: String, branch: String) -> Result<String, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    // Resolve the branch to a hash first so an invalid name fails before
    // we mutate HEAD.
    let hash = crate::git::resolve_revision(&repo, &branch)?;
    // Now do the actual checkout.
    git::run_ok(&repo, &["checkout", &branch])?;
    Ok(hash)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::run;
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    // Tests run in parallel; suffix the temp dir with the test name plus a
    // monotonic counter to avoid collisions on shared paths.
    fn tmp_repo() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("gitako-ck-{nanos}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        for args in [
            &["init", "-q", "-b", "main"][..],
            &["config", "user.email", "t@t"][..],
            &["config", "user.name", "t"][..],
            &["commit", "--allow-empty", "-q", "-m", "c1"][..],
            &["branch", "feature"][..],
        ] {
            Command::new("git").args(args).current_dir(&dir).output().unwrap();
        }
        dir
    }

    #[test]
    fn checkout_existing_branch() {
        let dir = tmp_repo();
        let hash = git_checkout(dir.to_string_lossy().into_owned(), "feature".into()).unwrap();
        let head = run(&dir, &["rev-parse", "HEAD"]).unwrap().stdout;
        assert_eq!(head.trim(), hash);
    }

    #[test]
    fn checkout_missing_branch_errors() {
        let dir = tmp_repo();
        assert!(git_checkout(dir.to_string_lossy().into_owned(), "nope".into()).is_err());
    }
}
