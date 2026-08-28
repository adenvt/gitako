use std::path::PathBuf;

use crate::git;
use crate::git::diff::{parse_hunks, split_lines, DiffFile};

/// Line/byte caps for the full-file view.
const MAX_LINES: usize = 2000;
const MAX_BYTES: usize = 500 * 1024;

/// Get a full-file side-by-side diff of `path`.
///
/// `rev` is a commit hash; empty string means the working tree. When `rev` is
/// empty and `staged` is true, diff the index against HEAD (staged changes).
#[tauri::command]
pub fn git_diff(
    repo_path: String,
    rev: String,
    path: String,
    staged: bool,
) -> Result<DiffFile, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);

    let (parent, new_rev) = if rev.is_empty() {
        // Worktree diff: parent is the index, new side is the working file.
        (":".to_string(), None)
    } else {
        let parent = resolve_parent(&repo, &rev)?;
        (parent, Some(rev.as_str()))
    };

    // Hunks via unified diff.
    let diff_stdout = match new_rev {
        None => {
            if staged {
                // Index vs HEAD.
                git::run_ok(&repo, &["diff", "--cached", "--unified=3", "--no-color", "--", &path])?.stdout
            } else {
                // Untracked files produce no `git diff` output (not in the index);
                // synthesize an all-added diff so they show as changes.
                if is_untracked(&repo, &path) {
                    let content = std::fs::read_to_string(repo.join(&path)).unwrap_or_default();
                    let new_lines = split_lines(&content).len();
                    let hunk = crate::git::diff::DiffHunk {
                        old_start: 0,
                        old_lines: 0,
                        new_start: 1,
                        new_lines: new_lines as u32,
                        lines: split_lines(&content)
                            .into_iter()
                            .map(|t| crate::git::diff::DiffLine {
                                kind: "add".into(),
                                text: t,
                            })
                            .collect(),
                    };
                    return Ok(DiffFile {
                        old_path: String::new(),
                        new_path: path.clone(),
                        status: "A".to_string(),
                        binary: false,
                        too_large: content.len() > MAX_BYTES || new_lines > MAX_LINES,
                        old_lines: Vec::new(),
                        new_lines: split_lines(&content),
                        hunks: vec![hunk],
                    });
                }
                git::run_ok(&repo, &["diff", "--unified=3", "--no-color", "--", &path])?.stdout
            }
        }
        Some(r) => git::run_ok(
            &repo,
            &[
                "diff",
                "--unified=3",
                "--no-color",
                &parent,
                r,
                "--",
                &path,
            ],
        )?
        .stdout,
    };

    let binary = diff_stdout.contains("Binary files") || diff_stdout.contains("GIT binary patch");
    if binary {
        return Ok(DiffFile {
            old_path: path.clone(),
            new_path: path,
            status: "M".to_string(),
            binary: true,
            too_large: false,
            old_lines: Vec::new(),
            new_lines: Vec::new(),
            hunks: Vec::new(),
        });
    }

    // Full contents.
    let (old_content, new_content) = match new_rev {
        // Old side = index (git show :path), new side = working tree (disk).
        None => {
            if staged {
                let head = resolve_parent(&repo, "HEAD")?;
                let old = git::run_tolerate(&repo, &["show", &format!("{head}:{path}")])?;
                let new = git::run_tolerate(&repo, &["show", &format!(":{path}")])?;
                (old.stdout, new.stdout)
            } else {
                let old = git::run_tolerate(&repo, &["show", &format!(":{path}")])?;
                let new = std::fs::read_to_string(repo.join(&path)).unwrap_or_default();
                (old.stdout, new)
            }
        }
        Some(r) => {
            let old = git::run_tolerate(&repo, &["show", &format!("{parent}:{path}")])?;
            let new = git::run_tolerate(&repo, &["show", &format!("{r}:{path}")])?;
            (old.stdout, new.stdout)
        }
    };

    let old_lines = split_lines(&old_content);
    let new_lines = split_lines(&new_content);

    let too_large = old_content.len() > MAX_BYTES
        || new_content.len() > MAX_BYTES
        || old_lines.len() > MAX_LINES
        || new_lines.len() > MAX_LINES;

    let hunks = parse_hunks(&diff_stdout);

    Ok(DiffFile {
        old_path: path.clone(),
        new_path: path,
        status: "M".to_string(),
        binary: false,
        too_large,
        old_lines,
        new_lines,
        hunks,
    })
}

/// Resolve the parent revision of `rev`; falls back to the empty tree.
///
/// Note: for merge commits, this returns the **first** parent. That's the
/// default behavior of `git show`/`git diff <rev>^..<rev>` and matches what
/// most users expect (especially for the common "rebase and merge" workflow,
/// where the PR's content is already on the first parent's side). Showing
/// the diff against the second parent is occasionally more useful for true
/// merges of long-lived branches, but no single default is right for both,
/// so the first parent wins unless a future UI lets the user pick. Octopus
/// merges (3+ parents) are not specially handled.
fn resolve_parent(repo: &std::path::Path, rev: &str) -> Result<String, crate::error::GitError> {
    let out = git::run_tolerate(repo, &["rev-parse", &format!("{rev}^")]);
    match out {
        Ok(o) if o.status.success() => Ok(o.stdout.trim().to_string()),
        _ => {
            // Root commit: diff against the empty tree.
            let empty = git::run_ok(repo, &["hash-object", "-t", "tree", "/dev/null"])?;
            Ok(empty.stdout.trim().to_string())
        }
    }
}

/// True when `path` is untracked in the working tree (porcelain status `??`).
fn is_untracked(repo: &std::path::Path, path: &str) -> bool {
    if let Ok(out) = git::run_ok(repo, &["status", "--porcelain", "--", path]) {
        out.stdout.lines().any(|l| l.starts_with("??"))
    } else {
        false
    }
}
