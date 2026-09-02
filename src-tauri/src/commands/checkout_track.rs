use std::path::PathBuf;

use crate::git;

/// `git checkout --track <remote>/<name>` for a remote-tracking branch.
/// Creates a local branch at the same name, set up to track the given
/// upstream. Used when the user double-clicks an `origin/feature` badge.
///
/// Returns the new local branch name. Errors from git (e.g. dirty worktree
/// would be overwritten, or the branch already exists locally) bubble up
/// as `GitError`.
#[tauri::command]
pub fn git_checkout_track(
    repo_path: String,
    remote_branch: String,
) -> Result<String, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    // Strip any refs/<remote>/<name> prefix so we always hand a clean
    // "origin/feature" to git.
    let cleaned = remote_branch
        .strip_prefix("refs/remotes/")
        .or_else(|| remote_branch.strip_prefix("refs/heads/"))
        .unwrap_or(&remote_branch)
        .to_string();
    // --track wants the form "origin/feature". git itself accepts both
    // "origin/feature" and refs/heads/feature; we use the short form.
    git::run_ok(&repo, &["checkout", "--track", &cleaned])?;
    // Return the local branch name (== the rightmost segment of the input).
    let local = cleaned.rsplit('/').next().unwrap_or(&cleaned).to_string();
    Ok(local)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    // Tests run in parallel; suffix the temp dir with a monotonic counter
    // to avoid collisions on shared paths.
    fn tmp_repo_with_origin() -> (PathBuf, String) {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("gitako-track-{nanos}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        // Set up: local main + remote "origin" with its own main, plus a
        // divergent feature branch on origin that doesn't exist locally.
        for args in [
            &["init", "-q", "-b", "main"][..],
            &["config", "user.email", "t@t"][..],
            &["config", "user.name", "t"][..],
            &["commit", "--allow-empty", "-q", "-m", "c1"][..],
        ] {
            Command::new("git").args(args).current_dir(&dir).output().unwrap();
        }
        // Add a fake origin so we can push to it. We pass the path as
        // a git CLI argument (not the cwd) because running `init --bare`
        // inside a bare repo dir is a chicken-and-egg.
        let bare = std::env::temp_dir().join(format!("gitako-track-bare-{nanos}"));
        let _ = std::fs::remove_dir_all(&bare);
        Command::new("git")
            .args(["init", "--bare", "-q", bare.to_str().unwrap()])
            .output()
            .unwrap();
        Command::new("git")
            .args(["remote", "add", "origin", bare.to_str().unwrap()])
            .current_dir(&dir)
            .output()
            .unwrap();
        Command::new("git")
            .args(["push", "-q", "origin", "main"])
            .current_dir(&dir)
            .output()
            .unwrap();
        // Create a feature branch on origin only.
        Command::new("git")
            .args(["commit", "--allow-empty", "-q", "-m", "c2"])
            .current_dir(&dir)
            .output()
            .unwrap();
        Command::new("git")
            .args(["checkout", "-q", "-b", "feature"])
            .current_dir(&dir)
            .output()
            .unwrap();
        Command::new("git")
            .args(["push", "-q", "origin", "feature"])
            .current_dir(&dir)
            .output()
            .unwrap();
        // Switch back to main and delete the local feature branch so the
        // remote is the only place it lives.
        Command::new("git")
            .args(["checkout", "-q", "main"])
            .current_dir(&dir)
            .output()
            .unwrap();
        Command::new("git")
            .args(["branch", "-D", "feature"])
            .current_dir(&dir)
            .output()
            .unwrap();
        // Fetch so refs/remotes/origin/feature exists locally.
        Command::new("git")
            .args(["fetch", "-q", "origin"])
            .current_dir(&dir)
            .output()
            .unwrap();
        (dir, bare.to_string_lossy().into_owned())
    }

    #[test]
    fn checkout_track_creates_local_branch_from_remote() {
        let (dir, _bare) = tmp_repo_with_origin();
        let local = git_checkout_track(
            dir.to_string_lossy().into_owned(),
            "origin/feature".into(),
        )
        .unwrap();
        assert_eq!(local, "feature");
        // The new local branch should track origin/feature.
        let out = Command::new("git")
            .args(["config", "--get", "branch.feature.remote"])
            .current_dir(&dir)
            .output()
            .unwrap();
        assert_eq!(String::from_utf8_lossy(&out.stdout).trim(), "origin");
    }

    #[test]
    fn checkout_track_strips_refs_prefix() {
        let (dir, _bare) = tmp_repo_with_origin();
        let local = git_checkout_track(
            dir.to_string_lossy().into_owned(),
            "refs/remotes/origin/feature".into(),
        )
        .unwrap();
        assert_eq!(local, "feature");
    }

    #[test]
    fn checkout_track_existing_local_branch_errors() {
        let (dir, _bare) = tmp_repo_with_origin();
        // origin/main already exists locally; checking it out via --track
        // would mean a force-reset. We use --track with a name that DOES
        // exist locally, so git errors with "already exists".
        let res = git_checkout_track(
            dir.to_string_lossy().into_owned(),
            "origin/main".into(),
        );
        assert!(res.is_err());
    }
}
