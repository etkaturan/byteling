//! Sensor Service — polls the machine and produces normalized `SystemSnapshot`s.
//! See docs/ARCHITECTURE.md §4.

mod gpu;
mod storage;
mod system;

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

    pub fn hardware_identity(&mut self) -> (String, u64, Option<String>) {
        let (cpu, ram_gb) = self.system.hardware_identity();
        let gpu_name = self.gpu.sample().map(|g| g.name);
        (cpu, ram_gb, gpu_name)
    }
}