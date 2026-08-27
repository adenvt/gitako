use std::path::PathBuf;

use crate::git;

/// Get the short status of the working tree (porcelain v1, one-line-per-file).
#[tauri::command]
pub fn git_status(repo_path: String) -> Result<String, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    let out = git::run_ok(&repo, &["status", "--porcelain=v1"])?;
    Ok(out.stdout)
}
