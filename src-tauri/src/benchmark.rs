// ==============================================================
// HashMeterAi — Usage benchmark ("where do you stand")
//
// There is no live population to rank against: the app is 100% local and makes
// zero network calls. So this is a STATIC, documented reference curve baked into
// the binary. It maps a user's trailing-30-day processed-token rate onto a
// percentile on a *modeled* distribution of AI-coding usage, anchored to public
// 2025–26 figures:
//   - Anthropic: avg ~$6 / developer-day on Claude Code; ~20 hrs/week in-tool.
//   - ~51% of professional devs use AI daily; experienced devs run ~2.3 tools.
//   - Agentic coding tasks run ~1–3.5M tokens each; power users process millions
//     of tokens/day (≈100M+/month).
//
// Honesty contract: every surfaced claim is shown WITH its underlying number and
// a "modeled benchmark, not a live ranking" footnote. We round the "top X%" up
// (claiming less, never more) and refuse to show anything below a data floor.
// This is a yardstick, not a census.
// ==============================================================

use crate::model::Snapshot;
use serde::Serialize;

/// Below this trailing-30-day processed-token figure we show no standing at all
/// rather than a flattering-but-meaningless percentile.
const FLOOR: u64 = 500_000;

/// (monthly processed tokens, percentile at-or-below this level). Monotonic in
/// both columns; we log-interpolate between anchors and clamp past the ends.
const ANCHORS: &[(f64, f64)] = &[
    (500_000.0, 25.0),
    (2_000_000.0, 50.0),
    (8_000_000.0, 75.0),
    (20_000_000.0, 90.0),
    (50_000_000.0, 97.0),
    (100_000_000.0, 99.0),
    (200_000_000.0, 99.7),
];

const NOTE: &str = "Modeled benchmark of 2025\u{2013}26 AI-coding usage \u{2014} not a live ranking.";

#[derive(Debug, Clone, Serialize)]
pub struct Standing {
    /// Whole-number "top X%" figure used in the label (always >= 1, rounded up).
    pub top_pct: u32,
    /// e.g. "Top 1% of AI developers"
    pub label: String,
    /// e.g. "58.2M processed tokens in the last 30 days"
    pub basis: String,
    /// The honesty footnote.
    pub note: String,
}

/// The user's standing, or `None` below the data floor.
pub fn standing(snap: &Snapshot) -> Option<Standing> {
    let monthly = monthly_processed(snap);
    if monthly < FLOOR {
        return None;
    }
    let pct = percentile(monthly);
    // Round the "top X%" UP to the nearest whole percent (claim less, never
    // more), with the most-elite headline capped at "Top 1%".
    let top_raw = 100.0 - pct;
    let top = if top_raw < 1.0 { 1 } else { top_raw.round() as u32 };
    Some(Standing {
        top_pct: top,
        label: format!("Top {top}% of AI developers"),
        basis: format!("{} processed tokens in the last 30 days", human(monthly)),
        note: NOTE.to_string(),
    })
}

/// Processed tokens (new input + cache writes + output) over the trailing 30
/// days, measured back from the most recent active date in the data.
pub fn monthly_processed(snap: &Snapshot) -> u64 {
    let latest = snap
        .tools
        .values()
        .filter(|t| t.present)
        .flat_map(|t| t.days.iter().map(|d| d.date.as_str()))
        .filter_map(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .max();
    let latest = match latest {
        Some(d) => d,
        None => return 0,
    };
    let cutoff = latest - chrono::Duration::days(29);

    let mut total = 0u64;
    for tool in snap.tools.values() {
        if !tool.present {
            continue;
        }
        for d in &tool.days {
            if let Ok(date) = chrono::NaiveDate::parse_from_str(&d.date, "%Y-%m-%d") {
                if date >= cutoff && date <= latest {
                    total += d.new_in + d.write + d.out;
                }
            }
        }
    }
    total
}

/// Percentile (0..100) for a monthly processed-token figure on the benchmark.
fn percentile(monthly: u64) -> f64 {
    let x = (monthly as f64).max(1.0);
    let first = ANCHORS[0];
    let last = ANCHORS[ANCHORS.len() - 1];
    if x <= first.0 {
        return first.1;
    }
    if x >= last.0 {
        return last.1;
    }
    for w in ANCHORS.windows(2) {
        let (x0, p0) = w[0];
        let (x1, p1) = w[1];
        if x >= x0 && x <= x1 {
            let t = (x.ln() - x0.ln()) / (x1.ln() - x0.ln());
            return p0 + t * (p1 - p0);
        }
    }
    last.1
}

fn human(n: u64) -> String {
    if n >= 1_000_000_000 {
        format!("{:.2}B", n as f64 / 1e9)
    } else if n >= 1_000_000 {
        format!("{:.2}M", n as f64 / 1e6)
    } else if n >= 1_000 {
        format!("{:.1}K", n as f64 / 1e3)
    } else {
        n.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{DayRecord, SourceOutput};
    use std::collections::HashMap;

    fn snap(days: Vec<DayRecord>) -> Snapshot {
        let mut tools = HashMap::new();
        tools.insert(
            "claude".to_string(),
            SourceOutput {
                label: "Claude Code".to_string(),
                present: true,
                days,
            },
        );
        Snapshot {
            generated_at: "2026-01-01T00:00:00+00:00".to_string(),
            tools,
        }
    }

    fn day(date: &str, proc: u64) -> DayRecord {
        let mut d = DayRecord::new(date);
        d.new_in = proc;
        d
    }

    #[test]
    fn percentile_is_monotonic() {
        assert!(percentile(1_000_000) < percentile(10_000_000));
        assert!(percentile(10_000_000) < percentile(100_000_000));
        assert!(percentile(100_000_000) <= percentile(500_000_000));
    }

    #[test]
    fn below_floor_has_no_standing() {
        let s = snap(vec![day("2026-06-10", 100_000)]);
        assert!(standing(&s).is_none());
    }

    #[test]
    fn power_user_lands_in_top_band() {
        let s = snap(vec![day("2026-06-10", 100_000_000)]);
        let st = standing(&s).expect("should have standing");
        assert!(st.top_pct <= 2, "100M/mo should be ~top 1%, got {}", st.top_pct);
        assert!(st.label.contains("AI developers"));
        assert!(st.basis.contains("last 30 days"));
    }

    #[test]
    fn only_trailing_30_days_count() {
        // An old day outside the window must not inflate the monthly figure.
        let s = snap(vec![
            day("2026-01-01", 90_000_000), // far outside the 30-day window
            day("2026-06-09", 3_000_000),
            day("2026-06-10", 4_000_000),
        ]);
        assert_eq!(monthly_processed(&s), 7_000_000);
    }
}
