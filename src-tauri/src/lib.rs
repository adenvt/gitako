mod commands;
mod error;
mod git;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::checkout::git_checkout,
            commands::stash::git_stash_save,
            commands::stash::git_stash_pop,
            commands::commit::git_stage,
            commands::commit::git_commit,
            commands::diff::git_diff,
            commands::log::git_log,
            commands::refs::git_refs,
            commands::repo::git_rev_parse,
            commands::repo::git_head_branch,
            commands::status::git_status,
            commands::repo::git_repo_root,
            commands::show::git_show_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
