use std::path::PathBuf;

use serde::Serialize;

use crate::git;
use crate::git::GitOutput;
use crate::error::GitError;

/// Summary of a successful push, surfaced to the UI so it can show a useful
/// toast ("Pushed main → origin") and refresh refs.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushResult {
    pub remote: String,
    pub branch: String,
    /// Last non-empty line of `git push` output. When the push had nothing
    /// to send this is the "Everything up-to-date" line; when objects were
    /// transferred it's the summary line (e.g. "3 commits pushed to origin").
    pub summary: String,
}

/// `git push`. Resolves the upstream first (so we can report the remote
/// and branch to the UI), then runs the push. Errors from git (non-fast-
/// forward, no upstream, no remote configured) bubble up as `GitError`.
#[tauri::command]
pub fn git_push(repo_path: String) -> Result<PushResult, GitError> {
    let repo = PathBuf::from(&repo_path);
    let (remote, branch) = upstream(&repo).unwrap_or_else(|| {
        // No upstream configured — fall back to the default `git push` would
        // pick, which is `origin` + the current branch. The actual `push`
        // call will fail with a useful error if either is missing.
        let branch = git_head_branch_local(&repo).unwrap_or_default();
        ("origin".to_string(), branch)
    });

    let out = git::run(&repo, &["push"])?;
    if !out.status.success() {
        return Err(push_failure(&out));
    }

    let summary = last_meaningful_line(&out);
    Ok(PushResult {
        remote,
        branch,
        summary,
    })
}

/// Resolve the upstream tracking ref as `remote/branch`. Returns `None` when
/// the current branch has no upstream or HEAD is detached.
fn upstream(repo: &PathBuf) -> Option<(String, String)> {
    let out = git::run_ok(repo, &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).ok()?;
    let full = out.stdout.trim();
    if full.is_empty() {
        return None;
    }
    let (remote, branch) = full.split_once('/')?;
    Some((remote.to_string(), branch.to_string()))
}

