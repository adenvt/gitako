use std::path::PathBuf;

use crate::git;

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
