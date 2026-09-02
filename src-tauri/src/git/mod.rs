//! Safe git subprocess layer.
//!
//! Every invocation goes through [`run`], which builds the command with an
//! args array (never a shell string), so repository-controlled input such as
//! paths or ref names cannot inject shell syntax.

use std::path::Path;
use std::process::{Command, Stdio};

use crate::error::{GitError, GitErrorKind};

pub mod changed;
pub mod diff;
pub mod log;
pub mod refs;

pub struct GitOutput {
    pub status: std::process::ExitStatus,
    pub stdout: String,
    pub stderr: String,
}

/// Run git with `args` in `repo_dir`, capturing stdout/stderr as UTF-8.
pub fn run(repo_dir: &Path, args: &[&str]) -> Result<GitOutput, GitError> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_dir)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()?;

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    Ok(GitOutput {
        status: output.status,
        stdout,
        stderr,
    })
}

/// Like [`run`] but returns a typed error when the exit code is non-zero.
pub fn run_ok(repo_dir: &Path, args: &[&str]) -> Result<GitOutput, GitError> {
    let out = run(repo_dir, args)?;
    if !out.status.success() {
        return Err(failure(repo_dir, args, &out));
    }
    Ok(out)
}

/// Run a command that may legitimately fail (e.g. `git diff` with no changes)
/// and let the caller decide. Returns Ok even on non-zero exit.
pub fn run_tolerate(repo_dir: &Path, args: &[&str]) -> Result<GitOutput, GitError> {
    run(repo_dir, args)
}

fn failure(_repo_dir: &Path, args: &[&str], out: &GitOutput) -> GitError {
    let stderr = out.stderr.trim();
    let kind = if stderr.contains("not a git repository") {
        GitErrorKind::NotARepo
    } else if stderr.contains("fatal:") && stderr.contains("conflict") {
        GitErrorKind::Conflict
    } else {
        GitErrorKind::Other
    };
    let code = out.status.code();
    let message = if stderr.is_empty() {
        format!("git {} failed", args.join(" "))
    } else {
        stderr.to_string()
    };
    let mut err = GitError::new(kind, message);
    err.code = code;
    err
}

/// Get the top-level directory of the repo containing `path`.
pub fn repo_root(path: &Path) -> Result<std::path::PathBuf, GitError> {
    let out = run_ok(
        path,
        &["rev-parse", "--show-toplevel"],
    )?;
    let root = out.stdout.trim().to_string();
    if root.is_empty() {
        return Err(GitError::not_a_repo(format!(
            "{} is not inside a git repository",
            path.display()
        )));
    }
    Ok(std::path::PathBuf::from(root))
}

/// Resolve a revision to its full hash. Empty string means HEAD.
pub fn resolve_revision(repo: &Path, rev: &str) -> Result<String, GitError> {
    let target = if rev.is_empty() { "HEAD" } else { rev };
    let out = run_ok(repo, &["rev-parse", target])?;
    let hash = out.stdout.trim().to_string();
    if hash.is_empty() {
        return Err(GitError::not_found(format!("cannot resolve {rev}")));
    }
    Ok(hash)
}

/// Convenience for printing progress output when piping a long-running git
/// command. Not used by `run`; reserved for push/pull (ROADMAP Phase 5).
#[allow(dead_code)]
pub fn run_streamed(
    repo_dir: &Path,
    args: &[&str],
    mut on_line: impl FnMut(&str),
) -> Result<std::process::ExitStatus, GitError> {
    let mut child = Command::new("git")
        .args(args)
        .current_dir(repo_dir)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let mut out_buf = String::new();
    if let Some(mut stdout) = child.stdout.take() {
        let _ = std::io::Read::read_to_string(&mut stdout, &mut out_buf);
    }
    let mut err_buf = String::new();
    if let Some(mut stderr) = child.stderr.take() {
        let _ = std::io::Read::read_to_string(&mut stderr, &mut err_buf);
    }

    // Emit progress lines from stderr (git writes progress there).
    for line in err_buf.lines() {
        if !line.is_empty() {
            on_line(line);
        }
    }

    let status = child.wait()?;
    if !status.success() {
        eprintln!("git {} failed: {}", args.join(" "), err_buf);
    }
    Ok(status)
}
