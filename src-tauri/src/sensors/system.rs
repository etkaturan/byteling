use sysinfo::{Disks, ProcessesToUpdate, System};

use super::SystemSnapshot;

/// Owns the `sysinfo` handles and knows how to take one reading.
pub struct SystemPoller {
    sys: System,
    disks: Disks,
}

impl SystemPoller {
    pub fn new() -> Self {
        let mut sys = System::new();
        // First CPU refresh establishes a baseline — the very first usage
        // reading after process start is meaningless by design.
        sys.refresh_cpu_usage();
        Self {
            sys,
            disks: Disks::new_with_refreshed_list(),
        }
    }

    pub fn sample(&mut self) -> SystemSnapshot {
        self.sys.refresh_cpu_usage();
        self.sys.refresh_memory();
        self.sys.refresh_processes(ProcessesToUpdate::All, true);
        self.disks.refresh(true);

        let total_ram = self.sys.total_memory() as f32;
        let used_ram = self.sys.used_memory() as f32;

        let system_drive_free_pct = self
            .disks
            .list()
            .iter()
            .find(|d| d.mount_point().to_string_lossy().starts_with("C:"))
            .map(|d| 100.0 * d.available_space() as f32 / d.total_space() as f32);

        SystemSnapshot {
            cpu_load_pct: self.sys.global_cpu_usage(),
            ram_used_pct: if total_ram > 0.0 {
                100.0 * used_ram / total_ram
            } else {
                0.0
            },
            process_count: self.sys.processes().len(),
            uptime_hours: System::uptime() as f32 / 3600.0,
            system_drive_free_pct,
            gpu: None, // filled in by SensorService
        }
    }
}