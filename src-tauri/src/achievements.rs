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
    /// Global difficulty rank (1 = easiest). Drives "hardest first" ordering in
    /// the grid and which single trophy the Share card features. Tier still
    /// drives color/shape; rank gives a precise total order across tiers.
    pub rank: u32,
    pub progress: f64, // 0.0 .. 1.0
    pub unlocked: bool,
    pub earned_date: Option<String>,
}

/// Compute achievements with honest earn dates.
///
/// Date resolution, in order of trust:
///   1. The real first-cross date replayed from the transcript history.
///   2. A previously-stored date (only used when the history no longer covers
///      the crossing — e.g. old transcripts were rotated away).
///   3. Today (a genuinely live, first-ever crossing).
///
/// History wins over the stored value so that bogus "all earned today" stamps
/// (written on a user's first run, before this replay existed) self-correct.
pub fn compute_with_dates(
    snap: &Snapshot,
    already_unlocked: &HashSet<String>,
    earned_dates: &HashMap<String, String>,
) -> Vec<Achievement> {
    let stats = compute_stats(snap);
    let historical = first_earned_dates(snap);
    let today = chrono::Local::now().date_naive().to_string();
    let mut out = Vec::new();

    for d in definitions() {
        let (prog, unlocked) = (d.rule)(&stats);
        let was_unlocked = already_unlocked.contains(&d.id);
        let now_unlocked = was_unlocked || unlocked;
        let earned_date = if now_unlocked {
            Some(
                historical
                    .get(&d.id)
                    .or_else(|| earned_dates.get(&d.id))
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
            rank: d.rank,
            progress: prog.clamp(0.0, 1.0),
            unlocked: now_unlocked,
            earned_date,
        });
    }
    out
}

/// Replay the day-by-day history and return, for each badge, the first date its
/// rule first fired. Reuses the exact same rule closures evaluated against an
/// as-of-date snapshot, so cumulative, single-day, streak, and ratio badges all
/// date correctly with zero duplicated threshold logic.
fn first_earned_dates(snap: &Snapshot) -> HashMap<String, String> {
    let mut dates: Vec<String> = snap
        .tools
        .values()
        .filter(|t| t.present)
        .flat_map(|t| t.days.iter().map(|d| d.date.clone()))
        .collect();
    dates.sort();
    dates.dedup();

    let defs = definitions();
    let mut out: HashMap<String, String> = HashMap::new();
    for date in &dates {
        let s = compute_stats_asof(snap, date);
        for d in &defs {
            if out.contains_key(&d.id) {
                continue;
            }
            let (_, unlocked) = (d.rule)(&s);
            if unlocked {
                out.insert(d.id.clone(), date.clone());
            }
        }
        if out.len() == defs.len() {
            break;
        }
    }
    out
}

type RuleFn = Box<dyn Fn(&Stats) -> (f64, bool)>;

struct Def {
    id: String,
    name: String,
    description: String,
    tier: &'static str,
    rank: u32,
    rule: RuleFn,
}

