use std::path::PathBuf;

use crate::git;

/// Stage (`git add`) or unstage (`git restore --staged`) the given paths.
/// `staged: true` stages; `staged: false` unstages.
#[tauri::command]
pub fn git_stage(
    repo_path: String,
    paths: Vec<String>,
    staged: bool,
) -> Result<(), crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    if paths.is_empty() {
        return Ok(());
    }
    // `-A` so deletions are captured by `git add`; `git restore --staged`
    // handles both tracked deletions and renames on unstage.
    let mut args: Vec<String> = if staged {
        vec!["add".into(), "-A".into(), "--".into()]
    } else {
        vec!["restore".into(), "--staged".into(), "--".into()]
    };
    args.extend(paths);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    git::run_ok(&repo, &args)?;
    Ok(())
}

/// Commit the staged changes. Returns the new HEAD hash.
#[tauri::command]
pub fn git_commit(
    repo_path: String,
    subject: String,
    description: String,
) -> Result<String, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    let mut args: Vec<&str> = vec!["commit", "-m", &subject];
    if !description.trim().is_empty() {
        args.push("-m");
        args.push(&description);
    }
    git::run_ok(&repo, &args)?;
    // Resolve the new HEAD so the store can refresh with certainty.
    let out = git::run_ok(&repo, &["rev-parse", "HEAD"])?;
    Ok(out.stdout.trim().to_string())
}
