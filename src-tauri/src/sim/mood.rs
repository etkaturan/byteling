use super::Needs;

/// The pet's overall condition, derived from its needs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum Mood {
    Thriving,
    Content,
    Uneasy,
    Unwell,
    Critical,
}

/// Blend of needs, dominated by the worst one: a pet with four perfect
/// needs and one critical need is suffering, not "fine on average".
pub fn mood_score(needs: &Needs) -> f32 {
    let values = needs.available();
    let worst = values.iter().copied().fold(f32::INFINITY, f32::min);
    let avg = values.iter().sum::<f32>() / values.len() as f32;
    0.6 * worst + 0.4 * avg
}

pub fn mood_band(score: f32) -> Mood {
    match score {
        s if s >= 85.0 => Mood::Thriving,
        s if s >= 65.0 => Mood::Content,
        s if s >= 45.0 => Mood::Uneasy,
        s if s >= 25.0 => Mood::Unwell,
        _ => Mood::Critical,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn needs(comfort: f32, space: f32, rest: f32, energy: f32) -> Needs {
        Needs {
            comfort,
            space: Some(space),
            tidiness: None,
            rest,
            energy,
        }
    }

    #[test]
    fn perfect_needs_are_thriving() {
        let score = mood_score(&needs(100.0, 100.0, 100.0, 100.0));
        assert_eq!(mood_band(score), Mood::Thriving);
    }

    #[test]
    fn one_critical_need_dominates() {
        // Everything perfect except space at zero — must NOT average out to fine.
        let score = mood_score(&needs(100.0, 0.0, 100.0, 100.0));
        assert!(score < 45.0, "score was {score}, worst need must dominate");
    }

    #[test]
    fn uniformly_mediocre_is_uneasy() {
        let score = mood_score(&needs(50.0, 50.0, 50.0, 50.0));
        assert_eq!(mood_band(score), Mood::Uneasy);
    }

    #[test]
    fn absent_needs_are_ignored_not_zero() {
        // tidiness = None and here space = None too: only 3 needs count.
        let n = Needs {
            comfort: 90.0,
            space: None,
            tidiness: None,
            rest: 90.0,
            energy: 90.0,
        };
        assert!(mood_score(&n) > 85.0);
    }
}