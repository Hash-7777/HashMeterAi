// ==============================================================
// HashMeterAi — HashCerebrum adapter (MEASURED)
//
// HashCerebrum records the REAL token usage of every model response to
// a usage.jsonl in its Tauri app-data dir (one JSON line per response,
// token counts only — the HashMeter ecosystem contract). This adapter
// reads that log, so HashCerebrum tokens are counted as measured.
// ==============================================================

use crate::model::UsageEvent;
use crate::sources::usage_log::read_usage_log;
use crate::sources::{ScanCtx, Source};
use std::path::PathBuf;

pub struct HashCerebrum;

const APP_ID: &str = "com.hashcerebrum.desktop";

/// The Tauri app-data `usage.jsonl`, resolved per-OS so the integration works
/// on any user's machine (macOS / Linux / Windows).
fn log_paths(ctx: &ScanCtx) -> Vec<PathBuf> {
    let h = ctx.home;
    vec![
        h.join("Library/Application Support")
            .join(APP_ID)
            .join("usage.jsonl"), // macOS
        h.join(".local/share").join(APP_ID).join("usage.jsonl"), // Linux (XDG)
        h.join("AppData/Roaming").join(APP_ID).join("usage.jsonl"), // Windows
    ]
}

impl Source for HashCerebrum {
    fn id(&self) -> &'static str {
        "hashcerebrum"
    }

    fn label(&self) -> &'static str {
        "HashCerebrum"
    }

    fn detect(&self, ctx: &ScanCtx) -> bool {
        log_paths(ctx).iter().any(|p| p.is_file())
    }

    fn scan(&self, ctx: &ScanCtx) -> Vec<UsageEvent> {
        read_usage_log(&log_paths(ctx), "hashcerebrum")
    }

    fn roots(&self, ctx: &ScanCtx) -> Vec<PathBuf> {
        log_paths(ctx)
    }
}