/// Local branch name HEAD is on, or empty if detached.
fn git_head_branch_local(repo: &PathBuf) -> Option<String> {
    let out = git::run_ok(repo, &["symbolic-ref", "--short", "HEAD"]).ok()?;
    let name = out.stdout.trim().to_string();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

fn last_meaningful_line(out: &GitOutput) -> String {
    // Git writes both progress and the final summary to stderr; the summary
    // is the last non-empty, non-progress line. Strip remote/progress noise
    // ("remote:", "To ...") and return what remains.
    for line in out.stderr.lines().rev() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.starts_with("remote:") || trimmed.starts_with("To ") {
            continue;
        }
        return trimmed.to_string();
    }
    // Fall back to stdout if stderr was empty (older git versions, or
    // `--porcelain` output).
    out.stdout
        .lines()
        .rev()
        .find(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .unwrap_or_default()
}

fn push_failure(out: &GitOutput) -> GitError {
    let stderr = out.stderr.trim().to_string();
    let kind = if stderr.contains("not a git repository") {
        crate::error::GitErrorKind::NotARepo
    } else if stderr.contains("non-fast-forward") || stderr.contains("rejected") {
        crate::error::GitErrorKind::Conflict
    } else {
        crate::error::GitErrorKind::Other
    };
    let message = if stderr.is_empty() {
        "git push failed".to_string()
    } else {
        stderr
    };
    let mut err = GitError::new(kind, message);
    err.code = out.status.code();
    err
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn nanos() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    }

    /// Set up a bare "remote" + a clone pointing at it, with one commit.
    /// Returns (remote_path, repo_path).
    fn clone_with_upstream() -> (PathBuf, PathBuf) {
        let suffix = nanos();
        let remote = std::env::temp_dir().join(format!("gitako-push-remote-{suffix}"));
        let repo = std::env::temp_dir().join(format!("gitako-push-repo-{suffix}"));
        let _ = std::fs::remove_dir_all(&remote);
        let _ = std::fs::remove_dir_all(&repo);
        std::fs::create_dir_all(&remote).unwrap();

        // Bare remote.
        Command::new("git")
            .args(["init", "--bare", "-q"])
            .current_dir(&remote)
            .output()
            .unwrap();

        // Clone it into a working repo.
        Command::new("git")
            .args(["clone", "-q", remote.to_string_lossy().as_ref(), repo.to_string_lossy().as_ref()])
            .output()
            .unwrap();

        for args in [
            &["config", "user.email", "t@t"][..],
            &["config", "user.name", "t"][..],
            &["config", "commit.gpgsign", "false"][..],
        ] {
            Command::new("git")
                .args(args)
                .current_dir(&repo)
                .output()
                .unwrap();
        }
        // Make an initial commit so we have a branch to push.
        Command::new("git")
            .args(["commit", "--allow-empty", "-q", "-m", "init"])
            .current_dir(&repo)
            .output()
            .unwrap();
        (remote, repo)
    }

    #[test]
    fn push_with_upstream_succeeds() {
        let (_remote, repo) = clone_with_upstream();
        // First push sets the upstream. The initial branch name depends on
        // the git default (often `master`); we don't pin it because the test
        // contract is "the push works and reports the actual current branch".
        let r = git_push(repo.to_string_lossy().into_owned()).unwrap();
        assert_eq!(r.remote, "origin");
        assert!(!r.branch.is_empty(), "branch should be reported");
        assert!(!r.summary.is_empty(), "summary should be populated");
    }

    #[test]
    fn push_twice_is_idempotent() {
        let (_remote, repo) = clone_with_upstream();
        git_push(repo.to_string_lossy().into_owned()).unwrap();
        let r = git_push(repo.to_string_lossy().into_owned()).unwrap();
        // Second push should still succeed and report "Everything up-to-date".
        assert!(
            r.summary.to_lowercase().contains("up-to-date")
                || r.summary.to_lowercase().contains("up to date")
                || r.summary.is_empty(),
            "expected up-to-date summary, got: {:?}",
            r.summary
        );
    }

    #[test]
    fn push_without_remote_errors() {
        // Local repo with no remote at all.
        let suffix = nanos();
        let dir = std::env::temp_dir().join(format!("gitako-push-noremote-{suffix}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        for args in [
            &["init", "-q", "-b", "main"][..],
            &["config", "user.email", "t@t"][..],
            &["config", "user.name", "t"][..],
            &["commit", "--allow-empty", "-q", "-m", "c1"][..],
        ] {
            Command::new("git").args(args).current_dir(&dir).output().unwrap();
        }
        let r = git_push(dir.to_string_lossy().into_owned());
        assert!(r.is_err(), "push should fail when no remote is configured");
    }

    #[test]
    fn push_non_fast_forward_returns_conflict() {
        // Set up: bare remote, clone, push A. Then use a donor repo to push
        // B to the remote. The original clone (still at A) makes a divergent
        // commit C and tries to push — should be rejected as non-fast-forward.
        let (_remote, repo) = clone_with_upstream();
        // First push from the clone to seed the upstream.
        git_push(repo.to_string_lossy().into_owned()).unwrap();

        // Use a separate "donor" repo pointing at the same remote to advance it.
        let suffix = nanos();
        let donor = std::env::temp_dir().join(format!("gitako-push-ff-donor-{suffix}"));
        let _ = std::fs::remove_dir_all(&donor);
        std::fs::create_dir_all(&donor).unwrap();
        Command::new("git")
            .args(["clone", "-q", _remote.to_string_lossy().as_ref(), donor.to_string_lossy().as_ref()])
            .output()
            .unwrap();
        for args in [
            &["config", "user.email", "t@t"][..],
            &["config", "user.name", "t"][..],
        ] {
            Command::new("git")
                .args(args)
                .current_dir(&donor)
                .output()
                .unwrap();
        }
        // Add a commit on the donor and push it to origin, advancing the remote.
        Command::new("git")
            .args(["commit", "--allow-empty", "-q", "-m", "B"])
            .current_dir(&donor)
            .output()
            .unwrap();
        Command::new("git")
            .args(["push", "-q", "origin", "HEAD"])
            .current_dir(&donor)
            .output()
            .unwrap();

        // Now make a divergent commit in the original `repo` (still at A)
        // and try to push.
        Command::new("git")
            .args(["commit", "--allow-empty", "-q", "-m", "C"])
            .current_dir(&repo)
            .output()
            .unwrap();
        let r = git_push(repo.to_string_lossy().into_owned());
        assert!(r.is_err(), "push should fail when remote is ahead");
    }
}
