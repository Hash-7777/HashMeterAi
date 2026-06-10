// ==============================================================
// HashMeterAi — Scan orchestrator
//
// Detects sources, scans in parallel, aggregates into Snapshot.
// ==============================================================

use crate::aggregate;
use crate::model::Snapshot;
use crate::sources::{ScanCtx, registry};
use rayon::prelude::*;
use std::path::PathBuf;

pub fn run() -> Snapshot {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let ctx = ScanCtx { home: &home };

    let events: Vec<_> = registry()
        .par_iter()
        .filter(|src| src.detect(&ctx))
        .flat_map(|src| src.scan(&ctx))
        .collect();

    aggregate::build(events)
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
        for src in ["claude", "codex", "kimi"] {
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
