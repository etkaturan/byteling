//! Personality — turns a situation into a spoken line. Provider-agnostic so
//! we can add local models later. Groq is the first (and only) provider now.
//! See docs/ARCHITECTURE.md §8.

mod groq;

pub use groq::GroqProvider;

/// The compact situation we describe to the voice provider. Only these fields
/// ever leave the machine — never file names, window titles, or screen content.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SpeechContext {
    /// e.g. "Grounded Elder" — the creature's identity.
    pub creature: String,
    /// Current mood, e.g. "Unwell".
    pub mood: String,
    /// What just happened, e.g. "greet", "idle", "groomDone", "lateNight".
    pub event: String,
    /// Local hour 0–23, so the pet can be time-aware.
    pub hour: u8,
    /// A short factual hint about system state, e.g. "disk nearly full".
    pub hint: String,
}

/// Anything that can voice a line. Async because it may hit the network.
pub trait VoiceProvider: Send + Sync {
    fn speak(
        &self,
        ctx: &SpeechContext,
    ) -> impl std::future::Future<Output = Option<String>> + Send;
}