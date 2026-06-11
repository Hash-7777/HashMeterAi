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
