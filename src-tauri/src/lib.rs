// ==============================================================
// HashMeterAi — Rust library entry point
// ==============================================================

mod aggregate;
mod model;
mod rates;
mod scan;
mod sources;
mod store;

use model::Snapshot;
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
        let mut p = get_profile(app);
        p.name = name;
        store.set("profile", serde_json::to_value(&p).unwrap_or_default());
        let _ = store.save();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![scan_usage, get_profile, set_name])
        .run(tauri::generate_context!())
        .expect("error while running HashMeterAi");
}
