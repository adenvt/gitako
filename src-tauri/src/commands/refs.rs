use std::collections::BTreeSet;
use std::path::PathBuf;

use crate::git;

/// Fetch all refs (branches, remote branches, tags) resolved to commits,
/// with remote URLs filled in for remote branches (best-effort).
#[tauri::command]
pub async fn git_refs(repo_path: String) -> Result<Vec<git::refs::RefInfo>, crate::error::GitError> {
    let repo = PathBuf::from(&repo_path);
    let out = git::run_ok(
        &repo,
        &[
            "for-each-ref",
            "--format=%(refname)%00%(objectname)%00%(objecttype)%00%(HEAD)%00%(*objectname)%00",
        ],
    )
    .await?;
    let mut refs = git::refs::parse_refs(&out.stdout);

    // Fill remote_url for remote branches: query each remote once, best-effort.
    // `for-each-ref` is sequential per remote; the per-remote `get-url` calls
    // are tiny so the serial cost is negligible compared to the main call.
    let remotes: BTreeSet<&str> = refs
        .iter()
        .filter_map(|r| r.remote.as_deref())
        .collect();
    let mut url_by_remote: std::collections::HashMap<String, String> = Default::default();
    for remote in &remotes {
        if let Ok(out) = git::run_tolerate(&repo, &["remote", "get-url", remote]).await {
            let url = out.stdout.trim().to_string();
            if !url.is_empty() {
                url_by_remote.insert(remote.to_string(), url);
            }
        }
    }
    for r in &mut refs {
        if let Some(remote) = &r.remote {
            r.remote_url = url_by_remote.get(remote).cloned();
        }
    }

    Ok(refs)
}
