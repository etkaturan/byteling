//! Simulation Engine — turns `SystemSnapshot`s into a living creature.
//! Pure functions + one small stateful `Engine` for smoothing.
//! See docs/ARCHITECTURE.md §5.

mod engine;
mod mood;
mod needs;
mod species;

pub use engine::{Engine, PetState};
pub use mood::Mood;
pub use needs::compute_needs;
pub use species::hatch;

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

impl Needs {
    /// All currently-available needs as plain values.
    pub fn available(&self) -> Vec<f32> {
        let mut v = vec![self.comfort, self.rest, self.energy];
        if let Some(s) = self.space {
            v.push(s);
        }
        if let Some(t) = self.tidiness {
            v.push(t);
        }
        v
    }
}