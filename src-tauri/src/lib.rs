#![allow(dead_code)] // Phase 1: helpers reserved for Phase 2+ (status, diff, remote ops)

mod commands;
mod error;
mod git;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::log::git_log,
            commands::refs::git_refs,
            commands::repo::git_rev_parse,
            commands::status::git_status,
            commands::repo::git_repo_root,
            commands::show::git_show_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
