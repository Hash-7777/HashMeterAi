// ==============================================================
// HashMeterAi — Scan orchestrator
//
// Detects sources, scans in parallel, aggregates into Snapshot.
//
// A full scan reads and parses every transcript on disk, so it is the
// expensive path. We cache the most recent Snapshot in memory: explicit
// syncs refresh it, but cheap reads (persona, achievements, tab switches)
// reuse it instead of re-walking the filesystem. This is what keeps tab
// changes instant.
// ==============================================================

use crate::aggregate;
use crate::model::Snapshot;
use crate::sources::{ScanCtx, registry};
use rayon::prelude::*;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

struct Cached {
    at: Instant,
    snap: Snapshot,
}

fn cache() -> &'static Mutex<Option<Cached>> {
    static CACHE: OnceLock<Mutex<Option<Cached>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

/// Force a fresh scan of all detected sources and update the cache.
pub fn run() -> Snapshot {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let ctx = ScanCtx { home: &home };

    let events: Vec<_> = registry()
        .par_iter()
        .filter(|src| src.detect(&ctx))
        .flat_map(|src| src.scan(&ctx))
        .collect();

    let snap = aggregate::build(events);
    if let Ok(mut guard) = cache().lock() {
        *guard = Some(Cached {
            at: Instant::now(),
            snap: snap.clone(),
        });
    }
    snap
}

/// Return the cached Snapshot when it is younger than `max_age_secs`,
/// otherwise run a fresh scan. Used by the cheap read paths so opening
/// Persona or Achievements never re-walks the disk.
pub fn cached(max_age_secs: u64) -> Snapshot {
    if let Ok(guard) = cache().lock() {
        if let Some(c) = guard.as_ref() {
            if c.at.elapsed().as_secs() <= max_age_secs {
                return c.snap.clone();
            }
        }
    }
    run()
}

#[derive(Debug, Clone, Serialize)]
pub struct RootDiag {
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SourceDiag {
    pub id: String,
    pub label: String,
    /// Whether the adapter currently detects the tool (a root exists).
    pub detected: bool,
    /// The candidate paths the adapter looks at, with existence.
    pub roots: Vec<RootDiag>,
    pub days: usize,
    pub processed: u64,
    pub messages: u64,
    pub latest: Option<String>,
    pub top_model: Option<String>,
}

/// Per-source diagnostics for the Settings panel: which paths each adapter
/// resolves to (per-user, via home_dir), whether they exist, and what was
/// parsed from them. Stats come from the cached snapshot (no extra disk walk),
/// so it stays cheap. Designed to make "shows 0 for me" debuggable on any
/// machine without exposing any message content.
pub fn diagnose() -> Vec<SourceDiag> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let ctx = ScanCtx { home: &home };
    let snap = cached(90);

    registry()
        .iter()
        .map(|src| {
            let id = src.id();
            let roots = src
                .roots(&ctx)
                .into_iter()
                .map(|p| RootDiag {
                    exists: p.exists(),
                    path: p.display().to_string(),
                })
                .collect();
            let detected = src.detect(&ctx);

            let mut days = 0;
            let mut processed = 0u64;
            let mut messages = 0u64;
            let mut latest: Option<String> = None;
            let mut top_model: Option<String> = None;

            if let Some(t) = snap.tools.get(id) {
                if t.present {
                    days = t.days.len();
                    for d in &t.days {
                        processed += d.new_in + d.write + d.out;
                        messages += d.messages;
                    }
                    latest = t.days.iter().map(|d| d.date.clone()).max();
                    if let Some(ld) = &latest {
                        if let Some(d) = t.days.iter().find(|d| &d.date == ld) {
                            top_model = d
                                .models
                                .iter()
                                .max_by_key(|(_, v)| **v)
                                .map(|(k, _)| k.clone());
                        }
                    }
                }
            }

            SourceDiag {
                id: id.to_string(),
                label: src.label().to_string(),
                detected,
                roots,
                days,
                processed,
                messages,
                latest,
                top_model,
            }
        })
        .collect()
}

#[cfg(test)]
mod oracle_tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn print_oracle_comparison() {
        let snap = run();
        println!("\n=== ORACLE COMPARISON ===");
        println!("{:<7} {:>3} sessions  {:>2} days  real {:>14}  processed {:>14}  billed {:>16}  cost ${:>10.2}",
                 "source", "sess", "days", "real", "proc", "billed", "cost");
        for src in ["claude", "codex", "kimi", "hashcortx", "cline"] {
            let tool = snap.tools.get(src).unwrap();
            let days = &tool.days;
            let real: u64 = days.iter().map(|d| d.new_in + d.out).sum();
            let processed: u64 = days.iter().map(|d| d.new_in + d.write + d.out).sum();
            let billed: u64 = days.iter().map(|d| d.new_in + d.write + d.read + d.out).sum();
            let cost: f64 = days.iter().map(|d| d.cost).sum();
            let sess_count: usize = days.iter().flat_map(|d| d.sessions.iter()).collect::<HashSet<_>>().len();
            println!(
                "{:<7} {:>3} sessions  {:>2} days  real {:>14}  processed {:>14}  billed {:>16}  cost ${:>10.2}",
                src,
                sess_count,
                days.len(),
                real,
                processed,
                billed,
                cost
            );
        }
        println!("=========================\n");
    }
}
