//! Sensor Service — polls the machine and produces normalized `SystemSnapshot`s.
//! See docs/ARCHITECTURE.md §4. The simulation engine consumes snapshots;
//! the UI never touches raw sensors.

mod gpu;
mod system;

pub use gpu::GpuPoller;
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
    /// `None` on machines without an NVIDIA GPU — the sim must handle absence.
    pub gpu: Option<GpuReading>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct GpuReading {
    pub name: String,
    pub temp_c: f32,
    /// 0–100.
    pub load_pct: f32,
    /// 0–100.
    pub vram_used_pct: f32,
}

/// Facade owning all pollers. The rest of the app only ever talks to this.
pub struct SensorService {
    system: SystemPoller,
    gpu: GpuPoller,
}

impl SensorService {
    pub fn new() -> Self {
        Self {
            system: SystemPoller::new(),
            gpu: GpuPoller::new(),
        }
    }

    pub fn sample(&mut self) -> SystemSnapshot {
        let mut snapshot = self.system.sample();
        snapshot.gpu = self.gpu.sample();
        snapshot
    }

    /// Stable identity facts for species genesis: CPU brand, RAM GB, GPU name.
    pub fn hardware_identity(&mut self) -> (String, u64, Option<String>) {
        let (cpu, ram_gb) = self.system.hardware_identity();
        let gpu_name = self.gpu.sample().map(|g| g.name);
        (cpu, ram_gb, gpu_name)
    }
}