fn def(id: &str, name: &str, description: &str, tier: &'static str, rank: u32, rule: RuleFn) -> Def {
    Def {
        id: id.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        tier,
        rank,
        rule,
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

// The curated trophy roster: 16 badges, each a real milestone, ranked 1..16 by
// difficulty. Ids are stable (they key stored unlock state) — only the names,
// tiers and ranks are curated. Rules are deliberately reused so the day-by-day
// replay in `first_earned_dates` can date every badge from the same logic.
fn definitions() -> Vec<Def> {
    vec![
        // ---- Common: the on-ramp ----
        def("earlybird", "First Contact", "Record your first AI activity", COMMON, 1,
            Box::new(|s| (if s.active_days > 0 { 1.0 } else { 0.0 }, s.active_days > 0))),
        def("streak7", "Hooked", "Hold a 7-day activity streak", COMMON, 2,
            Box::new(|s| (best_streak(s) as f64 / 7.0, best_streak(s) >= 7))),

        // ---- Rare: you're a regular now ----
        def("tens", "The Stack", "Process 10,000,000 tokens", RARE, 3,
            Box::new(|s| (s.processed as f64 / 10_000_000.0, s.processed >= 10_000_000))),
        def("polyglot3", "Polyglot", "Run 3 different AI tools", RARE, 4,
            Box::new(|s| (s.tools_used as f64 / 3.0, s.tools_used >= 3))),
        def("nightowl", "Night Owl", "Peak activity before 4 AM (50+ events)", RARE, 5,
            Box::new(|s| {
                let p = if s.peak_hour < 4 { (s.peak_events as f64 / 50.0).min(1.0) } else { 0.0 };
                (p, s.peak_hour < 4 && s.peak_events >= 50)
            })),
        def("marathon", "Marathoner", "Process 1,000,000 tokens in a single day", RARE, 6,
            Box::new(|s| (s.max_day_processed as f64 / 1_000_000.0, s.max_day_processed >= 1_000_000))),
        def("deep_work", "Deep Diver", "6h+ of focused work in a single day", RARE, 7,
            Box::new(|s| (s.max_day_focus_sec as f64 / (6.0 * 3600.0), s.max_day_focus_sec >= 6 * 3600))),

        // ---- Epic: serious operator ----
        def("hundred", "The Vault", "Process 100,000,000 tokens", EPIC, 8,
            Box::new(|s| (s.processed as f64 / 100_000_000.0, s.processed >= 100_000_000))),
        def("polymath", "Mind Palace", "Use 8 distinct models", EPIC, 9,
            Box::new(|s| (s.models_used as f64 / 8.0, s.models_used >= 8))),
        def("ultra_day", "Heavy Lifter", "Process 10,000,000 tokens in a single day", EPIC, 10,
            Box::new(|s| (s.max_day_processed as f64 / 10_000_000.0, s.max_day_processed >= 10_000_000))),
        def("around_clock", "Around the Clock", "Be active in 20+ different hours of the day", EPIC, 11,
            Box::new(|s| (s.active_hours as f64 / 20.0, s.active_hours >= 20))),
        def("cache_master", "Cache Sorcerer", "Cache reads are 95%+ of billed tokens", EPIC, 12,
            Box::new(|s| (cache_ratio(s) / 0.95, cache_ratio(s) >= 0.95))),
        def("spend1k", "Big Spender", "Reach $1,000 of estimated compute", EPIC, 13,
            Box::new(|s| (s.cost / 1000.0, s.cost >= 1000.0))),

        // ---- Legendary: the rarefied air ----
        def("billion", "Billionaire", "Process 1,000,000,000 tokens", LEGENDARY, 14,
            Box::new(|s| (s.processed as f64 / 1_000_000_000.0, s.processed >= 1_000_000_000))),
        def("streak100", "Unbroken", "Hold a 100-day activity streak", LEGENDARY, 15,
            Box::new(|s| (best_streak(s) as f64 / 100.0, best_streak(s) >= 100))),
        def("spend5k", "The Whale", "Reach $5,000 of estimated compute", LEGENDARY, 16,
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
    peak_hour: u8,
    peak_events: u64,
    models_used: usize,
}

/// Stats over the whole history.
fn compute_stats(snap: &Snapshot) -> Stats {
    compute_stats_filtered(snap, None)
}

/// Stats as of a given date (days with `date <= max_date`). Used by the
/// day-by-day replay so each badge can be dated from the same rules.
fn compute_stats_asof(snap: &Snapshot, max_date: &str) -> Stats {
    compute_stats_filtered(snap, Some(max_date))
}

fn compute_stats_filtered(snap: &Snapshot, max_date: Option<&str>) -> Stats {
    let mut s = Stats::default();
    let mut all_days: HashMap<String, DayAgg> = HashMap::new();
    let mut hours = [0u64; 24];
    let mut models: HashSet<String> = HashSet::new();
    let mut tools_with_usage: HashSet<&str> = HashSet::new();

    for (id, tool) in &snap.tools {
        if !tool.present || tool.days.is_empty() {
            continue;
        }
        for d in &tool.days {
            if let Some(cutoff) = max_date {
                if d.date.as_str() > cutoff {
                    continue;
                }
            }
            tools_with_usage.insert(id.as_str());

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
            for (h, hr) in hours.iter_mut().enumerate() {
                *hr += d.hours[h];
            }
        }
    }

    s.tools_used = tools_with_usage.len();
    s.models_used = models.len();
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
        day_on("2026-06-10", proc)
    }

    fn day_on(date: &str, proc: u64) -> DayRecord {
        let mut d = DayRecord::new(date);
        d.new_in = proc;
        d.messages = 1;
        d.hours[14] = 1;
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
    fn the_stack_unlocks_at_threshold() {
        let snap = snap_with(vec![day(10_000_000)], true);
        let list = compute(&snap, &HashSet::new());
        let m = list.iter().find(|a| a.id == "tens").unwrap();
        assert!(m.unlocked);
        assert!(m.progress >= 1.0);
    }

    #[test]
    fn the_stack_partial_progress() {
        let snap = snap_with(vec![day(5_000_000)], true);
        let list = compute(&snap, &HashSet::new());
        let m = list.iter().find(|a| a.id == "tens").unwrap();
        assert!(!m.unlocked);
        assert!(m.progress > 0.4 && m.progress < 0.6);
    }

    #[test]
    fn persists_previously_unlocked() {
        let snap = snap_with(vec![day(100)], true);
        let mut unlocked = HashSet::new();
        unlocked.insert("tens".to_string());
        let list = compute(&snap, &unlocked);
        let m = list.iter().find(|a| a.id == "tens").unwrap();
        assert!(m.unlocked);
    }

    #[test]
    fn cache_sorcerer_uses_billed_basis() {
        // 1.9M cache reads on 2M billed -> 95% -> unlocks Cache Sorcerer.
        let mut d = DayRecord::new("2026-06-10");
        d.new_in = 100_000;
        d.read = 1_900_000; // billed = 2_000_000, cache share = 95%
        d.messages = 1;
        d.hours[14] = 1;
        d.sessions.push("s1".to_string());
        let snap = snap_with(vec![d], true);
        let list = compute(&snap, &HashSet::new());
        let c = list.iter().find(|a| a.id == "cache_master").unwrap();
        assert!(c.unlocked, "cache sorcerer should unlock at 95% billed share");
    }

    #[test]
    fn earned_date_comes_from_history_not_stored_stamp() {
        // Cumulative crosses 10M on the second day. A stale stored "today" stamp
        // must NOT win — the replayed crossing date does.
        let snap = snap_with(
            vec![day_on("2026-03-01", 4_000_000), day_on("2026-03-02", 7_000_000)],
            true,
        );
        let mut dates = HashMap::new();
        dates.insert("tens".to_string(), "2026-06-11".to_string());
        let list = compute_with_dates(&snap, &HashSet::new(), &dates);
        let m = list.iter().find(|a| a.id == "tens").unwrap();
        assert_eq!(m.earned_date.as_deref(), Some("2026-03-02"));
    }

    #[test]
    fn earned_date_falls_back_to_stored_when_history_absent() {
        // Marked unlocked from a prior run, but the current snapshot no longer
        // satisfies the rule (rotated transcripts) -> keep the stored date.
        let snap = snap_with(vec![day(100)], true);
        let mut unlocked = HashSet::new();
        unlocked.insert("tens".to_string());
        let mut dates = HashMap::new();
        dates.insert("tens".to_string(), "2026-01-15".to_string());
        let list = compute_with_dates(&snap, &unlocked, &dates);
        let m = list.iter().find(|a| a.id == "tens").unwrap();
        assert_eq!(m.earned_date.as_deref(), Some("2026-01-15"));
    }

    #[test]
    fn replay_dates_milestones_on_different_days() {
        // Seven consecutive active days: First Contact dates to day 1, Hooked
        // (7-day streak) dates to day 7 — proving badges no longer share a date.
        let days: Vec<DayRecord> = (1..=7)
            .map(|n| day_on(&format!("2026-06-0{n}"), 1000))
            .collect();
        let snap = snap_with(days, true);
        let list = compute(&snap, &HashSet::new());
        let first = list.iter().find(|a| a.id == "earlybird").unwrap();
        let hooked = list.iter().find(|a| a.id == "streak7").unwrap();
        assert_eq!(first.earned_date.as_deref(), Some("2026-06-01"));
        assert_eq!(hooked.earned_date.as_deref(), Some("2026-06-07"));
        assert_ne!(first.earned_date, hooked.earned_date);
    }

    #[test]
    fn roster_is_sixteen_with_unique_ordered_ranks() {
        let snap = snap_with(vec![day(100)], true);
        let list = compute(&snap, &HashSet::new());
        assert_eq!(list.len(), 16);
        let mut ranks: Vec<u32> = list.iter().map(|a| a.rank).collect();
        ranks.sort_unstable();
        assert_eq!(ranks, (1..=16).collect::<Vec<u32>>());
        // The hardest-ranked badge is legendary; the easiest is common.
        let hardest = list.iter().max_by_key(|a| a.rank).unwrap();
        let easiest = list.iter().min_by_key(|a| a.rank).unwrap();
        assert_eq!(hardest.tier, LEGENDARY);
        assert_eq!(easiest.tier, COMMON);
    }

    #[test]
    fn harder_tiers_exist_and_lock_when_low() {
        let snap = snap_with(vec![day(100)], true);
        let list = compute(&snap, &HashSet::new());
        for id in ["billion", "streak100", "spend5k", "hundred", "ultra_day"] {
            let a = list.iter().find(|a| a.id == id).unwrap();
            assert!(!a.unlocked, "{} should be locked on trivial data", id);
        }
        assert!(list.iter().any(|a| a.tier == LEGENDARY));
    }
}
