use crate::git;

/// Resolve a revision to its full hash. Empty string means HEAD.
#[tauri::command]
pub fn git_rev_parse(repo_path: String, rev: String) -> Result<String, crate::error::GitError> {
    let repo = std::path::PathBuf::from(&repo_path);
    git::resolve_revision(&repo, &rev)
}

/// Get the top-level directory of the repo containing a path.
#[tauri::command]
pub fn git_repo_root(path: String) -> Result<String, crate::error::GitError> {
    let root = git::repo_root(std::path::Path::new(&path))?;
    Ok(root.to_string_lossy().into_owned())
}
