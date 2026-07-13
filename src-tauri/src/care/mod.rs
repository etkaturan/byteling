//! Care actions — the only place Byteling *modifies* the machine.
//! Every action is preview-first and scoped narrowly. See ARCHITECTURE.md §5.4.

mod groom;

pub use groom::{groom_preview, perform_groom, GroomReport};