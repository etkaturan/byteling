//! Detects which application is currently focused — by executable name only,
//! never window title or content. Privacy-safe by construction.
//!
//! Focus changes arrive via a Win32 event hook rather than polling: Windows
//! calls us the moment the foreground window changes, so reactions are
//! instant and the app burns no CPU waiting.

use std::sync::OnceLock;

/// Set once at startup; the hook callback can't capture state, so it reads
/// the notifier from here.
static ON_CHANGE: OnceLock<Box<dyn Fn() + Send + Sync>> = OnceLock::new();

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

/// Classify an executable name into an activity. Substring matches, so
/// "idea64.exe" hits "idea". Unknown apps stay Other rather than guessing.
fn classify(exe: &str) -> Activity {
    const CODING: &[&str] = &[
        "code.exe", "cursor.exe", "devenv.exe", "rider", "idea", "pycharm",
        "webstorm", "clion", "rustrover", "goland", "datagrip", "sublime_text",
        "notepad++", "atom.exe", "windowsterminal", "wt.exe", "powershell",
        "pwsh.exe", "cmd.exe", "mintty", "git-bash", "docker", "postman",
        "insomnia", "ssms.exe", "unity", "unreal", "godot",
    ];
    const BROWSING: &[&str] = &[
        "chrome.exe", "firefox.exe", "msedge.exe", "brave.exe", "opera",
        "vivaldi", "arc.exe", "zen.exe", "tor.exe",
    ];
    const MEDIA: &[&str] = &[
        "vlc.exe", "spotify.exe", "mpc-hc", "mpv.exe", "wmplayer", "itunes",
        "audacity", "obs64", "obs32", "resolve.exe", "premiere", "afterfx",
    ];
    const GAMING: &[&str] = &[
        "steam.exe", "steamwebhelper", "epicgameslauncher", "battle.net",
        "riotclientux", "goggalaxy", "eadesktop", "origin.exe",
        "ubisoftconnect", "upc.exe", "cs2.exe", "dota2", "valorant",
        "leagueclient", "league of legends", "minecraft", "factorio",
        "stardew", "rocketleague", "gta5", "eldenring",
    ];

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

/// Windows calls this the instant the foreground window changes.
/// Must be `extern "system"` and capture nothing — hence the global notifier.
#[cfg(windows)]
unsafe extern "system" fn win_event_proc(
    _hook: windows::Win32::UI::Accessibility::HWINEVENTHOOK,
    _event: u32,
    _hwnd: windows::Win32::Foundation::HWND,
    _id_object: i32,
    _id_child: i32,
    _thread: u32,
    _time: u32,
) {
    if let Some(notify) = ON_CHANGE.get() {
        notify();
    }
}

/// Install the foreground hook and pump messages forever. Call from a
/// dedicated thread — the message loop blocks.
#[cfg(windows)]
pub fn watch_foreground(on_change: Box<dyn Fn() + Send + Sync>) {
    use windows::Win32::UI::Accessibility::SetWinEventHook;
    use windows::Win32::UI::WindowsAndMessaging::{
        DispatchMessageW, GetMessageW, TranslateMessage, EVENT_SYSTEM_FOREGROUND,
        MSG, WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
    };

    let _ = ON_CHANGE.set(on_change);

    unsafe {
        let hook = SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            None,
            Some(win_event_proc),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        );
        if hook.is_invalid() {
            eprintln!("foreground hook failed to install");
            return;
        }

        // The hook only fires while this thread pumps messages.
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}

#[cfg(not(windows))]
pub fn watch_foreground(_on_change: Box<dyn Fn() + Send + Sync>) {}