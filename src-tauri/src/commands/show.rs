use std::path::PathBuf;

use crate::git;

/// List files changed by a commit (status + path, via `git show --name-status`).
#[tauri::command]
pub async fn git_show_files(
    repo_path: String,
    rev: String,
) -> Result<Vec<git::changed::ChangedFile>, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    let out = git::run_ok(
        &repo,
        &[
            "show",
            // `-m` makes merge commits show the diff against each parent
            // separately; for non-merge commits it's a no-op. Without it,
            // the combined diff is empty whenever both sides agree on the
            // result, so merge commits incorrectly show "No files changed."
            "-m",
            "--name-status",
            "--format=", // no commit header, just the file records
            &rev,
        ],
    )
    .await?;
    Ok(git::changed::parse_show(&out.stdout))
}
