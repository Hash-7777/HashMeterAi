// ==============================================================
// HashMeterAi — Persistent store (tauri-plugin-store)
//
// Holds: name, prefs, unlocked achievements.
// ==============================================================

use serde::{Deserialize, Serialize};

use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Profile {
    pub name: String,
    pub created_at: Option<String>,
    #[serde(default)]
    pub prefs: Prefs,
    #[serde(default)]
    pub achievements: HashSet<String>,
    /// First date (YYYY-MM-DD) each achievement id was seen unlocked, so the
    /// Achievements view shows the real earn date rather than "today".
    #[serde(default)]
    pub achievement_dates: HashMap<String, String>,
    /// Bumped when the trophy-unlock metric changes, so stale persisted unlocks
    /// from an older metric are cleared once instead of sticking forever.
    #[serde(default)]
    pub ach_version: u32,
    /// Build id (executable mtime) of the app that last completed onboarding, so
    /// a freshly compiled/installed build re-shows the name prompt.
    #[serde(default)]
    pub build_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prefs {
    #[serde(default)]
    pub reduced_motion: bool,
    /// Default dashboard range: "all" | "30" | "7".
    #[serde(default = "default_range")]
    pub default_range: String,
    /// Accent color as a hex string (e.g. "#FD802E"). Drives the UI theme.
    #[serde(default = "default_accent")]
    pub accent: String,
    /// Auto-sync interval in seconds (how often the dashboard re-scans).
    #[serde(default = "default_sync_secs")]
    pub auto_sync_secs: u64,
    /// Compact density reduces padding so more fits on smaller screens.
    #[serde(default)]
    pub compact: bool,
}

impl Default for Prefs {
    fn default() -> Self {
        Self {
            reduced_motion: false,
            default_range: default_range(),
            accent: default_accent(),
            auto_sync_secs: default_sync_secs(),
            compact: false,
        }
    }
}

fn default_range() -> String {
    "all".to_string()
}

fn default_accent() -> String {
    "#FD802E".to_string()
}

fn default_sync_secs() -> u64 {
    60
}
