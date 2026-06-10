// ==============================================================
// HashMeterAi — Persistent store (tauri-plugin-store)
//
// Holds: name, prefs, unlocked achievements.
// Minimal stub for Phase 0; expanded in Phase 1+.
// ==============================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Profile {
    pub name: String,
    pub created_at: Option<String>,
    pub prefs: Prefs,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Prefs {
    pub reduced_motion: bool,
    pub default_range: String,
}
