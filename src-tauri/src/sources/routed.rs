// ==============================================================
// HashMeterAi — Routed (virtual) sources
//
// GLM (Z.ai), MiniMax, and Gemini are commonly used *through* Claude Code via
// an Anthropic-compatible base URL (ANTHROPIC_BASE_URL), so their usage lands
// in ~/.claude with model ids like "glm-4.6" / "MiniMax-M2". These virtual
// sources don't read any files themselves — the Claude adapter routes events to
// them by model family (see `super::source_for_model`) — but they must be
// registered so the aggregator emits a separate dashboard tab for each.
// ==============================================================

use crate::model::UsageEvent;
use crate::sources::{ScanCtx, Source};
use std::path::PathBuf;

pub struct Routed {
    pub id: &'static str,
    pub label: &'static str,
}

impl Source for Routed {
    fn id(&self) -> &'static str {
        self.id
    }

    fn label(&self) -> &'static str {
        self.label
    }

    // These models ride through Claude Code, so they're "available" when Claude
    // Code is installed. Actual presence (a tab with data) depends on whether
    // the Claude adapter routed any events of this family in.
    fn detect(&self, ctx: &ScanCtx) -> bool {
        ctx.home.join(".claude/projects").is_dir()
    }

    fn roots(&self, ctx: &ScanCtx) -> Vec<PathBuf> {
        vec![ctx.home.join(".claude/projects")]
    }

    // No own files — events are routed in from the Claude adapter.
    fn scan(&self, _ctx: &ScanCtx) -> Vec<UsageEvent> {
        Vec::new()
    }
}
