use crate::sensors::SystemSnapshot;

use super::mood::{mood_band, mood_score};
use super::{compute_needs, Mood, Needs};

/// Smoothing factor per 5s tick: ~0.2 means a sudden change takes roughly
/// half a minute to fully register — spikes get absorbed, trends get through.
const ALPHA: f32 = 0.2;

/// What the rest of the app (and later the UI) consumes.
#[derive(Debug, Clone, serde::Serialize)]
pub struct PetState {
    pub needs: Needs,
    pub mood_score: f32,
    pub mood: Mood,
}

/// Owns the smoothed needs between ticks. The only mutable state in the sim.
pub struct Engine {
    smoothed: Option<Needs>,
}

impl Engine {
    pub fn new() -> Self {
        Self { smoothed: None }
    }

    pub fn tick(&mut self, snapshot: &SystemSnapshot) -> PetState {
        let raw = compute_needs(snapshot);
        let smoothed = match self.smoothed {
            None => raw, // first tick: adopt readings directly
            Some(prev) => Needs {
                comfort: ema(prev.comfort, raw.comfort),
                space: ema_opt(prev.space, raw.space),
                tidiness: ema_opt(prev.tidiness, raw.tidiness),
                rest: ema(prev.rest, raw.rest),
                energy: ema(prev.energy, raw.energy),
            },
        };
        self.smoothed = Some(smoothed);

        let score = mood_score(&smoothed);
        PetState {
            needs: smoothed,
            mood_score: score,
            mood: mood_band(score),
        }
    }
}

fn ema(prev: f32, new: f32) -> f32 {
    prev + ALPHA * (new - prev)
}

/// A need that just became available adopts its value immediately;
/// one that disappeared becomes `None` again.
fn ema_opt(prev: Option<f32>, new: Option<f32>) -> Option<f32> {
    match (prev, new) {
        (Some(p), Some(n)) => Some(ema(p, n)),
        (None, Some(n)) => Some(n),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sensors::GpuReading;

    fn snapshot(gpu_temp: f32) -> SystemSnapshot {
        SystemSnapshot {
            cpu_load_pct: 10.0,
            ram_used_pct: 40.0,
            process_count: 200,
            uptime_hours: 5.0,
            system_drive_free_pct: Some(60.0),
            gpu: Some(GpuReading {
                name: "Test GPU".into(),
                temp_c: gpu_temp,
                load_pct: 50.0,
                vram_used_pct: 40.0,
            }),
            temp_mb: None,
            recycle_bin_mb: None,
        }
    }

    #[test]
    fn single_spike_does_not_crash_the_mood() {
        let mut engine = Engine::new();
        let calm = engine.tick(&snapshot(45.0));
        assert_eq!(calm.mood, Mood::Thriving);

        // One 95°C spike among calm readings:
        let spiked = engine.tick(&snapshot(95.0));
        assert_eq!(spiked.mood, Mood::Thriving, "one spike must not flip the mood");
    }

    #[test]
    fn sustained_heat_does_change_the_mood() {
        let mut engine = Engine::new();
        engine.tick(&snapshot(45.0));
        let mut state = engine.tick(&snapshot(95.0));
        for _ in 0..20 {
            state = engine.tick(&snapshot(95.0));
        }
        assert!(state.needs.comfort < 10.0, "sustained heat must register");
        assert_ne!(state.mood, Mood::Thriving);
    }
}