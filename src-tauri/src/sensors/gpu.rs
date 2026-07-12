use nvml_wrapper::enum_wrappers::device::TemperatureSensor;
use nvml_wrapper::Nvml;

use super::GpuReading;

/// NVIDIA-only for now (NVML needs no admin rights). On machines without an
/// NVIDIA driver, `Nvml::init()` fails once and every sample is `None`.
pub struct GpuPoller {
    nvml: Option<Nvml>,
}

impl GpuPoller {
    pub fn new() -> Self {
        Self {
            nvml: Nvml::init().ok(),
        }
    }

    pub fn sample(&self) -> Option<GpuReading> {
        let nvml = self.nvml.as_ref()?;
        let device = nvml.device_by_index(0).ok()?;

        let name = device.name().ok()?;
        let temp_c = device.temperature(TemperatureSensor::Gpu).ok()? as f32;
        let load_pct = device.utilization_rates().ok()?.gpu as f32;
        let mem = device.memory_info().ok()?;
        let vram_used_pct = if mem.total > 0 {
            100.0 * mem.used as f32 / mem.total as f32
        } else {
            0.0
        };

        Some(GpuReading {
            name,
            temp_c,
            load_pct,
            vram_used_pct,
        })
    }
}