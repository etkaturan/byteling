mod sensors;
mod sim;

use tauri::{Emitter, Manager};

/// App-wide state available to commands.
struct AppState {
    species: sim::Species,
}

/// Frontend fetches the creature's identity once at startup.
#[tauri::command]
fn get_species(state: tauri::State<AppState>) -> sim::Species {
    state.species.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let mut sensors = sensors::SensorService::new();
            let (cpu, ram_gb, gpu_name) = sensors.hardware_identity();
            let species = sim::hatch(&cpu, ram_gb, gpu_name.as_deref());
            println!("🥚 hatched: {species:?}");
            app.manage(AppState {
                species: species.clone(),
            });

            // The sensor→sim loop now feeds the UI through events.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut engine = sim::Engine::new();
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    let snapshot = sensors.sample();
                    let state: sim::PetState = engine.tick(&snapshot);
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

                    // Hit zone: the central-lower region where the blob lives,
                    // as fractions of the window (device-pixel safe).
                    let w = size.width as f64;
                    let h = size.height as f64;
                    let x = cursor.x - pos.x as f64;
                    let y = cursor.y - pos.y as f64;
                    let inside =
                        x > 0.22 * w && x < 0.78 * w && y > 0.42 * h && y < 0.92 * h;

                    if inside != interactive {
                        interactive = inside;
                        let _ = window.set_ignore_cursor_events(!interactive);
                    }
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_species])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}