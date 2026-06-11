// ==============================================================
// HashMeterAi — Source adapter trait and registry
//
// Adding a tool = one file + one line in registry().
// ==============================================================

use crate::model::UsageEvent;
use std::path::Path;

pub mod claude;
pub mod cline;
pub mod codex;
pub mod continue_dev;
pub mod kimi;

pub struct ScanCtx<'a> {
    pub home: &'a Path,
}

pub trait Source: Sync {
    fn id(&self) -> &'static str;
    fn label(&self) -> &'static str;
    fn detect(&self, ctx: &ScanCtx) -> bool;
    fn scan(&self, ctx: &ScanCtx) -> Vec<UsageEvent>;
}

pub fn registry() -> Vec<Box<dyn Source>> {
    vec![
        Box::new(claude::Claude),
        Box::new(codex::Codex),
        Box::new(kimi::Kimi),
        Box::new(continue_dev::ContinueDev),
        Box::new(cline::Cline),
    ]
}
