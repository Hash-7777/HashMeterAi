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
pub mod usage_log;

pub struct ScanCtx<'a> {
    pub home: &'a Path,
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
        Box::new(cline::Cline),
    ]
}
