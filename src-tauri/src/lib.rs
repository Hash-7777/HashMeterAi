// ==============================================================
// HashMeterAi — Rust library entry point
// ==============================================================

mod achievements;
mod aggregate;
mod model;
mod persona;
mod rates;
mod scan;
mod sources;
mod store;

use model::Snapshot;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_store::StoreExt;

#[tauri::command]
fn scan_usage() -> Snapshot {
    scan::run()
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
    let snap = scan::run();
    let profile = get_profile(app);
    persona::from_snapshot(&snap, &profile.name)
}

#[tauri::command]
fn get_achievements(app: tauri::AppHandle) -> Vec<achievements::Achievement> {
    let snap = scan::run();
    let profile = get_profile(app.clone());
    let list = achievements::compute(&snap, &profile.achievements);
    // Persist newly unlocked achievements.
    if let Ok(store) = app.store("profile.json") {
        let mut p = profile;
        for a in &list {
            if a.unlocked {
                p.achievements.insert(a.id.clone());
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
        if key.as_str() == "reduced_motion" {
            p.prefs.reduced_motion = value.as_bool().unwrap_or(false);
        }
        store.set("profile", serde_json::to_value(&p).unwrap_or_default());
        let _ = store.save();
    }
}

#[tauri::command]
fn open_data_folder(app: tauri::AppHandle) {
    if let Ok(path) = app.path().app_data_dir() {
        let _ = app.opener().open_path(path.to_string_lossy().to_string(), None::<&str>);
    }
}

#[tauri::command]
fn reset_profile(app: tauri::AppHandle) {
    if let Ok(store) = app.store("profile.json") {
        store.set("profile", serde_json::to_value(store::Profile::default()).unwrap_or_default());
        let _ = store.save();
    }
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
            // place. Show it once that's done.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_usage,
            get_profile,
            set_name,
            get_persona,
            get_achievements,
            set_pref,
            open_data_folder,
            reset_profile
        ])
        .run(tauri::generate_context!())
        .expect("error while running HashMeterAi");
}
