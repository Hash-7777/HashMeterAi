// ==============================================================
// HashMeterAi — Achievements engine
//
// Deterministic thresholds. Progress is real and computed from the
// scanned snapshot. Each badge carries a tier (common/rare/epic/
// legendary) so the UI can vary its shape and weight. Difficulty
// spans from "first activity" to multi-billion-token, 100-day-streak
// legendary goals.
//
// Grounding note: model-share metrics (Opus / cache) are measured
// against BILLED tokens, the same basis the Models card uses, so the
// numerator and denominator are always the same unit.
// ==============================================================

use crate::model::Snapshot;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

pub const COMMON: &str = "common";
pub const RARE: &str = "rare";
pub const EPIC: &str = "epic";
pub const LEGENDARY: &str = "legendary";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Achievement {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tier: String,
    pub progress: f64, // 0.0 .. 1.0
    pub unlocked: bool,
    pub earned_date: Option<String>,
}

/// Compute achievements, using `earned_dates` for the real unlock date of
/// previously-earned badges (newly unlocked ones get today's date).
pub fn compute_with_dates(
    snap: &Snapshot,
    already_unlocked: &HashSet<String>,
    earned_dates: &HashMap<String, String>,
) -> Vec<Achievement> {
    let stats = compute_stats(snap);
    let today = chrono::Local::now().date_naive().to_string();
    let mut out = Vec::new();

    for d in definitions() {
        let (prog, unlocked) = (d.rule)(&stats);
        let was_unlocked = already_unlocked.contains(&d.id);
        let now_unlocked = was_unlocked || unlocked;
        let earned_date = if now_unlocked {
            Some(
                earned_dates
                    .get(&d.id)
                    .cloned()
                    .unwrap_or_else(|| today.clone()),
            )
        } else {
            None
        };
        out.push(Achievement {
            id: d.id,
            name: d.name,
            description: d.description,
            tier: d.tier.to_string(),
            progress: prog.clamp(0.0, 1.0),
            unlocked: now_unlocked,
            earned_date,
        });
    }
    out
}

type RuleFn = Box<dyn Fn(&Stats) -> (f64, bool)>;

struct Def {
    id: String,
    name: String,
    description: String,
    tier: &'static str,
    rule: RuleFn,
}

fn def(id: &str, name: &str, description: &str, tier: &'static str, rule: RuleFn) -> Def {
    Def {
        id: id.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        tier,
        rule,
    }
}

// Share of billed tokens that were Opus.
fn opus_ratio(s: &Stats) -> f64 {
    if s.billed == 0 {
        0.0
    } else {
        s.opus_billed as f64 / s.billed as f64
    }
}

fn cache_ratio(s: &Stats) -> f64 {
    if s.billed == 0 {
        0.0
    } else {
        s.cache_read as f64 / s.billed as f64
    }
}

fn best_streak(s: &Stats) -> u64 {
    s.longest_streak.max(s.current_streak)
}

fn avg_focus(s: &Stats) -> u64 {
    s.total_focus_sec.checked_div(s.active_days).unwrap_or(0)
}

