//! Simulation Engine — turns `SystemSnapshot`s into a living creature.
//! Pure functions only: no I/O, no clocks, no globals. Everything testable.
//! See docs/ARCHITECTURE.md §5.

mod needs;

pub use needs::compute_needs;

/// The pet's needs, each 0–100 (100 = perfectly satisfied).
/// `None` means the sensors backing that need aren't available (yet).
#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct Needs {
    /// Thermal comfort — GPU temp, with CPU load as fallback signal.
    pub comfort: f32,
    /// Room to live — free space on the system drive.
    pub space: Option<f32>,
    /// Cleanliness — temp files, recycle bin. Sensors arrive in a later milestone.
    pub tidiness: Option<f32>,
    /// Sleep — machine uptime.
    pub rest: f32,
    /// Vitality — RAM pressure.
    pub energy: f32,
}