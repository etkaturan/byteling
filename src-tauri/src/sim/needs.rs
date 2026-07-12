use crate::sensors::SystemSnapshot;

use super::Needs;

/// Map `value` linearly onto 0–100, where `best` scores 100 and `worst`
/// scores 0. Works in both directions (best < worst or best > worst).
fn ramp(value: f32, best: f32, worst: f32) -> f32 {
    let t = (value - best) / (worst - best);
    100.0 * (1.0 - t.clamp(0.0, 1.0))
}

pub fn compute_needs(s: &SystemSnapshot) -> Needs {
    // Comfort: GPU temperature is the primary fever signal (cool ≤60°C,
    // critical ≥90°C). Without an NVIDIA GPU, sustained CPU load stands in.
    let comfort = match &s.gpu {
        Some(gpu) => ramp(gpu.temp_c, 60.0, 90.0),
        None => ramp(s.cpu_load_pct, 50.0, 100.0),
    };

    // Space: ≥25% free is comfortable, ≤3% free is critical.
    let space = s
        .system_drive_free_pct
        .map(|free| ramp(free, 25.0, 3.0));

    // Rest: fresh within a day, exhausted after a week without reboot.
    let rest = ramp(s.uptime_hours, 24.0, 168.0);

    // Energy: RAM pressure. Relaxed ≤50%, gasping ≥95%.
    let energy = ramp(s.ram_used_pct, 50.0, 95.0);

    Needs {
        comfort,
        space,
        tidiness: None, // sensors not built yet — arrives with the storage scan
        rest,
        energy,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sensors::GpuReading;

    fn snapshot(cpu: f32, ram: f32, uptime_h: f32, free: f32, gpu_temp: Option<f32>) -> SystemSnapshot {
        SystemSnapshot {
            cpu_load_pct: cpu,
            ram_used_pct: ram,
            process_count: 200,
            uptime_hours: uptime_h,
            system_drive_free_pct: Some(free),
            gpu: gpu_temp.map(|t| GpuReading {
                name: "Test GPU".into(),
                temp_c: t,
                load_pct: 50.0,
                vram_used_pct: 40.0,
            }),
        }
    }

    #[test]
    fn healthy_machine_scores_high_everywhere() {
        let needs = compute_needs(&snapshot(10.0, 40.0, 5.0, 60.0, Some(45.0)));
        assert!(needs.comfort > 95.0);
        assert!(needs.space.unwrap() > 95.0);
        assert!(needs.rest > 95.0);
        assert!(needs.energy > 95.0);
    }

    #[test]
    fn full_disk_is_critical_space() {
        // ~2% free — the developer's actual machine at time of writing.
        let needs = compute_needs(&snapshot(70.0, 59.0, 92.0, 2.25, Some(75.0)));
        assert!(needs.space.unwrap() < 5.0, "near-full disk must score near zero");
    }

    #[test]
    fn hot_gpu_lowers_comfort() {
        let cool = compute_needs(&snapshot(10.0, 40.0, 5.0, 60.0, Some(50.0)));
        let hot = compute_needs(&snapshot(10.0, 40.0, 5.0, 60.0, Some(85.0)));
        assert!(hot.comfort < cool.comfort);
        assert!(hot.comfort < 25.0);
    }

    #[test]
    fn without_gpu_cpu_load_drives_comfort() {
        let idle = compute_needs(&snapshot(10.0, 40.0, 5.0, 60.0, None));
        let slammed = compute_needs(&snapshot(98.0, 40.0, 5.0, 60.0, None));
        assert!(idle.comfort > 95.0);
        assert!(slammed.comfort < 10.0);
    }

    #[test]
    fn week_of_uptime_exhausts_rest() {
        let needs = compute_needs(&snapshot(10.0, 40.0, 170.0, 60.0, Some(45.0)));
        assert!(needs.rest < 2.0);
    }
}