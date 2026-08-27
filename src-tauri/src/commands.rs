use std::path::PathBuf;

use crate::git;

/// Fetch the full commit graph for a repo (all refs, topologically ordered).
#[tauri::command]
pub fn git_log(repo_path: String) -> Result<Vec<git::log::Commit>, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    let out = git::run_ok(
        &repo,
        &[
            "log",
            "--all",
            "--topo-order",
            "--parents",
            "--format=%H%x00%P%x00%an%x00%ae%x00%at%x00%s%x00%N",
        ],
    )?;
    Ok(git::log::parse_log(&out.stdout))
}

/// Fetch all refs (branches, remote branches, tags) resolved to commits.
#[tauri::command]
pub fn git_refs(repo_path: String) -> Result<Vec<git::refs::RefInfo>, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    let out = git::run_ok(
        &repo,
        &[
            "for-each-ref",
            "--format=%(refname)%00%(objectname)%00%(objecttype)%00%(HEAD)%00%(*objectname)%00",
        ],
    )?;
    Ok(git::refs::parse_refs(&out.stdout))
}

/// Resolve a revision to its full hash. Empty string means HEAD.
#[tauri::command]
pub fn git_rev_parse(repo_path: String, rev: String) -> Result<String, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    git::resolve_revision(&repo, &rev)
}

/// Get the top-level directory of the repo containing a path.
#[tauri::command]
pub fn git_repo_root(path: String) -> Result<String, crate::error::GitError> {
    let root = git::repo_root(std::path::Path::new(&path))?;
    Ok(root.to_string_lossy().into_owned())
}

/// Get the short status of the working tree (porcelain v1, one-line-per-file).
#[tauri::command]
pub fn git_status(repo_path: String) -> Result<String, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    let out = git::run_ok(&repo, &["status", "--porcelain=v1"])?;
    Ok(out.stdout)
}

/// List files changed by a commit (status + path, via `git show --name-status`).
#[tauri::command]
pub fn git_show_files(
    repo_path: String,
    rev: String,
) -> Result<Vec<git::changed::ChangedFile>, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    let out = git::run_ok(
        &repo,
        &[
            "show",
            "--name-status",
            "--format=", // no commit header, just the file records
            &rev,
        ],
    )?;
    Ok(git::changed::parse_show(&out.stdout))
}
