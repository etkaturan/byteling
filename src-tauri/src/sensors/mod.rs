//! Sensor Service — polls the machine and produces normalized `SystemSnapshot`s.
//! See docs/ARCHITECTURE.md §4.

mod gpu;
mod storage;
mod system;
mod machine;


pub use gpu::GpuPoller;
pub use system::SystemPoller;

#[derive(Debug, Clone, serde::Serialize)]
pub struct SystemSnapshot {
    pub cpu_load_pct: f32,
    pub ram_used_pct: f32,
    pub process_count: usize,
    pub uptime_hours: f32,
    pub system_drive_free_pct: Option<f32>,
    pub gpu: Option<GpuReading>,
    pub temp_mb: Option<u64>,
    pub recycle_bin_mb: Option<u64>,
}

/// Stable facts about the machine, gathered once at startup.
#[derive(Debug, Clone, serde::Serialize)]
pub struct HardwareIdentity {
    pub cpu: String,
    pub ram_gb: u64,
    pub cores: u32,
    pub gpu: Option<String>,
    pub is_laptop: bool,
    pub age_years: Option<f32>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct GpuReading {
    pub name: String,
    pub temp_c: f32,
    pub load_pct: f32,
    pub vram_used_pct: f32,
}

pub struct SensorService {
    system: SystemPoller,
    gpu: GpuPoller,
    storage: storage::StoragePoller,
}

impl SensorService {
    pub fn new() -> Self {
        Self {
            system: SystemPoller::new(),
            gpu: GpuPoller::new(),
            storage: storage::StoragePoller::new(),
        }
    }

    pub fn sample(&mut self) -> SystemSnapshot {
        let mut snapshot = self.system.sample();
        snapshot.gpu = self.gpu.sample();
        if let Some(s) = self.storage.sample() {
            snapshot.temp_mb = Some(s.temp_mb);
            snapshot.recycle_bin_mb = Some(s.recycle_bin_mb);
        }
        snapshot
    }

    /// All stable identity facts for species genesis.
    pub fn hardware_identity(&mut self) -> HardwareIdentity {
        let (cpu, ram_gb, cores) = self.system.hardware_identity();
        HardwareIdentity {
            cpu,
            ram_gb,
            cores,
            gpu: self.gpu.sample().map(|g| g.name),
            is_laptop: machine::has_battery(),
            age_years: machine::machine_age_years(),
        }
    }
}