use std::path::PathBuf;

use crate::git;

/// `git stash push -u -m "<message>"`. Used by smart-switch to set aside
/// the dirty worktree before checkout, and by future stash UX. Always
/// returns the new stash ref (`stash@{0}`) so callers can pop deterministically.
#[tauri::command]
pub fn git_stash_save(
    repo_path: String,
    message: String,
) -> Result<String, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    let out = git::run_ok(&repo, &["stash", "push", "-u", "-m", &message])?;
    // If there was nothing to stash, git prints "No local changes to save"
    // and exits 0 but creates no entry. In that case, return an empty string
    // so the frontend can skip the pop step.
    if out.stdout.contains("No local changes to save") {
        return Ok(String::new());
    }
    Ok("stash@{0}".to_string())
}

/// `git stash pop <ref>`. Returns Err on conflict so the frontend can
/// toast and keep the stash intact for the user to resolve.
#[tauri::command]
pub fn git_stash_pop(
    repo_path: String,
    stash_ref: String,
) -> Result<(), crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    // Empty ref means "nothing was stashed" — caller is signalling skip.
    if stash_ref.is_empty() {
        return Ok(());
    }
    git::run_ok(&repo, &["stash", "pop", &stash_ref])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn dirty_repo() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("gitako-stash-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        for args in [
            &["init", "-q", "-b", "main"][..],
            &["config", "user.email", "t@t"][..],
            &["config", "user.name", "t"][..],
            &["commit", "--allow-empty", "-q", "-m", "c1"][..],
        ] {
            Command::new("git").args(args).current_dir(&dir).output().unwrap();
        }
        std::fs::write(dir.join("wip.txt"), "wip").unwrap();
        dir
    }

    #[test]
    fn stash_save_returns_ref_when_dirty() {
        let dir = dirty_repo();
        let r = git_stash_save(dir.to_string_lossy().into_owned(), "wip".into()).unwrap();
        assert_eq!(r, "stash@{0}");
    }

    #[test]
    fn stash_save_returns_empty_when_clean() {
        let dir = dirty_repo();
        // Reset to remove the dirty file from the index entirely.
        Command::new("git")
            .args(["reset", "--hard", "HEAD"])
            .current_dir(&dir)
            .output()
            .unwrap();
        std::fs::remove_file(dir.join("wip.txt")).unwrap();
        let r = git_stash_save(dir.to_string_lossy().into_owned(), "noop".into()).unwrap();
        assert_eq!(r, "");
    }

    #[test]
    fn stash_pop_restores_work() {
        let dir = dirty_repo();
        let stash_ref = git_stash_save(dir.to_string_lossy().into_owned(), "wip".into()).unwrap();
        assert!(!stash_ref.is_empty());
        git_stash_pop(dir.to_string_lossy().into_owned(), stash_ref).unwrap();
        assert!(dir.join("wip.txt").exists());
    }

    #[test]
    fn stash_pop_empty_ref_is_noop() {
        let dir = dirty_repo();
        // No prior save — empty ref must not error.
        git_stash_pop(dir.to_string_lossy().into_owned(), "".into()).unwrap();
    }
}
