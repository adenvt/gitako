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
