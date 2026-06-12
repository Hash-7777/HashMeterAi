// ==============================================================
// HashMeterAi — HashCortx adapter (MEASURED)
//
// HashCortx now records the REAL token usage of every model response
// to ~/.hashcortx/usage.jsonl (one JSON line per response, token
// counts only — see the HashMeter ecosystem contract). This adapter
// reads that log, so HashCortx tokens are counted as measured.
//
// (It used to estimate tokens from message text in the WKWebView
// localStorage; that estimation is gone now that real counts exist.)
// ==============================================================

use crate::model::UsageEvent;
use crate::sources::usage_log::read_usage_log;
use crate::sources::{ScanCtx, Source};
use std::path::PathBuf;

pub struct HashCortx;

/// `~/.hashcortx/usage.jsonl` — same home-dir convention as HashCortx's audit log.
fn log_paths(ctx: &ScanCtx) -> Vec<PathBuf> {
    vec![ctx.home.join(".hashcortx").join("usage.jsonl")]
}

impl Source for HashCortx {
    fn id(&self) -> &'static str {
        "hashcortx"
    }

    fn label(&self) -> &'static str {
        "HashCortx"
    }

    fn detect(&self, ctx: &ScanCtx) -> bool {
        log_paths(ctx).iter().any(|p| p.is_file())
    }

    fn scan(&self, ctx: &ScanCtx) -> Vec<UsageEvent> {
        read_usage_log(&log_paths(ctx), "hashcortx")
    }

    fn roots(&self, ctx: &ScanCtx) -> Vec<PathBuf> {
        log_paths(ctx)
    }
}
