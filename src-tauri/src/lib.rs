mod sensors;
mod sim;
mod care;
mod personality;

use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};
use personality::{GroqProvider, SpeechContext, VoiceProvider};
use std::fs;
use std::path::PathBuf;

/// App-wide state available to commands.
struct AppState {
    species: sim::Species,
    specs: MachineSpecs,
    latest: Mutex<Option<sim::PetState>>,
}

#[derive(Clone, serde::Serialize)]
struct MachineSpecs {
    cpu: String,
    ram_gib: u64,
    gpu: Option<String>,
}

/// Wall-clock millis of the last real cursor movement anywhere on screen.
static LAST_CURSOR_MOVE: AtomicU64 = AtomicU64::new(0);
/// Last cursor position, packed, so we only stamp on actual movement.
static LAST_CURSOR_KEY: AtomicU64 = AtomicU64::new(0);

/// Interactive regions, in window-relative logical px, published by the
/// frontend. It knows the pet's real bounds and any open UI; Rust cannot.
static HIT_RECTS: Mutex<Vec<(f64, f64, f64, f64)>> = Mutex::new(Vec::new());

/// Frontend fetches the creature's identity once at startup.
#[tauri::command]
fn get_species(state: tauri::State<AppState>) -> sim::Species {
    state.species.clone()
}

#[tauri::command]
fn preview_groom() -> care::GroomReport {
    care::groom_preview()
}

#[tauri::command]
fn do_groom() -> care::GroomReport {
    care::perform_groom()
}

#[tauri::command]
fn get_specs(state: tauri::State<AppState>) -> MachineSpecs {
    state.specs.clone()
}

#[tauri::command]
fn get_pet_state(state: tauri::State<AppState>) -> Option<sim::PetState> {
    state.latest.lock().unwrap().clone()
}


/// The frontend publishes the regions that should catch the mouse — the pet's
/// live bounds plus any open menu or bubble. Works for any pet shape and any
/// UI, which a hardcoded region in Rust never could.
#[tauri::command]
fn set_hit_rects(rects: Vec<(f64, f64, f64, f64)>) {
    if let Ok(mut guard) = HIT_RECTS.lock() {
        *guard = rects;
    }
}

/// How long since the cursor last moved. The honest "user is away" signal
/// for roaming — the overlay's own mouse events lie, since the transparent
/// window sees the cursor pass over it while you work elsewhere.
#[tauri::command]
fn cursor_idle_ms() -> u64 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let last = LAST_CURSOR_MOVE.load(Ordering::Relaxed);
    if last == 0 {
        0
    } else {
        now.saturating_sub(last)
    }
}

/// Save (or clear) the user's Groq API key.
#[tauri::command]
fn set_groq_key(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let path = key_path(&app).ok_or("no config dir")?;
    fs::write(path, key.trim()).map_err(|e| e.to_string())
}

/// Whether a key is currently stored (so settings can show "connected").
#[tauri::command]
fn has_groq_key(app: tauri::AppHandle) -> bool {
    load_key(&app).is_some()
}

/// Voice a line for the given context. Returns None if no key or the call
/// fails — the frontend then keeps its canned line.
#[tauri::command]
async fn speak(app: tauri::AppHandle, ctx: SpeechContext) -> Option<String> {
    let key = load_key(&app)?;
    let provider = GroqProvider::new(key);
    provider.speak(&ctx).await
}

#[tauri::command]
fn get_active_character(app: tauri::AppHandle) -> String {
    load_active_char(&app)
}

#[tauri::command]
fn set_active_character(app: tauri::AppHandle, id: String) -> Result<(), String> {
    if let Some(path) = active_char_path(&app) {
        fs::write(path, id.trim()).map_err(|e| e.to_string())?;
    }
    // Broadcast so the overlay updates live.
    let _ = app.emit("active-character-changed", id);
    Ok(())
}

#[tauri::command]
fn get_trail_enabled(app: tauri::AppHandle) -> bool {
    trail_path(&app)
        .and_then(|p| fs::read_to_string(p).ok())
        .map(|s| s.trim() == "1")
        .unwrap_or(true) // trails on by default
}

#[tauri::command]
fn set_trail_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    if let Some(path) = trail_path(&app) {
        fs::write(path, if enabled { "1" } else { "0" }).map_err(|e| e.to_string())?;
    }
    let _ = app.emit("trail-enabled-changed", enabled);
    Ok(())
}

/// "still" | "calm" | "playful". Default: still — users opt IN to movement.
#[tauri::command]
fn get_roam_mode(app: tauri::AppHandle) -> String {
    roam_path(&app)
        .and_then(|p| fs::read_to_string(p).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| matches!(s.as_str(), "still" | "calm" | "playful"))
        .unwrap_or_else(|| "still".to_string())
}

#[tauri::command]
fn set_roam_mode(app: tauri::AppHandle, mode: String) -> Result<(), String> {
    if let Some(path) = roam_path(&app) {
        fs::write(path, mode.trim()).map_err(|e| e.to_string())?;
    }
    let _ = app.emit("roam-mode-changed", mode);
    Ok(())
}

/// Path to the file where the Groq key is stored (in the OS config dir).
fn key_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    let _ = fs::create_dir_all(&dir);
    Some(dir.join("groq_key.txt"))
}

fn active_char_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    let _ = fs::create_dir_all(&dir);
    Some(dir.join("active_character.txt"))
}

fn load_active_char(app: &tauri::AppHandle) -> String {
    active_char_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "hardware".to_string())
}

fn load_key(app: &tauri::AppHandle) -> Option<String> {
    let path = key_path(app)?;
    let key = fs::read_to_string(path).ok()?.trim().to_string();
    if key.is_empty() {
        None
    } else {
        Some(key)
    }
}

