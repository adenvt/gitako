use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::{GitError, GitErrorKind};
use crate::git;
use crate::git::GitOutput;

/// Pull strategy, matches the dropdown options in `PullMenu`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PullMode {
    /// `git pull --no-rebase` — fast-forward if possible, otherwise create a
    /// merge commit. The `--no-rebase` flag is required because `git pull`
    /// alone errors out on divergent branches when the repo has neither
    /// `pull.ff` nor `pull.rebase` configured.
    Ff,
    /// `git pull --ff-only` — refuse to create a merge commit.
    FfOnly,
    /// `git pull --rebase` — rebase local commits on top of upstream.
    Rebase,
}

impl PullMode {
    fn args(&self) -> &'static [&'static str] {
        match self {
            PullMode::Ff => &["pull", "--no-rebase"],
            PullMode::FfOnly => &["pull", "--ff-only"],
            PullMode::Rebase => &["pull", "--rebase"],
        }
    }
}

/// Summary of a fetch or pull, surfaced to the UI for toasts.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullResult {
    pub remote: String,
    pub branch: String,
    pub summary: String,
}

/// `git fetch --all`. Fetches from every configured remote. Errors when no
/// remote is configured or the fetch is rejected.
#[tauri::command]
pub async fn git_fetch(repo_path: String) -> Result<PullResult, GitError> {
    let repo = PathBuf::from(&repo_path);
    let (remote, branch) = upstream(&repo).await.unwrap_or_else(|| ("origin".to_string(), String::new()));

    let out = git::run(&repo, &["fetch", "--all"]).await?;
    if !out.status.success() {
        return Err(failure(&out, &["fetch", "--all"]));
    }

    let summary = last_meaningful_line(&out);
    Ok(PullResult {
        remote,
        branch,
        summary,
    })
}

/// `git pull` (default or with a mode flag).
#[tauri::command]
pub async fn git_pull(repo_path: String, mode: PullMode) -> Result<PullResult, GitError> {
    let repo = PathBuf::from(&repo_path);
    let args = mode.args();
    let (remote, branch) = upstream(&repo).await.unwrap_or_else(|| ("origin".to_string(), String::new()));

    let out = git::run(&repo, args).await?;
    if !out.status.success() {
        return Err(failure(&out, args));
    }

    let summary = last_meaningful_line(&out);
    Ok(PullResult {
        remote,
        branch,
        summary,
    })
}

async fn upstream(repo: &PathBuf) -> Option<(String, String)> {
    let out = git::run_ok(
        repo,
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    )
    .await
    .ok()?;
    let full = out.stdout.trim();
    if full.is_empty() {
        return None;
    }
    let (remote, branch) = full.split_once('/')?;
    Some((remote.to_string(), branch.to_string()))
}

fn last_meaningful_line(out: &GitOutput) -> String {
    for line in out.stderr.lines().rev() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.starts_with("remote:") || trimmed.starts_with("From ") || trimmed.starts_with("Already up to date.")
        {
            // "Already up to date." is useful but only when no other meaningful
            // line is present; keep it as a last-resort summary.
            continue;
        }
        return trimmed.to_string();
    }
    out.stdout
        .lines()
        .rev()
        .find(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .unwrap_or_default()
}

