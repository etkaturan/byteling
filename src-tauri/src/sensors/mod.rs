//! Sensor Service — polls the machine and produces normalized `SystemSnapshot`s.
//! See docs/ARCHITECTURE.md §4. The simulation engine consumes snapshots;
//! the UI never touches raw sensors.

mod system;

pub use system::SystemPoller;

/// One normalized reading of the machine's state.
#[derive(Debug, Clone, serde::Serialize)]
pub struct SystemSnapshot {
    /// 0–100, averaged across all cores.
    pub cpu_load_pct: f32,
    /// 0–100.
    pub ram_used_pct: f32,
    pub process_count: usize,
    pub uptime_hours: f32,
    /// Free space on the system drive, 0–100. `None` if C: wasn't found.
    pub system_drive_free_pct: Option<f32>,
}