fn definitions() -> Vec<Def> {
    vec![
        // ---- Getting started ----
        def("earlybird", "Day One", "Record your first AI activity", COMMON,
            Box::new(|s| (if s.active_days > 0 { 1.0 } else { 0.0 }, s.active_days > 0))),

        // ---- Volume (processed tokens) ----
        def("million", "Million Club", "Process 1,000,000 tokens", COMMON,
            Box::new(|s| (s.processed as f64 / 1_000_000.0, s.processed >= 1_000_000))),
        def("tens", "10M Club", "Process 10,000,000 tokens", COMMON,
            Box::new(|s| (s.processed as f64 / 10_000_000.0, s.processed >= 10_000_000))),
        def("hundred", "100M Club", "Process 100,000,000 tokens", RARE,
            Box::new(|s| (s.processed as f64 / 100_000_000.0, s.processed >= 100_000_000))),
        def("billion", "Billionaire", "Process 1,000,000,000 tokens", EPIC,
            Box::new(|s| (s.processed as f64 / 1_000_000_000.0, s.processed >= 1_000_000_000))),
        def("five_billion", "Ten-Figure Mind", "Process 5,000,000,000 tokens", LEGENDARY,
            Box::new(|s| (s.processed as f64 / 5_000_000_000.0, s.processed >= 5_000_000_000))),

        // ---- Single-day intensity ----
        def("marathon", "Marathon", "1,000,000 tokens in a single day", RARE,
            Box::new(|s| (s.max_day_processed as f64 / 1_000_000.0, s.max_day_processed >= 1_000_000))),
        def("ultra_day", "Ultramarathon", "10,000,000 tokens in a single day", EPIC,
            Box::new(|s| (s.max_day_processed as f64 / 10_000_000.0, s.max_day_processed >= 10_000_000))),

        // ---- Streaks ----
        def("streak3", "Streak I", "3-day activity streak", COMMON,
            Box::new(|s| (best_streak(s) as f64 / 3.0, best_streak(s) >= 3))),
        def("streak7", "Streak II", "7-day activity streak", RARE,
            Box::new(|s| (best_streak(s) as f64 / 7.0, best_streak(s) >= 7))),
        def("streak30", "Streak III", "30-day activity streak", EPIC,
            Box::new(|s| (best_streak(s) as f64 / 30.0, best_streak(s) >= 30))),
        def("streak100", "Unbroken", "100-day activity streak", LEGENDARY,
            Box::new(|s| (best_streak(s) as f64 / 100.0, best_streak(s) >= 100))),

        // ---- Breadth of tools ----
        def("polyglot2", "Polyglot I", "Use 2 AI tools", COMMON,
            Box::new(|s| (s.tools_used as f64 / 2.0, s.tools_used >= 2))),
        def("polyglot3", "Polyglot II", "Use 3 AI tools", RARE,
            Box::new(|s| (s.tools_used as f64 / 3.0, s.tools_used >= 3))),
        def("polyglot5", "Full Stack", "Use 5 AI tools", EPIC,
            Box::new(|s| (s.tools_used as f64 / 5.0, s.tools_used >= 5))),

        // ---- Breadth of models ----
        def("hopper", "Model Hopper", "Use 4 distinct models", COMMON,
            Box::new(|s| (s.models_used as f64 / 4.0, s.models_used >= 4))),
        def("polymath", "Polymath", "Use 8 distinct models", RARE,
            Box::new(|s| (s.models_used as f64 / 8.0, s.models_used >= 8))),

        // ---- Cadence / time of day ----
        def("nightowl", "Night Owl", "Peak hour before 4 AM (50+ events)", RARE,
            Box::new(|s| {
                let p = if s.peak_hour < 4 { (s.peak_events as f64 / 50.0).min(1.0) } else { 0.0 };
                (p, s.peak_hour < 4 && s.peak_events >= 50)
            })),
        def("around_clock", "Around the Clock", "Active in 20+ different hours of the day", EPIC,
            Box::new(|s| (s.active_hours as f64 / 20.0, s.active_hours >= 20))),

        // ---- Focus ----
        def("deep_work", "Deep Work", "6h+ of focused work in a single day", RARE,
            Box::new(|s| (s.max_day_focus_sec as f64 / (6.0 * 3600.0), s.max_day_focus_sec >= 6 * 3600))),
        def("locked_in", "Locked In", "Average 3h+ focus/day over 7+ days", EPIC,
            Box::new(|s| {
                let p = if s.active_days >= 7 {
                    avg_focus(s) as f64 / (3.0 * 3600.0)
                } else {
                    s.active_days as f64 / 7.0
                };
                (p, s.active_days >= 7 && avg_focus(s) >= 3 * 3600)
            })),
        def("iron_focus", "Iron Focus", "Average 5h+ focus/day over 14+ days", LEGENDARY,
            Box::new(|s| {
                let p = if s.active_days >= 14 {
                    avg_focus(s) as f64 / (5.0 * 3600.0)
                } else {
                    s.active_days as f64 / 14.0
                };
                (p, s.active_days >= 14 && avg_focus(s) >= 5 * 3600)
            })),

        // ---- Consistency ----
        def("centurion", "Centurion", "Reach 100 total sessions", RARE,
            Box::new(|s| (s.sessions_total as f64 / 100.0, s.sessions_total >= 100))),
        def("veteran", "Veteran", "100 active days", EPIC,
            Box::new(|s| (s.active_days as f64 / 100.0, s.active_days >= 100))),

        // ---- Model affinity (billed-token basis) ----
        def("opus", "Opus Devotee", "Opus is 50%+ of billed tokens", RARE,
            Box::new(|s| (opus_ratio(s) / 0.5, opus_ratio(s) >= 0.5))),

        // ---- Cache mastery (billed-token basis) ----
        def("cache", "Cache Whisperer", "Cache reads are 90%+ of billed tokens", RARE,
            Box::new(|s| (cache_ratio(s) / 0.9, cache_ratio(s) >= 0.9))),
        def("cache_master", "Cache Master", "Cache reads are 95%+ of billed tokens", EPIC,
            Box::new(|s| (cache_ratio(s) / 0.95, cache_ratio(s) >= 0.95))),

        // ---- Spend (estimated, public list prices) ----
        def("spend100", "Big Spender I", "Estimated cost reaches $100", RARE,
            Box::new(|s| (s.cost / 100.0, s.cost >= 100.0))),
        def("spend1k", "Big Spender II", "Estimated cost reaches $1,000", EPIC,
            Box::new(|s| (s.cost / 1000.0, s.cost >= 1000.0))),
        def("spend5k", "Whale", "Estimated cost reaches $5,000", LEGENDARY,
            Box::new(|s| (s.cost / 5000.0, s.cost >= 5000.0))),
    ]
}

