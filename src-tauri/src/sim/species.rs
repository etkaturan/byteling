//! Species Genesis — every machine hatches its own creature, assembled along
//! four axes from real hardware. See docs/ARCHITECTURE.md §6.
//! Same hardware → same creature, forever.

use sha2::{Digest, Sha256};

use crate::sensors::HardwareIdentity;

/// Family — the biggest divide, from form factor.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum Family {
    /// Laptops: compact, airborne, wing/fin-based.
    Aerial,
    /// Desktops: larger, grounded, rooted.
    Grounded,
}

/// Life stage — the same creature at a different age.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum LifeStage {
    Hatchling,
    Adult,
    Elder,
}

/// Build — size and radiance, from GPU/CPU power tier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum Build {
    Slight,
    Sturdy,
    Mighty,
}

/// The fully-assembled creature.
#[derive(Debug, Clone, serde::Serialize)]
pub struct Species {
    pub family: Family,
    pub life_stage: LifeStage,
    pub build: Build,
    /// HSL hue 0–360 — base color.
    pub hue: u16,
    /// Number of limbs/appendages, from CPU cores (clamped 2–8).
    pub limbs: u8,
    /// Cosmetic marking density, 1–4, from the fingerprint.
    pub markings: u8,
    /// Movement speed multiplier: >1 quick (SSD), <1 languid. Detail only.
    pub liveliness: f32,
}

pub fn hatch(id: &HardwareIdentity) -> Species {
    // Deterministic seed from the stable fingerprint.
    let fingerprint = format!(
        "{}|{}|{}|{}",
        id.cpu.trim().to_lowercase(),
        id.ram_gb,
        id.gpu.as_deref().unwrap_or("none").trim().to_lowercase(),
        id.is_laptop,
    );
    let hash = Sha256::digest(fingerprint.as_bytes());
    let b = hash.as_slice();

    // Axis 1: Family from form factor.
    let family = if id.is_laptop {
        Family::Aerial
    } else {
        Family::Grounded
    };

    // Axis 2: Life stage from age. Unknown age → Adult (safe middle).
    let life_stage = match id.age_years {
        Some(a) if a < 1.0 => LifeStage::Hatchling,
        Some(a) if a < 4.0 => LifeStage::Adult,
        Some(_) => LifeStage::Elder,
        None => LifeStage::Adult,
    };

    // Axis 3: Build from power tier. Heuristic: dedicated GPU + core count.
    let build = match (id.gpu.is_some(), id.cores) {
        (true, c) if c >= 12 => Build::Mighty,
        (true, _) => Build::Sturdy,
        (false, c) if c >= 8 => Build::Sturdy,
        (false, _) => Build::Slight,
    };

    // Axis 4: Individuality.
    let hue = (u32::from(b[2]) * 360 / 255) as u16;
    let limbs = id.cores.clamp(2, 8) as u8;
    let markings = 1 + (b[3] % 4);
    // Liveliness leans on RAM as a rough proxy (no disk-type sensor yet).
    let liveliness = 0.85 + (b[4] % 30) as f32 / 100.0; // 0.85–1.14

    Species {
        family,
        life_stage,
        build,
        hue,
        limbs,
        markings,
        liveliness,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id(cpu: &str, ram: u64, cores: u32, gpu: Option<&str>, laptop: bool, age: Option<f32>) -> HardwareIdentity {
        HardwareIdentity {
            cpu: cpu.into(),
            ram_gb: ram,
            cores,
            gpu: gpu.map(|s| s.into()),
            is_laptop: laptop,
            age_years: age,
        }
    }

    #[test]
    fn laptop_is_aerial_desktop_is_grounded() {
        let laptop = hatch(&id("CPU", 16, 4, None, true, Some(2.0)));
        let desktop = hatch(&id("CPU", 16, 4, None, false, Some(2.0)));
        assert_eq!(laptop.family, Family::Aerial);
        assert_eq!(desktop.family, Family::Grounded);
    }

    #[test]
    fn age_maps_to_life_stage() {
        assert_eq!(hatch(&id("C", 8, 4, None, false, Some(0.5))).life_stage, LifeStage::Hatchling);
        assert_eq!(hatch(&id("C", 8, 4, None, false, Some(2.0))).life_stage, LifeStage::Adult);
        assert_eq!(hatch(&id("C", 8, 4, None, false, Some(6.0))).life_stage, LifeStage::Elder);
    }

    #[test]
    fn unknown_age_defaults_to_adult() {
        assert_eq!(hatch(&id("C", 8, 4, None, false, None)).life_stage, LifeStage::Adult);
    }

    #[test]
    fn strong_machine_is_mighty() {
        let s = hatch(&id("Ryzen 9", 64, 16, Some("RTX 4090"), false, Some(1.0)));
        assert_eq!(s.build, Build::Mighty);
    }

    #[test]
    fn deterministic_same_hardware() {
        let a = hatch(&id("i7-8700K", 32, 6, Some("GTX 1080 Ti"), false, Some(6.0)));
        let b = hatch(&id("i7-8700K", 32, 6, Some("GTX 1080 Ti"), false, Some(6.0)));
        assert_eq!(a.hue, b.hue);
        assert_eq!(a.limbs, b.limbs);
        assert_eq!(a.markings, b.markings);
    }

    #[test]
    fn limbs_track_cores_clamped() {
        assert_eq!(hatch(&id("C", 8, 6, None, false, None)).limbs, 6);
        assert_eq!(hatch(&id("C", 8, 32, None, false, None)).limbs, 8); // clamped
        assert_eq!(hatch(&id("C", 8, 1, None, false, None)).limbs, 2); // clamped
    }
}