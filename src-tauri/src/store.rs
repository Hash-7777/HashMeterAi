// ==============================================================
// HashMeterAi — Persistent store (tauri-plugin-store)
//
// Holds: name, prefs, unlocked achievements.
// ==============================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub name: String,
    pub created_at: Option<String>,
    pub prefs: Prefs,
}

impl Default for Profile {
    fn default() -> Self {
        Self {
            name: String::new(),
            created_at: None,
            prefs: Prefs::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prefs {
    pub reduced_motion: bool,
    pub default_range: String,
}

impl Default for Prefs {
    fn default() -> Self {
        Self {
            reduced_motion: false,
            default_range: "all".to_string(),
        }
    }
}
