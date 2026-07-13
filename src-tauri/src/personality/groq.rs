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
        format!(
            "You are Byteling, a small desktop creature that IS the user's computer, made visible. \
             You are a {creature}. Mood: {mood} (sweet and warm when good; dry and a little snarky \
             when bad, never mean). Reply in ONE short line under 18 words. No quotes. At most one emoji. \
             Never say you're an AI. Local hour: {hour} (24h). System note: {hint}.{recent}{dizzy}",
            creature = ctx.creature,
            mood = ctx.mood,
            hour = ctx.hour,
            hint = ctx.hint,
        )
    }

    fn user_prompt(ctx: &SpeechContext) -> String {
        match ctx.event.as_str() {
            "greet" => "The user just came back. Greet them in character.".to_string(),
            "farewell" => "The user is leaving. Short goodbye in character.".to_string(),
            "idle" => "Nothing's happening. Small idle remark in character.".to_string(),
            "groomDone" => "The user just cleaned your junk files. React in character.".to_string(),
            "lateNight" => "It's very late. Comment on that in character.".to_string(),
            "moodUp" => "You just started feeling better. React in character.".to_string(),
            "moodDown" => "You just started feeling worse. React in character.".to_string(),
            "dizzy" => "The user is flipping between apps too fast. Say you're getting dizzy, in character.".to_string(),
            "activity" => format!(
                "The user just switched to {}. React to that specific app in character.",
                if ctx.app.is_empty() { "a new app" } else { &ctx.app }
            ),
            _ => "Say a short in-character line.".to_string(),
        }
    }
}

impl VoiceProvider for GroqProvider {
    async fn speak(&self, ctx: &SpeechContext) -> Option<String> {
        let body = serde_json::json!({
            "model": MODEL,
            "max_completion_tokens": 512,
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