// ==============================================================
// HashMeterAi — Rust library entry point
// ==============================================================

mod achievements;
mod aggregate;
mod benchmark;
mod model;
mod persona;
mod rates;
mod scan;
mod sources;
mod store;

use model::Snapshot;
use std::fs;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_store::StoreExt;

#[tauri::command]
fn scan_usage() -> Snapshot {
    // Explicit sync / poll: refresh unless a scan finished in the last couple
    // of seconds (coalesces the mount + render burst). The 60s auto-sync is
    // always older than this, so it always gets fresh data.
    scan::cached(2)
}

#[tauri::command]
fn get_diagnostics() -> Vec<scan::SourceDiag> {
    scan::diagnose()
}

#[tauri::command]
fn get_profile(app: tauri::AppHandle) -> store::Profile {
    if let Ok(store) = app.store("profile.json") {
        if let Some(val) = store.get("profile") {
            if let Ok(p) = serde_json::from_value::<store::Profile>(val) {
                return p;
            }
        }
    }
    store::Profile::default()
}

#[tauri::command]
fn set_name(name: String, app: tauri::AppHandle) {
    if let Ok(store) = app.store("profile.json") {
        let mut p: store::Profile = store
            .get("profile")
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();
        p.name = name;
        if p.created_at.is_none() {
            p.created_at = Some(chrono::Local::now().to_rfc3339());
        }
        store.set("profile", serde_json::to_value(&p).unwrap_or_default());
        let _ = store.save();
    }
}

#[tauri::command]
fn get_persona(app: tauri::AppHandle) -> persona::Persona {
    // Cheap read path: reuse the recent scan so opening Persona never
    // re-walks the disk.
    let snap = scan::cached(90);
    let profile = get_profile(app);
    persona::from_snapshot(&snap, &profile.name)
}

#[tauri::command]
fn get_achievements(app: tauri::AppHandle) -> Vec<achievements::Achievement> {
    let snap = scan::cached(90);
    let profile = get_profile(app.clone());
    let list = achievements::compute_with_dates(
        &snap,
        &profile.achievements,
        &profile.achievement_dates,
    );
    // Persist unlocked achievements and their honest earn date. We OVERWRITE the
    // stored date with the computed one (which is history-first), so any bogus
    // "all earned today" stamps written by older builds self-correct to the real
    // first-cross date once this runs.
    if let Ok(store) = app.store("profile.json") {
        let mut p = profile;
        for a in &list {
            if a.unlocked {
                p.achievements.insert(a.id.clone());
                if let Some(date) = &a.earned_date {
                    p.achievement_dates.insert(a.id.clone(), date.clone());
                }
            }
        }
        store.set("profile", serde_json::to_value(&p).unwrap_or_default());
        let _ = store.save();
    }
    list
}

#[tauri::command]
fn set_pref(key: String, value: serde_json::Value, app: tauri::AppHandle) {
    if let Ok(store) = app.store("profile.json") {
        let mut p: store::Profile = store
            .get("profile")
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();
        match key.as_str() {
            "reduced_motion" => p.prefs.reduced_motion = value.as_bool().unwrap_or(false),
            "compact" => p.prefs.compact = value.as_bool().unwrap_or(false),
            "default_range" => {
                if let Some(s) = value.as_str() {
                    if matches!(s, "all" | "30" | "7") {
                        p.prefs.default_range = s.to_string();
                    }
                }
            }
            "accent" => {
                if let Some(s) = value.as_str() {
                    if is_hex_color(s) {
                        p.prefs.accent = s.to_string();
                    }
                }
            }
            "auto_sync_secs" => {
                if let Some(n) = value.as_u64() {
                    // 0 = off (no auto-sync); otherwise clamp to 15s .. 1h.
                    p.prefs.auto_sync_secs = if n == 0 { 0 } else { n.clamp(15, 3600) };
                }
            }
            _ => {}
        }
        store.set("profile", serde_json::to_value(&p).unwrap_or_default());
        let _ = store.save();
    }
}

/// Validate a `#rrggbb` (or `#rgb`) hex color before storing it.
fn is_hex_color(s: &str) -> bool {
    let hex = match s.strip_prefix('#') {
        Some(h) => h,
        None => return false,
    };
    (hex.len() == 3 || hex.len() == 6) && hex.chars().all(|c| c.is_ascii_hexdigit())
}

#[tauri::command]
fn open_data_folder(app: tauri::AppHandle) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create app data dir parent: {e}"))?;
    }
    fs::create_dir_all(&path).map_err(|e| format!("failed to create app data dir: {e}"))?;

    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| format!("failed to open data folder: {e}"))?;
    Ok(())
}

#[tauri::command]
fn reset_profile(app: tauri::AppHandle) {
    if let Ok(store) = app.store("profile.json") {
        store.set("profile", serde_json::to_value(store::Profile::default()).unwrap_or_default());
        let _ = store.save();
    }
}

#[tauri::command]
async fn copy_image_to_clipboard(base64_data: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("base64 decode failed: {e}"))?;

    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("png decode failed: {e}"))?
        .into_rgba8();

    let (width, height) = (img.width() as usize, img.height() as usize);
    let raw = img.into_raw();

    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("clipboard access failed: {e}"))?;

    clipboard
        .set_image(arboard::ImageData {
            width,
            height,
            bytes: std::borrow::Cow::Owned(raw),
        })
        .map_err(|e| format!("clipboard write failed: {e}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Restores the window's last position + size, and saves them on move/resize/close.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            // The window starts hidden (visible:false) so the window-state plugin can
            // restore its saved geometry before the first paint — no flash in the wrong
            // place. But a corrupt/tiny or off-screen saved state would otherwise make
            // the app open as a sliver in the corner, so validate the restored size and
            // fall back to a sane centered default if it's below our minimum.
            if let Some(w) = app.get_webview_window("main") {
                let too_small = match (w.inner_size(), w.scale_factor()) {
                    (Ok(size), Ok(scale)) => {
                        let lw = size.width as f64 / scale;
                        let lh = size.height as f64 / scale;
                        lw < 1000.0 || lh < 640.0
                    }
                    _ => true,
                };
                if too_small {
                    let _ = w.set_size(tauri::LogicalSize::new(1380.0, 860.0));
                    let _ = w.center();
                }
                let _ = w.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_usage,
            get_diagnostics,
            get_profile,
            set_name,
            get_persona,
            get_achievements,
            set_pref,
            open_data_folder,
            reset_profile,
            copy_image_to_clipboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running HashMeterAi");
}
