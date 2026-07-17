mod sensors;
mod sim;
mod care;
mod personality;

use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::Instant;
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

/// Anchor for all cursor-idle timing — monotonic, so it can't be confused by
/// wall-clock jumps (NTP sync, DST).
static PROCESS_START: OnceLock<Instant> = OnceLock::new();
/// Millis since PROCESS_START of the last real cursor movement anywhere.
/// Stamped on the very first loop tick too, so idle time is always a real,
/// well-defined duration from launch rather than an ambiguous sentinel.
static LAST_CURSOR_MOVE_MS: AtomicU64 = AtomicU64::new(0);
/// Last cursor position, packed, so we only stamp on actual movement.
static LAST_CURSOR_KEY: AtomicU64 = AtomicU64::new(u64::MAX);

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
    let start = *PROCESS_START.get_or_init(Instant::now);
    let now_ms = start.elapsed().as_millis() as u64;
    let last_move_ms = LAST_CURSOR_MOVE_MS.load(Ordering::Relaxed);
    now_ms.saturating_sub(last_move_ms)
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

fn loadout_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    let _ = fs::create_dir_all(&dir);
    Some(dir.join("loadout.json"))
}

/// One equipped item id per slot ("headwear"/"accessory"/"handtool"/"back"),
/// stored as a flat JSON object. Empty object if nothing is equipped yet.
#[tauri::command]
fn get_loadout(app: tauri::AppHandle) -> serde_json::Value {
    loadout_path(&app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

#[tauri::command]
fn set_loadout(app: tauri::AppHandle, loadout: serde_json::Value) -> Result<(), String> {
    if let Some(path) = loadout_path(&app) {
        let text = serde_json::to_string(&loadout).map_err(|e| e.to_string())?;
        fs::write(path, text).map_err(|e| e.to_string())?;
    }
    let _ = app.emit("loadout-changed", loadout);
    Ok(())
}

/// Friendly display name for a known executable, else a cleaned-up fallback.
/// Unknown apps get a readable name rather than a wrong one — the pet should
/// never sound confidently mistaken about what you're using.
fn pretty_app_name(exe: &str) -> String {
    let name = match exe {
        // Editors / dev
        "code.exe" => "VS Code",
        "cursor.exe" => "Cursor",
        "devenv.exe" => "Visual Studio",
        "rider64.exe" => "Rider",
        "idea64.exe" => "IntelliJ",
        "pycharm64.exe" => "PyCharm",
        "webstorm64.exe" => "WebStorm",
        "clion64.exe" => "CLion",
        "rustrover64.exe" => "RustRover",
        "goland64.exe" => "GoLand",
        "sublime_text.exe" => "Sublime Text",
        "notepad++.exe" => "Notepad++",
        "atom.exe" => "Atom",
        "windowsterminal.exe" | "wt.exe" => "Terminal",
        "powershell.exe" | "pwsh.exe" => "PowerShell",
        "cmd.exe" => "Command Prompt",
        "git-bash.exe" | "mintty.exe" => "Git Bash",
        "docker desktop.exe" => "Docker",
        "postman.exe" => "Postman",
        "insomnia.exe" => "Insomnia",
        "datagrip64.exe" => "DataGrip",
        "ssms.exe" => "SQL Server Management Studio",
        "unity.exe" | "unityhub.exe" => "Unity",
        "unrealeditor.exe" => "Unreal Engine",
        "godot.exe" => "Godot",
        "obsidian.exe" => "Obsidian",

        // Browsers
        "chrome.exe" => "Chrome",
        "firefox.exe" => "Firefox",
        "msedge.exe" => "Edge",
        "brave.exe" => "Brave",
        "opera.exe" | "opera_gx.exe" => "Opera",
        "vivaldi.exe" => "Vivaldi",
        "arc.exe" => "Arc",
        "zen.exe" => "Zen",
        "tor.exe" | "firefox.exe.tor" => "Tor Browser",

        // Chat / comms
        "discord.exe" | "discordptb.exe" | "discordcanary.exe" => "Discord",
        "slack.exe" => "Slack",
        "teams.exe" | "ms-teams.exe" => "Teams",
        "telegram.exe" => "Telegram",
        "whatsapp.exe" => "WhatsApp",
        "signal.exe" => "Signal",
        "zoom.exe" => "Zoom",
        "skype.exe" => "Skype",
        "thunderbird.exe" => "Thunderbird",
        "outlook.exe" => "Outlook",
        "claude.exe" => "Claude",

        // Media
        "spotify.exe" => "Spotify",
        "vlc.exe" => "VLC",
        "mpc-hc64.exe" | "mpc-hc.exe" => "MPC-HC",
        "mpv.exe" => "mpv",
        "wmplayer.exe" => "Windows Media Player",
        "itunes.exe" => "iTunes",
        "audacity.exe" => "Audacity",
        "obs64.exe" | "obs32.exe" => "OBS",

        // Games / launchers
        "steam.exe" | "steamwebhelper.exe" => "Steam",
        "cs2.exe" => "Counter-Strike 2",
        "dota2.exe" => "Dota 2",
        "valorant.exe" | "valorant-win64-shipping.exe" => "Valorant",
        "leagueclient.exe" | "league of legends.exe" => "League of Legends",
        "riotclientux.exe" => "Riot Client",
        "epicgameslauncher.exe" => "Epic Games",
        "battle.net.exe" => "Battle.net",
        "goggalaxy.exe" => "GOG Galaxy",
        "eadesktop.exe" | "origin.exe" => "EA App",
        "ubisoftconnect.exe" | "upc.exe" => "Ubisoft Connect",
        "minecraft.exe" | "minecraftlauncher.exe" => "Minecraft",
        "factorio.exe" => "Factorio",
        "stardew valley.exe" => "Stardew Valley",
        "rocketleague.exe" => "Rocket League",
        "gta5.exe" => "GTA V",
        "eldenring.exe" => "Elden Ring",

        // Creative
        "photoshop.exe" => "Photoshop",
        "illustrator.exe" => "Illustrator",
        "afterfx.exe" => "After Effects",
        "premiere.exe" | "adobe premiere pro.exe" => "Premiere Pro",
        "blender.exe" => "Blender",
        "figma.exe" => "Figma",
        "krita.exe" => "Krita",
        "gimp-2.10.exe" | "gimp.exe" => "GIMP",
        "inkscape.exe" => "Inkscape",
        "aseprite.exe" => "Aseprite",
        "davinci resolve.exe" | "resolve.exe" => "DaVinci Resolve",

        // Office / system
        "winword.exe" => "Word",
        "excel.exe" => "Excel",
        "powerpnt.exe" => "PowerPoint",
        "onenote.exe" => "OneNote",
        "acrobat.exe" | "acrord32.exe" => "Acrobat",
        "notion.exe" => "Notion",
        "explorer.exe" => "File Explorer",
        "notepad.exe" => "Notepad",
        "calc.exe" => "Calculator",
        "taskmgr.exe" => "Task Manager",
        "systemsettings.exe" => "Settings",
        "7zfm.exe" => "7-Zip",
        "winrar.exe" => "WinRAR",

        other => {
            // Unknown: clean the exe name into something readable —
            // "my_cool_app.exe" → "My Cool App".
            let base = other.strip_suffix(".exe").unwrap_or(other);
            let base = base.trim_end_matches(|c: char| c.is_ascii_digit());
            let cleaned: String = base
                .split(|c| c == '_' || c == '-' || c == '.')
                .filter(|part| !part.is_empty())
                .map(|part| {
                    let mut chars = part.chars();
                    match chars.next() {
                        Some(first) => {
                            first.to_uppercase().collect::<String>() + chars.as_str()
                        }
                        None => String::new(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");
            return if cleaned.is_empty() {
                "something".to_string()
            } else {
                cleaned
            };
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
                        let start = *PROCESS_START.get_or_init(Instant::now);
                        LAST_CURSOR_MOVE_MS.store(
                            start.elapsed().as_millis() as u64,
                            Ordering::Relaxed,
                        );
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

            // Foreground-app awareness. Windows notifies us the instant focus
            // changes — no polling tick, so reactions are immediate and the
            // app idles at zero cost. We emit on every focus change (not just
            // category changes) so the pet can name the specific app.
            let fg_handle = app.handle().clone();
            std::thread::spawn(move || {
                let last_exe = Mutex::new(String::new());
                sensors::watch_foreground(Box::new(move || {
                    if let Some((exe, activity, fullscreen)) = sensors::foreground() {
                        let mut guard = match last_exe.lock() {
                            Ok(g) => g,
                            Err(_) => return,
                        };
                        if *guard == exe {
                            return; // same app regaining focus; ignore
                        }
                        *guard = exe.clone();
                        let payload = serde_json::json!({
                            "app": pretty_app_name(&exe),
                            "activity": activity,
                            "fullscreen": fullscreen,
                        });
                        let _ = fg_handle.emit("activity-changed", payload);
                    }
                }));
            });

            // Closing the clinic (the X button) would otherwise destroy the
            // window; the tray's "Open clinic" only shows an EXISTING window,
            // so a destroyed one could never be reopened without a restart.
            // Hide instead, so the tray can always bring it back.
            if let Some(clinic_window) = app.get_webview_window("clinic") {
                let clinic_window_clone = clinic_window.clone();
                clinic_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = clinic_window_clone.hide();
                    }
                });
            }

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
            get_loadout,
            set_loadout,
            set_hit_rects
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}