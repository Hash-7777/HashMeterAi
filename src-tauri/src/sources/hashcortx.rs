// ==============================================================
// HashMeterAi — HashCortX adapter
//
// HashCortX is a web-based AI agent; it does not write local
// token usage files. We detect the ~/.hashcortx/ directory and
// report presence, but return zero events because token data
// lives in the app's localStorage / web context.
// ==============================================================

use crate::model::UsageEvent;
use crate::sources::{ScanCtx, Source};

pub struct HashCortX;

impl Source for HashCortX {
    fn id(&self) -> &'static str {
        "hashcortx"
    }

    fn label(&self) -> &'static str {
        "HashCortX"
    }

    fn detect(&self, ctx: &ScanCtx) -> bool {
        ctx.home.join(".hashcortx").is_dir()
    }

    fn scan(&self, _ctx: &ScanCtx) -> Vec<UsageEvent> {
        // HashCortX does not persist token usage to local files.
        Vec::new()
    }
}
