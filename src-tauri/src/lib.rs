mod sensors;
mod sim;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn spawn_sensor_loop() {
    std::thread::spawn(|| {
        let mut sensors = sensors::SensorService::new();
        let mut engine = sim::Engine::new();
        loop {
            std::thread::sleep(std::time::Duration::from_secs(5));
            let snapshot = sensors.sample();
            let state: sim::PetState = engine.tick(&snapshot);
            println!(
                "mood: {:?} ({:.0})  needs: {:?}",
                state.mood, state.mood_score, state.needs
            );
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            spawn_sensor_loop();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}