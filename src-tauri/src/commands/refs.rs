use std::path::PathBuf;

use crate::git;

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
