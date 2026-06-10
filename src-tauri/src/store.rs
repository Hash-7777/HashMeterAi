// ==============================================================
// HashMeterAi — Persistent store (tauri-plugin-store)
//
// Holds: name, prefs, unlocked achievements.
// ==============================================================

use serde::{Deserialize, Serialize};

use std::collections::HashSet;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Profile {
    pub name: String,
    pub created_at: Option<String>,
    #[serde(default)]
    pub prefs: Prefs,
    #[serde(default)]
    pub achievements: HashSet<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Prefs {
    pub reduced_motion: bool,
    pub default_range: String,
}
