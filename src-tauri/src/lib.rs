mod sensors;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn spawn_sensor_loop() {
    std::thread::spawn(|| {
        let mut poller = sensors::SystemPoller::new();
        loop {
            // Sleep first: gives the CPU baseline time to become meaningful.
            std::thread::sleep(std::time::Duration::from_secs(5));
            let snapshot = poller.sample();
            println!("{snapshot:#?}");
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