fn failure(out: &GitOutput, args: &[&str]) -> GitError {
    let stderr = out.stderr.trim().to_string();
    let kind = if stderr.contains("not a git repository") {
        GitErrorKind::NotARepo
    } else if stderr.contains("not possible to fast-forward")
        || stderr.contains("Not fast forward")
        || stderr.contains("non-fast-forward")
        || stderr.contains("rejected")
        || stderr.contains("diverged")
    {
        GitErrorKind::Conflict
    } else {
        GitErrorKind::Other
    };
    let message = if stderr.is_empty() {
        format!("git {} failed", args.join(" "))
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
    use std::path::Path;
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn nanos() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    }

    /// Set up a bare remote with one commit, a donor repo, and a working
    /// repo that has already pushed. Returns (remote_path, repo_path,
    /// branch_name).
    fn network_repo(label: &str) -> (PathBuf, PathBuf, String) {
        let suffix = nanos();
        let remote = std::env::temp_dir().join(format!("gitako-pull-remote-{label}-{suffix}"));
        let repo = std::env::temp_dir().join(format!("gitako-pull-repo-{label}-{suffix}"));
        let _ = std::fs::remove_dir_all(&remote);
        let _ = std::fs::remove_dir_all(&repo);
        std::fs::create_dir_all(&remote).unwrap();

        Command::new("git")
            .args(["init", "--bare", "-q"])
            .current_dir(&remote)
            .output()
            .unwrap();

        Command::new("git")
            .args([
                "clone",
                "-q",
                remote.to_string_lossy().as_ref(),
                repo.to_string_lossy().as_ref(),
            ])
            .output()
            .unwrap();
        for args in [
            &["config", "user.email", "t@t"][..],
            &["config", "user.name", "t"][..],
        ] {
            Command::new("git")
                .args(args)
                .current_dir(&repo)
                .output()
                .unwrap();
        }
        Command::new("git")
            .args(["commit", "--allow-empty", "-q", "-m", "init"])
            .current_dir(&repo)
            .output()
            .unwrap();
        Command::new("git")
            .args(["push", "-q", "-u", "origin", "HEAD"])
            .current_dir(&repo)
            .output()
            .unwrap();

        let branch = Command::new("git")
            .args(["rev-parse", "--abbrev-ref", "HEAD"])
            .current_dir(&repo)
            .output()
            .unwrap();
        let branch = String::from_utf8_lossy(&branch.stdout).trim().to_string();
        (remote, repo, branch)
    }

    /// Advance the remote by one commit using a donor clone.
    fn advance_remote(remote: &Path, suffix: u128) {
        let donor = std::env::temp_dir().join(format!("gitako-pull-donor-{suffix}"));
        let _ = std::fs::remove_dir_all(&donor);
        std::fs::create_dir_all(&donor).unwrap();
        Command::new("git")
            .args(["clone", "-q", remote.to_string_lossy().as_ref(), donor.to_string_lossy().as_ref()])
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
        Command::new("git")
            .args(["commit", "--allow-empty", "-q", "-m", "ahead"])
            .current_dir(&donor)
            .output()
            .unwrap();
        Command::new("git")
            .args(["push", "-q", "origin", "HEAD"])
            .current_dir(&donor)
            .output()
            .unwrap();
    }

    #[tokio::test]
    async fn fetch_with_remote_succeeds() {
        let (_remote, repo, branch) = network_repo("fetch");
        let r = git_fetch(repo.to_string_lossy().into_owned()).await.unwrap();
        assert_eq!(r.remote, "origin");
        assert_eq!(r.branch, branch);
    }

    #[tokio::test]
    async fn fetch_without_remote_does_nothing() {
        // `git fetch --all` with no remotes is a no-op (exits 0, "Everything
        // up-to-date"). Verify it doesn't error and returns a plausible result.
        let suffix = nanos();
        let dir = std::env::temp_dir().join(format!("gitako-pull-noremote-{suffix}"));
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
        let r = git_fetch(dir.to_string_lossy().into_owned()).await;
        assert!(r.is_ok(), "fetch with no remotes should be a no-op, got: {r:?}");
    }

    #[tokio::test]
    async fn pull_ff_when_behind_succeeds() {
        let (remote, repo, _branch) = network_repo("ff");
        advance_remote(&remote, nanos());
        let r = git_pull(repo.to_string_lossy().into_owned(), PullMode::Ff).await.unwrap();
        assert_eq!(r.remote, "origin");
    }

    #[tokio::test]
    async fn pull_ff_only_rejects_diverged_history() {
        let (remote, repo, _branch) = network_repo("ffonly");
        let suffix = nanos();
        // Local diverges from remote.
        Command::new("git")
            .args(["commit", "--allow-empty", "-q", "-m", "local-divergence"])
            .current_dir(&repo)
            .output()
            .unwrap();
        // Remote moves ahead.
        advance_remote(&remote, suffix);
        let r = git_pull(repo.to_string_lossy().into_owned(), PullMode::FfOnly).await;
        assert!(r.is_err(), "ff-only pull should refuse diverged history");
    }

    #[tokio::test]
    async fn pull_ff_merges_divergent_history_without_pull_rebase_config() {
        // Regression: `git pull` alone fails on divergent branches when the
        // repo has no `pull.ff` / `pull.rebase` config. The Ff mode now
        // passes `--no-rebase` so it falls through to a merge commit instead
        // of erroring out.
        let (remote, repo, _branch) = network_repo("ffdiverge");
        let suffix = nanos();
        // Sanity: no pull.* config set on the test repo.
        let cfg = Command::new("git")
            .args(["config", "--get-regexp", r"^pull\."])
            .current_dir(&repo)
            .output()
            .unwrap();
        assert!(cfg.stdout.is_empty(), "test repo should not have pull.* config");
        // Local diverges from remote.
        Command::new("git")
            .args(["commit", "--allow-empty", "-q", "-m", "local-divergence"])
            .current_dir(&repo)
            .output()
            .unwrap();
        // Remote moves ahead.
        advance_remote(&remote, suffix);
        let r = git_pull(repo.to_string_lossy().into_owned(), PullMode::Ff).await;
        assert!(r.is_ok(), "Ff pull should merge divergent history, got: {r:?}");
    }

    #[tokio::test]
    async fn pull_rebase_when_behind_succeeds() {
        let (remote, repo, _branch) = network_repo("rebase");
        advance_remote(&remote, nanos());
        let r = git_pull(repo.to_string_lossy().into_owned(), PullMode::Rebase).await.unwrap();
        assert_eq!(r.remote, "origin");
    }
}
