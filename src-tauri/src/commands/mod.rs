//! Tauri command handlers, one file per command area.
//!
//! Each new command is added to its area file here. `lib.rs` references the
//! commands by their full module paths in `generate_handler!` (the Tauri macro
//! emits hidden symbols in the defining module, so re-exports don't work).

pub mod checkout;
pub mod checkout_track;
pub mod commit;
pub mod diff;
pub mod log;
pub mod refs;
pub mod repo;
pub mod show;
pub mod stash;
pub mod status;
