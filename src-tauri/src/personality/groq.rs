//! Groq voice provider. OpenAI-compatible chat endpoint. Fast, small model
//! for one-line replies. The API key is passed in per call — it lives in the
//! app's key store, never in this module and never in the frontend.

use super::{SpeechContext, VoiceProvider};

const ENDPOINT: &str = "https://api.groq.com/openai/v1/chat/completions";
const MODEL: &str = "openai/gpt-oss-20b";

pub struct GroqProvider {
    api_key: String,
    client: reqwest::Client,
}

impl GroqProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: reqwest::Client::new(),
        }
    }

    fn system_prompt(ctx: &SpeechContext) -> String {
        let recent = if ctx.recent_apps.is_empty() {
            String::new()
        } else {
            format!(" Recently the user moved through: {}.", ctx.recent_apps.join(" → "))
        };
        let dizzy = if ctx.dizzy {
            " The user is switching apps very fast and you feel dizzy and a bit overwhelmed."
        } else {
            ""
        };
        let who = if ctx.user_name.is_empty() {
            String::new()
        } else {
            format!("\n\nThe person who owns this machine is called {}. Use their name naturally and rarely — the way you'd think of someone, not the way a salesman says it.", ctx.user_name)
        };
        let notes = if ctx.user_notes.is_empty() {
            String::new()
        } else {
            format!("\n\nThings they've told you about themselves: {}", ctx.user_notes)
        };
        format!(
            "You are Byteling, a small creature that IS this computer, made visible. You are a \
             {creature}. Mood: {mood} — warm and content when good, dry and wry when bad, never mean.\n\
             \n\
             You are NOT in a conversation. Nobody is talking to you. You are muttering to \
             yourself in your own space, and the person happens to overhear. So: never greet \
             them, never ask them questions, never offer to help, never invite a reply. No \
             'how can I help', no 'let me know', no 'what are we working on'. You are not an \
             assistant and never mention being one.\n\
             \n\
             Think of it as a passing thought said out loud. Offhand, not announcements. \
             Observe, complain, notice, enjoy — like a cat would if it could talk. Say the \
             small true thing, not the useful one. Never deliberate or weigh options; the \
             first thing that comes to mind is the right one.\n\
             \n\
             One short line. Local hour: {hour} (24h). Right now: {hint}.{recent}{dizzy}{who}{notes}",
            creature = ctx.creature,
            mood = ctx.mood,
            hour = ctx.hour,
            hint = ctx.hint,
        )
    }

    /// Each of these describes a SITUATION the creature notices — never an
    /// instruction to address anyone. "The screen woke up" produces a mutter;
    /// "greet the user" produces a chatbot.
    fn user_prompt(ctx: &SpeechContext) -> String {
        match ctx.event.as_str() {
            "greet" => "The screen just woke up after a while dark. Mutter something to yourself about being back on.".to_string(),
            "farewell" => "Things are going quiet. Mutter something to yourself about winding down.".to_string(),
            "idle" => "Nothing is happening at all. Mutter some small idle thought to yourself.".to_string(),
            "groomDone" => "Your junk files were just cleared out. Mutter how that felt.".to_string(),
            "lateNight" => "It is the middle of the night and this machine is still on. Mutter about that.".to_string(),
            "moodUp" => "Something just eased and you feel better than you did. Mutter about it.".to_string(),
            "moodDown" => "Something just got worse and you feel it. Mutter about it.".to_string(),
            "dizzy" => "Windows are flying past faster than you can track. Mutter about feeling dizzy.".to_string(),
            "petted" => "Someone just touched you, gently. Mutter your reaction.".to_string(),
            "activity" => format!(
                "{} just came to the front of the screen. Mutter a passing thought about it.",
                if ctx.app.is_empty() { "Some program" } else { &ctx.app }
            ),
            _ => "Mutter a short passing thought.".to_string(),
        }
    }
}

impl VoiceProvider for GroqProvider {
    async fn speak(&self, ctx: &SpeechContext) -> Option<String> {
        let body = serde_json::json!({
            "model": MODEL,
            "max_completion_tokens": 1024,
            "temperature": 0.9,
            "messages": [
                { "role": "system", "content": Self::system_prompt(ctx) },
                { "role": "user", "content": Self::user_prompt(ctx) }
            ]
        });

        let resp = match self
            .client
            .post(ENDPOINT)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                eprintln!("groq: request failed: {e}");
                return None;
            }
        };

        let status = resp.status();
        let text_body = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            eprintln!("groq: HTTP {status} — body: {text_body}");
            return None;
        }

        let json: serde_json::Value = match serde_json::from_str(&text_body) {
            Ok(j) => j,
            Err(e) => {
                eprintln!("groq: bad JSON: {e} — body: {text_body}");
                return None;
            }
        };

        match json["choices"][0]["message"]["content"].as_str() {
            Some(s) if !s.trim().is_empty() => Some(s.trim().trim_matches('"').to_string()),
            _ => {
                eprintln!("groq: no content in response: {json}");
                None
            }
        }
    }
}