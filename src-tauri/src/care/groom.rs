//! Groom = clear %TEMP% junk and empty the recycle bin.
//! Files in use are skipped, never forced. Nothing outside these two scopes.

use std::path::PathBuf;

/// What a groom did (or would do, in preview).
#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct GroomReport {
    pub freed_mb: u64,
    pub files_removed: u64,
    pub files_skipped: u64,
}

fn temp_dir() -> PathBuf {
    std::env::temp_dir()
}

/// Dry run: how much *could* be freed from %TEMP%, without deleting anything.
pub fn groom_preview() -> GroomReport {
    let mut report = GroomReport::default();
    let mut stack = vec![temp_dir()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else { continue };
            if meta.is_dir() {
                stack.push(entry.path());
            } else {
                report.freed_mb += meta.len() / 1_048_576;
                report.files_removed += 1;
            }
        }
    }
    report
}

/// The real thing: delete %TEMP% files (skipping any in use), then empty the
/// recycle bin. Returns what actually happened.
pub fn perform_groom() -> GroomReport {
    let mut report = GroomReport::default();
    let mut freed_bytes: u64 = 0;

    // Depth-first, deleting files then trying to remove now-empty dirs.
    let root = temp_dir();
    let mut stack = vec![root.clone()];
    let mut dirs_seen: Vec<PathBuf> = Vec::new();

    while let Some(dir) = stack.pop() {
        dirs_seen.push(dir.clone());
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else { continue };
            let path = entry.path();
            if meta.is_dir() {
                stack.push(path);
            } else {
                let size = meta.len();
                match std::fs::remove_file(&path) {
                    Ok(()) => {
                        freed_bytes += size;
                        report.files_removed += 1;
                    }
                    Err(_) => report.files_skipped += 1, // in use / locked
                }
            }
        }
    }

    // Remove directories that emptied out (deepest first). Never the root.
    dirs_seen.sort_by_key(|p| std::cmp::Reverse(p.components().count()));
    for dir in dirs_seen {
        if dir != root {
            let _ = std::fs::remove_dir(&dir); // fails harmlessly if not empty
        }
    }

    report.freed_mb = freed_bytes / 1_048_576;
    report.freed_mb += empty_recycle_bin();
    report
}

/// Empties the recycle bin on all drives. Returns MB freed (best-effort).
#[cfg(windows)]
fn empty_recycle_bin() -> u64 {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{
        SHEmptyRecycleBinW, SHQueryRecycleBinW, SHERB_NOCONFIRMATION, SHERB_NOPROGRESSUI,
        SHERB_NOSOUND, SHQUERYRBINFO,
    };

    // Size before, so we can report what was freed.
    let mut info = SHQUERYRBINFO {
        cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32,
        i64Size: 0,
        i64NumItems: 0,
    };
    let before_mb = if unsafe { SHQueryRecycleBinW(None, &mut info) }.is_ok() {
        (info.i64Size as u64) / 1_048_576
    } else {
        0
    };

    let _ = unsafe {
        SHEmptyRecycleBinW(
            None,
            PCWSTR::null(),
            SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND,
        )
    };
    before_mb
}

#[cfg(not(windows))]
fn empty_recycle_bin() -> u64 {
    0
}