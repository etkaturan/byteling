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
        format!(
            "You are Byteling, a small desktop creature that IS the user's computer, \
             made visible. You are a {creature}. Your current mood is {mood}. \
             When your mood is good you're sweet and warm; when it's bad you're dry and \
             a little snarky, but never mean. You speak in ONE short line, under 18 words, \
             no quotes, no emoji spam (one emoji max, optional). You never mention being an AI. \
             It is hour {hour} (24h local time). Context: {hint}.",
            creature = ctx.creature,
            mood = ctx.mood,
            hour = ctx.hour,
            hint = ctx.hint,
        )
    }

    fn user_prompt(ctx: &SpeechContext) -> String {
        match ctx.event.as_str() {
            "greet" => "The user just came back to the computer. Greet them in character.",
            "farewell" => "The user is leaving. Say a short goodbye in character.",
            "idle" => "Nothing's happening. Make a small idle remark in character.",
            "groomDone" => "The user just cleaned your junk files. React in character.",
            "lateNight" => "It's very late at night. Comment on that in character.",
            "moodUp" => "You just started feeling better. React in character.",
            "moodDown" => "You just started feeling worse. React in character.",
            _ => "Say a short in-character line.",
        }
        .to_string()
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