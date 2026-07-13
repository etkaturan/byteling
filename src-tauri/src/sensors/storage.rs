//! Storage hygiene scans — slow, so cached and refreshed infrequently.
//! Read-only: this module never deletes anything. See ARCHITECTURE.md §4.

use std::path::PathBuf;
use std::time::{Duration, Instant};

/// Sizes that feed the Tidiness need. `None` until the first scan completes.
#[derive(Debug, Clone, Copy, Default, serde::Serialize)]
pub struct StorageReading {
    pub temp_mb: u64,
    pub recycle_bin_mb: u64,
}

pub struct StoragePoller {
    cached: Option<StorageReading>,
    last_scan: Option<Instant>,
    interval: Duration,
}

impl StoragePoller {
    pub fn new() -> Self {
        Self {
            cached: None,
            last_scan: None,
            interval: Duration::from_secs(300), // 5 minutes
        }
    }

    /// Returns the cached reading, rescanning only when the interval elapsed.
    pub fn sample(&mut self) -> Option<StorageReading> {
        let due = match self.last_scan {
            None => true,
            Some(t) => t.elapsed() >= self.interval,
        };
        if due {
            self.cached = Some(StorageReading {
                temp_mb: dir_size_mb(temp_dir()),
                recycle_bin_mb: recycle_bin_mb(),
            });
            self.last_scan = Some(Instant::now());
        }
        self.cached
    }
}

fn temp_dir() -> PathBuf {
    std::env::temp_dir()
}

/// Best-effort recursive size in MB. Unreadable entries are skipped, never fatal.
fn dir_size_mb(root: PathBuf) -> u64 {
    let mut total: u64 = 0;
    let mut stack = vec![root];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else { continue };
            if meta.is_dir() {
                stack.push(entry.path());
            } else {
                total += meta.len();
            }
        }
    }
    total / 1_048_576
}

/// Recycle bin size via the Win32 shell API. 0 on failure (best-effort).
#[cfg(windows)]
fn recycle_bin_mb() -> u64 {
    use windows::Win32::UI::Shell::{SHQueryRecycleBinW, SHQUERYRBINFO};

    let mut info = SHQUERYRBINFO {
        cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32,
        i64Size: 0,
        i64NumItems: 0,
    };
    // Null PWSTR = query all drives.
    let hr = unsafe { SHQueryRecycleBinW(None, &mut info) };
    if hr.is_ok() {
        (info.i64Size as u64) / 1_048_576
    } else {
        0
    }
}

#[cfg(not(windows))]
fn recycle_bin_mb() -> u64 {
    0
}