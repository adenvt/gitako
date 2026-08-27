#![allow(dead_code)] // Phase 1: helpers reserved for Phase 2+ (status, diff, remote ops)

mod commands;
mod error;
mod git;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::git_log,
            commands::git_refs,
            commands::git_rev_parse,
            commands::git_status,
            commands::git_repo_root,
            commands::git_show_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
