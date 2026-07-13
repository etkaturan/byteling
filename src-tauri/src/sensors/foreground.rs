//! Detects which application is currently focused — by executable name only,
//! never window title or content. Privacy-safe by construction.

/// A coarse category for the focused app, used to pick reactions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum Activity {
    Coding,
    Gaming,
    Browsing,
    Media,
    Other,
}

/// Returns (executable_name, activity, is_fullscreen) for the focused window.
#[cfg(windows)]
pub fn foreground() -> Option<(String, Activity, bool)> {
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId,
    };
    use windows::Win32::System::ProcessStatus::GetModuleFileNameExW;

    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }

        // Which process owns this window?
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }

        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;

        let mut buf = [0u16; 260];
        let len = GetModuleFileNameExW(Some(handle.into()), None, &mut buf);
        if len == 0 {
            return None;
        }
        let full = String::from_utf16_lossy(&buf[..len as usize]);
        // Just the exe name, lowercased.
        let exe = full
            .rsplit(['\\', '/'])
            .next()
            .unwrap_or(&full)
            .to_lowercase();

        // Is the focused window roughly fullscreen? (covers the whole screen)
        let is_fullscreen = {
            let mut rect = RECT::default();
            if GetWindowRect(hwnd, &mut rect).is_ok() {
                let w = rect.right - rect.left;
                let h = rect.bottom - rect.top;
                w >= 1900 && h >= 1050 // good-enough heuristic for 1080p+
            } else {
                false
            }
        };

        Some((exe.clone(), classify(&exe), is_fullscreen))
    }
}

#[cfg(not(windows))]
pub fn foreground() -> Option<(String, Activity, bool)> {
    None
}

/// Classify an executable name into an activity. Extend freely.
fn classify(exe: &str) -> Activity {
    const CODING: &[&str] = &["code.exe", "devenv.exe", "rustrover", "idea", "pycharm", "sublime_text.exe", "windowsterminal.exe", "cursor.exe"];
    const BROWSING: &[&str] = &["chrome.exe", "firefox.exe", "msedge.exe", "brave.exe", "opera.exe", "arc.exe"];
    const MEDIA: &[&str] = &["vlc.exe", "spotify.exe", "mpc-hc64.exe", "wmplayer.exe"];
    // Gaming is hard to enumerate; we treat common launchers + a fullscreen
    // fallback (handled by caller) as gaming signals.
    const GAMING: &[&str] = &["steam.exe", "steamwebhelper.exe", "epicgameslauncher.exe", "battle.net.exe", "riotclientux.exe"];

    let has = |list: &[&str]| list.iter().any(|p| exe.contains(p));
    if has(CODING) {
        Activity::Coding
    } else if has(GAMING) {
        Activity::Gaming
    } else if has(BROWSING) {
        Activity::Browsing
    } else if has(MEDIA) {
        Activity::Media
    } else {
        Activity::Other
    }
}