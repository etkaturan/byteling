//! The save file. One versioned JSON document that everything durable lives
//! in: who the user is, when the pet hatched, what's been said, what mattered.
//!
//! Design notes worth keeping:
//! - `schema_version` from day one, so migrations (and future sync) have
//!   something to negotiate with rather than guessing at shape.
//! - `pet_id` is stable and opaque, so a future account can claim this pet
//!   without identity confusion.
//! - The whole thing is ONE serializable document — which means it's already
//!   the sync payload if that day comes.
//! - This file, not the OS install date, is the source of truth for age. It
//!   survives a Windows reinstall; a registry key does not.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub const SCHEMA_VERSION: u32 = 1;

/// How the user wants to be known. Ships empty — the pet says "you" until
/// told otherwise, rather than guessing at a name.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UserProfile {
    #[serde(default)]
    pub name: String,
    /// Freeform. The escape hatch for everything we didn't think to model —
    /// cheap to build, and users can teach the pet anything without us
    /// predicting the field.
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Speaker {
    User,
    Pet,
}

/// One verbatim turn of conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatTurn {
    pub at: String, // RFC3339
    pub who: Speaker,
    pub text: String,
}

/// A digest of chat that's aged out of the verbatim window. Keeps the shape
/// of what happened without the token cost of every word — and doubles as
/// raw material for the weekly letter.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatDigest {
    pub from: String, // RFC3339
    pub to: String,   // RFC3339
    pub summary: String,
    pub turns: usize,
}

/// Something the pet said that shouldn't evaporate with the speech bubble.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboxItem {
    pub id: String,
    pub at: String, // RFC3339
    pub text: String,
    /// Whether the user has actually seen it. The pet reads this so it stops
    /// talking over things that never landed.
    #[serde(default)]
    pub seen: bool,
}

/// A care action, for history and for evolution's condition score.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareEvent {
    pub at: String, // RFC3339
    pub kind: String,
    #[serde(default)]
    pub freed_mb: u64,
}

/// A day's mood, rolled up. A year of daily summaries is small; a year of
/// five-second samples is not.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodDay {
    pub day: String, // YYYY-MM-DD
    pub avg_score: f32,
    pub worst_mood: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveFile {
    pub schema_version: u32,
    pub pet_id: String,
    pub hatched_at: String, // RFC3339
    #[serde(default)]
    pub profile: UserProfile,
    #[serde(default)]
    pub chat: Vec<ChatTurn>,
    #[serde(default)]
    pub digests: Vec<ChatDigest>,
    #[serde(default)]
    pub inbox: Vec<InboxItem>,
    #[serde(default)]
    pub care: Vec<CareEvent>,
    #[serde(default)]
    pub mood_days: Vec<MoodDay>,
    #[serde(default)]
    pub sessions: u32,
}

impl SaveFile {
    fn new_hatched() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            pet_id: new_id(),
            hatched_at: now_rfc3339(),
            profile: UserProfile::default(),
            chat: Vec::new(),
            digests: Vec::new(),
            inbox: Vec::new(),
            care: Vec::new(),
            mood_days: Vec::new(),
            sessions: 0,
        }
    }
}

/// Cheap unique id — no uuid dependency for something only ever compared for
/// equality.
fn new_id() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos:x}")
}

pub fn now_rfc3339() -> String {
    // Minimal RFC3339 in UTC, no chrono dependency.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (y, mo, d, h, mi, s) = civil_from_unix(secs as i64);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}

/// Days-from-civil, inverted. Standard algorithm, no dependency needed.
fn civil_from_unix(secs: i64) -> (i64, u32, u32, u32, u32, u32) {
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let (h, mi, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);

    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d, h as u32, mi as u32, s as u32)
}

pub struct SaveStore {
    path: PathBuf,
    data: Mutex<SaveFile>,
}

impl SaveStore {
    /// Loads the save, or hatches a new one on first run. A corrupt file is
    /// moved aside rather than deleted — losing a pet's whole history to a
    /// parse error would be unforgivable.
    pub fn load(app: &tauri::AppHandle) -> Self {
        let dir = app
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("save.json");

        let data = match fs::read_to_string(&path) {
            Ok(text) => match serde_json::from_str::<SaveFile>(&text) {
                Ok(mut save) => {
                    save.schema_version = migrate(save.schema_version);
                    save
                }
                Err(e) => {
                    eprintln!("save: corrupt ({e}); starting fresh, old file kept as save.corrupt.json");
                    let _ = fs::rename(&path, dir.join("save.corrupt.json"));
                    SaveFile::new_hatched()
                }
            },
            Err(_) => SaveFile::new_hatched(),
        };

        let store = Self {
            path,
            data: Mutex::new(data),
        };
        store.mutate(|s| s.sessions += 1);
        store
    }

    pub fn read(&self) -> SaveFile {
        self.data.lock().unwrap().clone()
    }

    /// Mutate and persist. Writes are small and infrequent enough that
    /// write-through beats the complexity of a flush timer.
    /// Mutate and persist. Writes are small and infrequent enough that
    /// write-through beats the complexity of a flush timer.
    pub fn mutate<F: FnOnce(&mut SaveFile)>(&self, f: F) {
        let mut guard = self.data.lock().unwrap();
        f(&mut guard);
        if let Ok(text) = serde_json::to_string_pretty(&*guard) {
            let _ = fs::write(&self.path, text);
        }
    }
}

/// Nothing to migrate yet — but the hook exists from v1 so the first real
/// migration isn't also a refactor.
fn migrate(from: u32) -> u32 {
    if from != SCHEMA_VERSION {
        eprintln!("save: schema {from} -> {SCHEMA_VERSION}");
    }
    SCHEMA_VERSION
}