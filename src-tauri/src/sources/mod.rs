// ==============================================================
// HashMeterAi — Source adapter trait and registry
//
// Adding a tool = one file + one line in registry().
// ==============================================================

use crate::model::UsageEvent;
use std::path::{Path, PathBuf};

pub mod claude;
pub mod cline;
pub mod codex;
pub mod hashcerebrum;
pub mod hashcortx;
pub mod kimi;
pub mod qwen;
pub mod routed;
pub mod usage_log;

pub struct ScanCtx<'a> {
    pub home: &'a Path,
}

/// Map a model id to the dashboard source it belongs to. Models from other
/// providers used through Claude Code (Anthropic-compatible base URL) get their
/// own tab instead of being lumped under Claude. Anything unrecognized stays
/// "claude" (Claude Code's own models).
pub fn source_for_model(model: &str) -> &'static str {
    let m = model.to_ascii_lowercase();
    if m.contains("glm") {
        "glm"
    } else if m.contains("minimax") {
        "minimax"
    } else if m.starts_with("gemini") {
        "gemini"
    } else {
        "claude"
    }
}

pub trait Source: Sync {
    fn id(&self) -> &'static str;
    fn label(&self) -> &'static str;
    fn detect(&self, ctx: &ScanCtx) -> bool;
    fn scan(&self, ctx: &ScanCtx) -> Vec<UsageEvent>;
    /// The candidate filesystem roots this adapter looks at, for the Settings
    /// diagnostics panel. Default empty.
    fn roots(&self, ctx: &ScanCtx) -> Vec<PathBuf> {
        let _ = ctx;
        Vec::new()
    }
}

pub fn registry() -> Vec<Box<dyn Source>> {
    vec![
        Box::new(claude::Claude),
        Box::new(codex::Codex),
        Box::new(kimi::Kimi),
        Box::new(hashcortx::HashCortx),
        Box::new(hashcerebrum::HashCerebrum),
        Box::new(qwen::Qwen),
        Box::new(cline::Cline),
        // Provider models routed out of Claude Code into their own tabs.
        Box::new(routed::Routed { id: "glm", label: "GLM (Z.ai)" }),
        Box::new(routed::Routed { id: "minimax", label: "MiniMax" }),
        Box::new(routed::Routed { id: "gemini", label: "Gemini" }),
    ]
}