#[derive(Default)]
struct Stats {
    processed: u64,
    billed: u64,
    cache_read: u64,
    cost: f64,
    active_days: u64,
    active_hours: u64,
    tools_used: usize,
    longest_streak: u64,
    current_streak: u64,
    max_day_processed: u64,
    max_day_focus_sec: u64,
    total_focus_sec: u64,
    peak_hour: u8,
    peak_events: u64,
    opus_billed: u64,
    models_used: usize,
    sessions_total: u64,
}

fn compute_stats(snap: &Snapshot) -> Stats {
    let mut s = Stats::default();
    let mut all_days: HashMap<String, DayAgg> = HashMap::new();
    let mut hours = [0u64; 24];
    let mut models: HashSet<String> = HashSet::new();
    let mut sessions: HashSet<String> = HashSet::new();

    for tool in snap.tools.values() {
        if !tool.present || tool.days.is_empty() {
            continue;
        }
        s.tools_used += 1;
        for d in &tool.days {
            let proc = d.new_in + d.write + d.out;
            s.processed += proc;
            s.billed += d.new_in + d.write + d.read + d.out;
            s.cache_read += d.read;
            s.cost += d.cost;

            let agg = all_days.entry(d.date.clone()).or_default();
            agg.processed += proc;
            agg.focus_sec += d.focus_sec;

            for m in d.models.keys() {
                models.insert(m.clone());
            }
            for sess in &d.sessions {
                sessions.insert(sess.clone());
            }
            for (h, hr) in hours.iter_mut().enumerate() {
                *hr += d.hours[h];
            }

            let opus = d.models.get("claude-opus-4-8").copied().unwrap_or(0)
                + d.models.get("claude-opus-4-7").copied().unwrap_or(0);
            s.opus_billed += opus;
        }
    }

    s.models_used = models.len();
    s.sessions_total = sessions.len() as u64;
    s.active_hours = hours.iter().filter(|&&v| v > 0).count() as u64;

    let peak = hours.iter().enumerate().max_by_key(|(_, v)| *v);
    if let Some((h, v)) = peak {
        s.peak_hour = h as u8;
        s.peak_events = *v;
    }

    s.active_days = all_days.len() as u64;
    s.max_day_processed = all_days.values().map(|d| d.processed).max().unwrap_or(0);
    s.max_day_focus_sec = all_days.values().map(|d| d.focus_sec).max().unwrap_or(0);

    let (long, cur) = streaks(&all_days);
    s.longest_streak = long;
    s.current_streak = cur;
    s.total_focus_sec = all_days.values().map(|d| d.focus_sec).sum();

    s
}

#[derive(Default)]
struct DayAgg {
    processed: u64,
    focus_sec: u64,
}

fn streaks(days: &HashMap<String, DayAgg>) -> (u64, u64) {
    let mut ds: Vec<_> = days.keys().cloned().collect();
    if ds.is_empty() {
        return (0, 0);
    }
    ds.sort();
    let mut lng = 1u64;
    let mut cur = 1u64;
    for i in 1..ds.len() {
        let diff = (parse_date(&ds[i]) - parse_date(&ds[i - 1])).num_days();
        if diff == 1 {
            cur += 1;
        } else {
            cur = 1;
        }
        lng = lng.max(cur);
    }
    let mut cs = 1u64;
    let mut i = ds.len();
    while i > 1 {
        let diff = (parse_date(&ds[i - 1]) - parse_date(&ds[i - 2])).num_days();
        if diff == 1 {
            cs += 1;
        } else {
            break;
        }
        i -= 1;
    }
    (lng, cs)
}

