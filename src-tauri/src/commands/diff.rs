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
                // Index vs HEAD: old side is HEAD's blob, new side is the index.
                let old = git::run_tolerate(&repo, &["show", &format!("HEAD:{path}")])?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    /// Build a throwaway repo with one committed file + a new file that is
    /// staged (or left untracked).
    fn repo_with_staged_new_file() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "gitako-diff-test-{}-{:?}",
            std::process::id(),
            std::thread::current().name().unwrap_or("t")
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let run = |args: &[&str]| {
            let out = Command::new("git")
                .args(args)
                .current_dir(&dir)
                .output()
                .unwrap();
            assert!(out.status.success(), "git {:?} failed: {}", args, String::from_utf8_lossy(&out.stderr));
        };
        run(&["init", "-q"]);
        run(&["config", "user.email", "t@t"]);
        run(&["config", "user.name", "t"]);
        std::fs::write(dir.join("tracked.ts"), "old\n").unwrap();
        run(&["add", "tracked.ts"]);
        run(&["commit", "-qm", "init"]);
        std::fs::write(dir.join("new.ts"), "const a = 1;\nconst b = 2;\n").unwrap();
        run(&["add", "new.ts"]);
        dir
    }

    #[test]
    fn staged_new_file_diff() {
        let repo = repo_with_staged_new_file();
        let d = git_diff(repo.to_str().unwrap().to_string(), String::new(), "new.ts".to_string(), true).unwrap();
        assert_eq!(d.status, "M");
        assert!(d.old_lines.is_empty(), "old_lines should be empty for a new file");
        assert_eq!(d.new_lines, vec!["const a = 1;", "const b = 2;"]);
        assert_eq!(d.hunks.len(), 1);
        let h = &d.hunks[0];
        assert_eq!(h.old_start, 0);
        assert_eq!(h.new_start, 1);
        assert_eq!(h.lines.len(), 2);
        assert!(h.lines.iter().all(|l| l.kind == "add"));
    }

    #[test]
    fn staged_new_file_diff_with_parent_commit() {
        let repo = repo_with_staged_new_file();
        // Unstage new.ts so the following commits don't accidentally include it,
        // then re-stage it after — new.ts must never enter HEAD.
        let run = |args: &[&str]| {
            let out = Command::new("git").args(args).current_dir(&repo).output().unwrap();
            assert!(out.status.success(), "git {:?} failed: {}", args, String::from_utf8_lossy(&out.stderr));
        };
        run(&["reset", "-q", "new.ts"]);
        std::fs::write(repo.join("tracked.ts"), "old\nchanged\n").unwrap();
        run(&["add", "tracked.ts"]);
        run(&["commit", "-qm", "second"]);
        std::fs::write(repo.join("another.ts"), "x\n").unwrap();
        run(&["add", "another.ts"]);
        run(&["commit", "-qm", "third"]);
        // Re-stage the new file (the user's action) and diff it.
        run(&["add", "new.ts"]);

        let d = git_diff(repo.to_str().unwrap().to_string(), String::new(), "new.ts".to_string(), true).unwrap();
        assert!(d.old_lines.is_empty(), "old_lines should be empty (new.ts never in HEAD)");
        assert_eq!(d.new_lines, vec!["const a = 1;", "const b = 2;"]);
        let h = &d.hunks[0];
        assert_eq!(h.old_start, 0);
        assert_eq!(h.lines.len(), 2);
        assert!(h.lines.iter().all(|l| l.kind == "add"));
        // The full `git diff --cached` output has header lines (diff --git,
        // new file mode, index, ---/+++) — make sure none leak into the hunk.
        assert!(h.lines.iter().all(|l| l.text.starts_with("const")));
    }

    /// A staged new file without a trailing newline must still render: the
    /// `\ No newline at end of file` marker is skipped and old_lines stays
    /// empty.
    #[test]
    fn staged_new_file_no_trailing_newline() {
        let repo = repo_with_staged_new_file();
        // Rewrite new.ts without a trailing newline and re-stage.
        std::fs::write(repo.join("new.ts"), "const a = 1;\nconst b = 2;").unwrap();
        let out = Command::new("git").args(["add", "new.ts"]).current_dir(&repo).output().unwrap();
        assert!(out.status.success());
        let d = git_diff(repo.to_str().unwrap().to_string(), String::new(), "new.ts".to_string(), true).unwrap();
        assert!(d.old_lines.is_empty());
        assert_eq!(d.new_lines, vec!["const a = 1;", "const b = 2;"]);
        let h = &d.hunks[0];
        assert_eq!(h.lines.len(), 2);
        assert!(h.lines.iter().all(|l| l.kind == "add"));
        assert!(h.lines.iter().all(|l| !l.text.contains("No newline")));
    }

    /// Serialize the DiffFile to JSON and check the exact camelCase field
    /// names the frontend reads (oldLines/newLines/oldStart/...).
    #[test]
    fn staged_new_file_json_shape() {
        let repo = repo_with_staged_new_file();
        let d = git_diff(repo.to_str().unwrap().to_string(), String::new(), "new.ts".to_string(), true).unwrap();
        let json = serde_json::to_value(&d).unwrap();
        let obj = json.as_object().unwrap();
        eprintln!("JSON KEYS: {:?}", obj.keys().collect::<Vec<_>>());
        assert!(obj.contains_key("oldLines"), "frontend expects oldLines");
        assert!(obj.contains_key("newLines"), "frontend expects newLines");
        assert!(obj.contains_key("tooLarge"), "frontend expects tooLarge");
        let h = obj.get("hunks").unwrap().as_array().unwrap()[0].as_object().unwrap();
        assert!(h.contains_key("oldStart"), "frontend expects oldStart");
        assert!(h.contains_key("newStart"), "frontend expects newStart");
        assert!(h.contains_key("oldLines"), "frontend expects hunk oldLines");
        assert!(h.contains_key("newLines"), "frontend expects hunk newLines");
    }

    /// git_stage with staged=false (unstage) on a staged new file must
    /// succeed — this is the "Unstage All" path.
    #[test]
    fn unstage_new_file_via_git_stage() {
        let repo = repo_with_staged_new_file();
        let repo_str = repo.to_str().unwrap().to_string();
        // Sanity: the file is staged.
        let before = git_diff(repo_str.clone(), String::new(), "new.ts".to_string(), true).unwrap();
        assert!(!before.old_lines.is_empty() || !before.hunks.is_empty());
        // Unstage it exactly as the app does.
        super::super::commit::git_stage(repo_str.clone(), vec!["new.ts".to_string()], false).unwrap();
        // Now a staged diff should show no hunks / empty.
        let after = git_diff(repo_str, String::new(), "new.ts".to_string(), true).unwrap();
        assert!(after.hunks.is_empty(), "unstaged file has no cached diff");
    }

    /// A staged diff of a file that already exists in HEAD must use HEAD's
    /// blob as the old side (not HEAD^). The hunks come from `git diff
    /// --cached` (HEAD vs index), so the full old content must match that
    /// baseline or the side-by-side alignment drifts on unchanged regions.
    #[test]
    fn staged_diff_of_existing_file_uses_head_blob_as_old() {
        let dir = std::env::temp_dir().join(format!(
            "gitako-diff-staged-exists-{}-{:?}",
            std::process::id(),
            std::thread::current().name().unwrap_or("t")
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let run = |args: &[&str]| {
            let out = Command::new("git")
                .args(args)
                .current_dir(&dir)
                .output()
                .unwrap();
            assert!(out.status.success(), "git {:?} failed: {}", args, String::from_utf8_lossy(&out.stderr));
        };
        run(&["init", "-q"]);
        run(&["config", "user.email", "t@t"]);
        run(&["config", "user.name", "t"]);
        // Commit 1: "alpha" then commit 2 appends "beta" (so HEAD has both).
        std::fs::write(dir.join("f.txt"), "alpha\n").unwrap();
        run(&["add", "f.txt"]);
        run(&["commit", "-qm", "one"]);
        std::fs::write(dir.join("f.txt"), "alpha\nbeta\n").unwrap();
        run(&["add", "f.txt"]);
        run(&["commit", "-qm", "two"]);
        // Stage an insertion after "alpha".
        std::fs::write(dir.join("f.txt"), "alpha\ninserted\nbeta\n").unwrap();
        run(&["add", "f.txt"]);

        let d = git_diff(dir.to_str().unwrap().to_string(), String::new(), "f.txt".to_string(), true).unwrap();
        // Old side must be HEAD's content (alpha + beta), NOT HEAD^ (alpha).
        assert_eq!(d.old_lines, vec!["alpha", "beta"], "old side must be the HEAD blob");
        assert_eq!(d.new_lines, vec!["alpha", "inserted", "beta"]);
        // One hunk inserting one line between alpha and beta.
        assert_eq!(d.hunks.len(), 1);
        let h = &d.hunks[0];
        assert_eq!(h.old_start, 1);
        assert_eq!(h.new_start, 1);
        assert_eq!(h.lines.len(), 3); // context alpha, add inserted, context beta
        assert_eq!(h.lines[0].kind, "context");
        assert_eq!(h.lines[0].text, "alpha");
        assert_eq!(h.lines[1].kind, "add");
        assert_eq!(h.lines[1].text, "inserted");
        assert_eq!(h.lines[2].kind, "context");
        assert_eq!(h.lines[2].text, "beta");
    }
}
