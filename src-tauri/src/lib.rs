mod sensors;
mod sim;
mod care;
mod personality;

use std::sync::Mutex;
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

/// Path to the file where the Groq key is stored (in the OS config dir).
fn key_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    let _ = fs::create_dir_all(&dir);
    Some(dir.join("groq_key.txt"))
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

            // Click-through management: the window ignores the mouse except
            // when the cursor is over the creature's hit zone.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_ignore_cursor_events(true);
            }

            let cursor_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut interactive = false;
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(120));
                    let Some(window) = cursor_handle.get_webview_window("main") else {
                        continue;
                    };
                    let cursor = match cursor_handle.cursor_position() {
                        Ok(c) => c,
                        Err(_) => continue,
                    };
                    let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size())
                    else {
                        continue;
                    };

                    // Hit zone: the region where the blob lives, as
                    // fractions of the window (device-pixel safe).
                    let w = size.width as f64;
                    let h = size.height as f64;
                    let x = cursor.x - pos.x as f64;
                    let y = cursor.y - pos.y as f64;
                    let inside =
                        x > 0.12 * w && x < 0.88 * w && y > 0.42 * h && y < 1.0 * h;

                    if inside != interactive {
                        interactive = inside;
                        let _ = window.set_ignore_cursor_events(!interactive);
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
                    } else {
                        println!("fg: no foreground detected");
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
            speak
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}