fn parse_date(s: &str) -> chrono::NaiveDate {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap_or(chrono::NaiveDate::MIN)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{DayRecord, SourceOutput, Snapshot};
    use std::collections::HashMap;

    // Test helper: compute with no pre-stored earn dates.
    fn compute(snap: &Snapshot, already_unlocked: &HashSet<String>) -> Vec<Achievement> {
        compute_with_dates(snap, already_unlocked, &HashMap::new())
    }

    fn snap_with(days: Vec<DayRecord>, present: bool) -> Snapshot {
        let mut tools = HashMap::new();
        tools.insert(
            "claude".to_string(),
            SourceOutput {
                label: "Claude Code".to_string(),
                present,
                days,
            },
        );
        Snapshot {
            generated_at: "2026-01-01T00:00:00+00:00".to_string(),
            tools,
        }
    }

    fn day(proc: u64) -> DayRecord {
        let mut d = DayRecord::new("2026-06-10");
        d.new_in = proc;
        d.messages = 1;
        d.sessions.push("s1".to_string());
        d
    }

    #[test]
    fn earlybird_unlocks_when_data_exists() {
        let snap = snap_with(vec![day(100)], true);
        let list = compute(&snap, &HashSet::new());
        let e = list.iter().find(|a| a.id == "earlybird").unwrap();
        assert!(e.unlocked);
        assert_eq!(e.tier, COMMON);
    }

    #[test]
    fn million_unlocks_at_threshold() {
        let snap = snap_with(vec![day(1_000_000)], true);
        let list = compute(&snap, &HashSet::new());
        let m = list.iter().find(|a| a.id == "million").unwrap();
        assert!(m.unlocked);
        assert!(m.progress >= 1.0);
    }

    #[test]
    fn million_partial_progress() {
        let snap = snap_with(vec![day(500_000)], true);
        let list = compute(&snap, &HashSet::new());
        let m = list.iter().find(|a| a.id == "million").unwrap();
        assert!(!m.unlocked);
        assert!(m.progress > 0.4 && m.progress < 0.6);
    }

    #[test]
    fn persists_previously_unlocked() {
        let snap = snap_with(vec![day(100)], true);
        let mut unlocked = HashSet::new();
        unlocked.insert("million".to_string());
        let list = compute(&snap, &unlocked);
        let m = list.iter().find(|a| a.id == "million").unwrap();
        assert!(m.unlocked);
    }

    #[test]
    fn opus_ratio_uses_billed_not_processed() {
        // 600k opus output billed, 1M billed total -> 60% -> unlocks Opus Devotee.
        let mut d = DayRecord::new("2026-06-10");
        d.new_in = 400_000;
        d.read = 600_000; // billed = 1_000_000
        d.models.insert("claude-opus-4-8".to_string(), 600_000);
        d.messages = 1;
        d.sessions.push("s1".to_string());
        let snap = snap_with(vec![d], true);
        let list = compute(&snap, &HashSet::new());
        let o = list.iter().find(|a| a.id == "opus").unwrap();
        assert!(o.unlocked, "opus should unlock at 60% billed share");
        assert!(o.progress >= 1.0);
    }

    #[test]
    fn earned_date_is_preserved_for_old_unlocks() {
        let snap = snap_with(vec![day(1_000_000)], true);
        let mut unlocked = HashSet::new();
        unlocked.insert("million".to_string());
        let mut dates = HashMap::new();
        dates.insert("million".to_string(), "2026-01-15".to_string());
        let list = compute_with_dates(&snap, &unlocked, &dates);
        let m = list.iter().find(|a| a.id == "million").unwrap();
        assert_eq!(m.earned_date.as_deref(), Some("2026-01-15"));
    }

    #[test]
    fn harder_tiers_exist_and_lock_when_low() {
        let snap = snap_with(vec![day(100)], true);
        let list = compute(&snap, &HashSet::new());
        for id in ["billion", "five_billion", "streak100", "iron_focus", "spend5k"] {
            let a = list.iter().find(|a| a.id == id).unwrap();
            assert!(!a.unlocked, "{} should be locked on trivial data", id);
        }
        assert!(list.iter().any(|a| a.tier == LEGENDARY));
    }
}
