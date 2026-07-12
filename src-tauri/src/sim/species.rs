//! Species Genesis — every machine hatches its own deterministic creature.
//! See docs/ARCHITECTURE.md §6. Same hardware → same Byteling, forever.

use sha2::{Digest, Sha256};

/// The body plan. GPU tier biases the roll but never fully determines it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum Archetype {
    /// Small, round, low-power spirits. Common on modest machines.
    Wisp,
    /// Sturdy, boxy, dependable. The workhorse build.
    Golem,
    /// Quick, spiky, electric. Gaming-rig energy.
    Volt,
    /// Long, calm, floating. Big-RAM machines dream bigger.
    Drake,
}

/// How the creature carries itself — flavors animations and (later) AI voice.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum Temperament {
    Zippy,
    Stoic,
    Curious,
    Dozy,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Species {
    pub archetype: Archetype,
    pub temperament: Temperament,
    /// HSL hue 0–360 — the palette anchor for sprites and UI accents.
    pub hue: u16,
    /// Cosmetic marking count (whiskers/antennae), 1–4 — from CPU cores later;
    /// for now rolled from the seed.
    pub markings: u8,
}

/// Deterministic: identical inputs always produce the identical creature.
pub fn hatch(cpu_brand: &str, ram_gb: u64, gpu_name: Option<&str>) -> Species {
    let fingerprint = format!(
        "{}|{}|{}",
        cpu_brand.trim().to_lowercase(),
        ram_gb,
        gpu_name.unwrap_or("none").trim().to_lowercase(),
    );
    let hash = Sha256::digest(fingerprint.as_bytes());

    // Consume distinct hash bytes for distinct traits, so traits are
    // independent of each other.
    let b = hash.as_slice();

    // GPU tier bias: dedicated GPU machines lean Volt/Drake, others Wisp/Golem.
    let has_dedicated_gpu = gpu_name.is_some();
    let archetype = match (has_dedicated_gpu, b[0] % 4) {
        (true, 0) => Archetype::Volt,
        (true, 1) => Archetype::Drake,
        (true, 2) => Archetype::Volt,
        (true, _) => Archetype::Golem,
        (false, 0) => Archetype::Wisp,
        (false, 1) => Archetype::Golem,
        (false, 2) => Archetype::Wisp,
        (false, _) => Archetype::Drake,
    };

    // Big-RAM machines lean calm; small-RAM lean zippy. Seed still decides.
    let temperament = match (ram_gb >= 24, b[1] % 4) {
        (true, 0) => Temperament::Stoic,
        (true, 1) => Temperament::Dozy,
        (true, 2) => Temperament::Curious,
        (true, _) => Temperament::Stoic,
        (false, 0) => Temperament::Zippy,
        (false, 1) => Temperament::Curious,
        (false, 2) => Temperament::Zippy,
        (false, _) => Temperament::Dozy,
    };

    let hue = (u32::from(b[2]) * 360 / 255) as u16;
    let markings = 1 + (b[3] % 4);

    Species {
        archetype,
        temperament,
        hue,
        markings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_hardware_same_species() {
        let a = hatch("Intel Core i7-8700K", 32, Some("NVIDIA GeForce GTX 1080 Ti"));
        let b = hatch("Intel Core i7-8700K", 32, Some("NVIDIA GeForce GTX 1080 Ti"));
        assert_eq!(a.archetype, b.archetype);
        assert_eq!(a.temperament, b.temperament);
        assert_eq!(a.hue, b.hue);
        assert_eq!(a.markings, b.markings);
    }

    #[test]
    fn whitespace_and_case_do_not_change_identity() {
        let a = hatch("Intel Core i7-8700K", 32, Some("NVIDIA GeForce GTX 1080 Ti"));
        let b = hatch("  intel core I7-8700K ", 32, Some("nvidia geforce gtx 1080 ti"));
        assert_eq!(a.hue, b.hue);
        assert_eq!(a.archetype, b.archetype);
    }

    #[test]
    fn different_hardware_differs_somewhere() {
        let a = hatch("Intel Core i7-8700K", 32, Some("NVIDIA GeForce GTX 1080 Ti"));
        let b = hatch("AMD Ryzen 9 7950X", 64, Some("NVIDIA GeForce RTX 4090"));
        let identical = a.archetype == b.archetype
            && a.temperament == b.temperament
            && a.hue == b.hue
            && a.markings == b.markings;
        assert!(!identical, "distinct machines should hatch distinct creatures");
    }

    #[test]
    fn hue_is_valid() {
        let s = hatch("Any CPU", 8, None);
        assert!(s.hue < 360);
    }

    #[test]
    fn markings_in_range() {
        let s = hatch("Any CPU", 8, None);
        assert!((1..=4).contains(&s.markings));
    }
}