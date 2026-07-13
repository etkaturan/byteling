//! One-time machine facts used for species genesis: is it a laptop, and
//! roughly how old is it. Both are best-effort and never fatal.

/// True if the system reports at least one battery → treat as a laptop.
pub fn has_battery() -> bool {
    match battery::Manager::new() {
        Ok(manager) => match manager.batteries() {
            Ok(mut iter) => iter.next().is_some(),
            Err(_) => false,
        },
        Err(_) => false,
    }
}

/// Rough machine age in years, estimated from the OS install time.
/// Returns `None` if it can't be determined.
#[cfg(windows)]
pub fn machine_age_years() -> Option<f32> {
    use std::process::Command;
    // Query the registry for the OS install date (Unix seconds).
    let output = Command::new("reg")
        .args([
            "query",
            r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion",
            "/v",
            "InstallDate",
        ])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    // Line looks like: "    InstallDate    REG_DWORD    0x5f5e1000"
    let hex = text
        .lines()
        .find(|l| l.contains("InstallDate"))?
        .split_whitespace()
        .last()?
        .trim_start_matches("0x")
        .to_string();
    let install_secs = i64::from_str_radix(&hex, 16).ok()?;

    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs() as i64;

    let age_secs = (now_secs - install_secs).max(0);
    Some(age_secs as f32 / (365.25 * 24.0 * 3600.0))
}

#[cfg(not(windows))]
pub fn machine_age_years() -> Option<f32> {
    None
}