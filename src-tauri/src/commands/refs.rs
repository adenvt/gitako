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

    // Fill upstream tracking info for local branches via git config.
    for r in &mut refs {
        if matches!(r.kind, git::refs::RefKind::Branch | git::refs::RefKind::Head) {
            let remote_out = git::run_tolerate(&repo, &["config", "--get", &format!("branch.{}.remote", r.name)]).await.ok();
            let merge_out = git::run_tolerate(&repo, &["config", "--get", &format!("branch.{}.merge", r.name)]).await.ok();
            if let (Some(remote_out), Some(merge_out)) = (remote_out, merge_out) {
                let remote = remote_out.stdout.trim().to_string();
                let merge = merge_out.stdout.trim().to_string();
                if !remote.is_empty() && !merge.is_empty() {
                    let upstream_name = merge.strip_prefix("refs/heads/").unwrap_or(&merge);
                    r.upstream = Some(format!("{}/{}", remote, upstream_name));
                }
            }
        }
    }

    Ok(refs)
}