fn trail_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    let _ = fs::create_dir_all(&dir);
    Some(dir.join("trail_enabled.txt"))
}

fn roam_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    let _ = fs::create_dir_all(&dir);
    Some(dir.join("roam_mode.txt"))
}

/// Friendly display name for a known executable, else a cleaned-up fallback.
fn pretty_app_name(exe: &str) -> String {
    let name = match exe {
        "code.exe" | "cursor.exe" => "VS Code",
        "chrome.exe" => "Chrome",
        "firefox.exe" => "Firefox",
        "msedge.exe" => "Edge",
        "discord.exe" => "Discord",
        "spotify.exe" => "Spotify",
        "steam.exe" => "Steam",
        "cs2.exe" => "Counter-Strike 2",
        "explorer.exe" => "File Explorer",
        "claude.exe" => "Claude",
        "vlc.exe" => "VLC",
        "devenv.exe" => "Visual Studio",
        other => {
            // Strip ".exe", capitalize first letter.
            let base = other.strip_suffix(".exe").unwrap_or(other);
            return base
                .char_indices()
                .map(|(i, c)| if i == 0 { c.to_ascii_uppercase() } else { c })
                .collect();
        }
    };
    name.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let mut sensors = sensors::SensorService::new();
            let id = sensors.hardware_identity();
            let species = sim::hatch(&id);
            println!("🥚 hatched: {species:?}");
            println!(
                "   from: laptop={}, age={:?}yr, cores={}, gpu={:?}",
                id.is_laptop, id.age_years, id.cores, id.gpu
            );
            let specs = MachineSpecs {
                cpu: id.cpu.clone(),
                ram_gib: ((id.ram_gb as f64 * 1_000_000_000.0) / 1_073_741_824.0).round() as u64,
                gpu: id.gpu.clone(),
            };
            app.manage(AppState {
                species: species.clone(),
                specs,
                latest: Mutex::new(None),
            });

            // The sensor→sim loop feeds the UI through events.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut engine = sim::Engine::new();
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    let snapshot = sensors.sample();
                    let state: sim::PetState = engine.tick(&snapshot);
                    if let Some(app_state) = handle.try_state::<AppState>() {
                        *app_state.latest.lock().unwrap() = Some(state.clone());
                    }
                    if let Err(e) = handle.emit("pet-state-changed", &state) {
                        eprintln!("event emit failed: {e}");
                    }
                }
            });

            // Start interactive; the frontend immediately narrows this to the
            // pet's real silhouette on the first mousemove.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_ignore_cursor_events(false);
            }

            // Cursor idle tracking. Click-through is decided by the frontend
            // (see set_interactive) — it can hit-test the pet's real
            // silhouette, so a rectangle here would only steal clicks.
            let cursor_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut interactive = true;
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(60));
                    let cursor = match cursor_handle.cursor_position() {
                        Ok(c) => c,
                        Err(_) => continue,
                    };
                    let key = (((cursor.x as i64) << 32) ^ (cursor.y as i64)) as u64;
                    if LAST_CURSOR_KEY.swap(key, Ordering::Relaxed) != key {
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0);
                        LAST_CURSOR_MOVE.store(now, Ordering::Relaxed);
                    }

                    // Coarse gate: while the cursor is inside the window's
                    // bounds, let events through so the frontend can hit-test
                    // the silhouette. Outside, go fully click-through.
                    let Some(window) = cursor_handle.get_webview_window("main") else {
                        continue;
                    };
                    let Ok(pos) = window.outer_position() else {
                        continue;
                    };
                    // Check the cursor against the regions the frontend
                    // published. Everything else is click-through.
                    let scale = window.scale_factor().unwrap_or(1.0);
                    let rel_x = (cursor.x - pos.x as f64) / scale;
                    let rel_y = (cursor.y - pos.y as f64) / scale;
                    let hit = HIT_RECTS
                        .lock()
                        .map(|rects| {
                            rects.iter().any(|(x, y, w, h)| {
                                rel_x >= *x
                                    && rel_x <= x + w
                                    && rel_y >= *y
                                    && rel_y <= y + h
                            })
                        })
                        .unwrap_or(false);
                    if hit != interactive {
                        interactive = hit;
                        let _ = window.set_ignore_cursor_events(!hit);
                    }
                }
            });

            // Foreground-app awareness: emit when the focused activity changes.
            let fg_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut last: Option<sensors::Activity> = None;
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    if let Some((exe, activity, fullscreen)) = sensors::foreground() {
                        if Some(activity) != last {
                            last = Some(activity);
                            let payload = serde_json::json!({
                                "app": pretty_app_name(&exe),
                                "activity": activity,
                                "fullscreen": fullscreen,
                            });
                            let _ = fg_handle.emit("activity-changed", payload);
                        }
                    }
                }
            });

            let clinic =
                MenuItem::with_id(app, "clinic", "Open clinic", true, None::<&str>)?;
            // System tray: the pet's official residence. Hide/show + quit.
            let toggle =
                MenuItem::with_id(app, "toggle", "Hide / show pet", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Byteling", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&clinic, &toggle, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Byteling")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "clinic" => {
                        if let Some(w) = app.get_webview_window("clinic") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "toggle" => {
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(true) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                            }
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_species,
            get_specs,
            get_pet_state,
            preview_groom,
            do_groom,
            set_groq_key,
            has_groq_key,
            speak,
            get_active_character,
            set_active_character,
            get_trail_enabled,
            set_trail_enabled,
            get_roam_mode,
            set_roam_mode,
            cursor_idle_ms,
            set_hit_rects
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}