//! Personality — turns a situation into a spoken line. Provider-agnostic so
//! we can add local models later. Groq is the first (and only) provider now.
//! See docs/ARCHITECTURE.md §8.

mod groq;

pub use groq::GroqProvider;

/// The compact situation we describe to the voice provider. Only these fields
/// ever leave the machine — never file names, window titles, or screen content.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SpeechContext {
    pub creature: String,
    pub mood: String,
    pub event: String,
    pub hour: u8,
    pub hint: String,
    /// The app just focused, if this is an activity event (e.g. "VS Code").
    #[serde(default)]
    pub app: String,
    /// Recent apps, most recent last (e.g. ["Chrome", "Discord", "VS Code"]).
    #[serde(default)]
    pub recent_apps: Vec<String>,
    /// Whether the user is rapidly switching apps ("dizzy").
    #[serde(default)]
    pub dizzy: bool,
    /// What the user is called, if they've said. Empty means "you".
    #[serde(default)]
    pub user_name: String,
    /// Freeform facts the user wants the pet to always know.
    #[serde(default)]
    pub user_notes: String,
}


/// Anything that can voice a line. Async because it may hit the network.
pub trait VoiceProvider: Send + Sync {
    fn speak(
        &self,
        ctx: &SpeechContext,
    ) -> impl std::future::Future<Output = Option<String>> + Send;
}