// ==============================================================
// HashMeterAi — Achievements engine
//
// Deterministic thresholds. Progress is real. Persist unlocked.
// ==============================================================

use crate::model::Snapshot;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Achievement {
    pub id: String,
    pub name: String,
    pub description: String,
    pub progress: f64, // 0.0 .. 1.0
    pub unlocked: bool,
    pub earned_date: Option<String>,
}

pub fn compute(snap: &Snapshot, already_unlocked: &HashSet<String>) -> Vec<Achievement> {
    let stats = compute_stats(snap);
    let mut out = Vec::new();

    let defs = definitions();
    for d in defs {
        let (prog, unlocked) = (d.rule)(&stats);
        let was_unlocked = already_unlocked.contains(&d.id);
        let now_unlocked = was_unlocked || unlocked;
        out.push(Achievement {
            id: d.id.clone(),
            name: d.name,
            description: d.description,
            progress: prog.min(1.0),
            unlocked: now_unlocked,
            earned_date: if now_unlocked {
                Some(chrono::Local::now().date_naive().to_string())
            } else {
                None
            },
        });
    }
    out
}

type RuleFn = Box<dyn Fn(&Stats) -> (f64, bool)>;

struct Def {
    id: String,
    name: String,
    description: String,
    rule: RuleFn,
}

fn definitions() -> Vec<Def> {
    vec![
        Def {
            id: "earlybird".into(),
            name: "Day One".into(),
            description: "First activity recorded".into(),
            rule: Box::new(|s| (if s.active_days > 0 { 1.0 } else { 0.0 }, s.active_days > 0)),
        },
        Def {
            id: "million".into(),
            name: "Million-Token Club".into(),
            description: "Process 1,000,000 tokens".into(),
            rule: Box::new(|s| {
                let p = s.processed as f64 / 1_000_000.0;
                (p, s.processed >= 1_000_000)
            }),
        },
        Def {
            id: "tens".into(),
            name: "10M Club".into(),
            description: "Process 10,000,000 tokens".into(),
            rule: Box::new(|s| {
                let p = s.processed as f64 / 10_000_000.0;
                (p, s.processed >= 10_000_000)
            }),
        },
        Def {
            id: "hundred".into(),
            name: "100M Club".into(),
            description: "Process 100,000,000 tokens".into(),
            rule: Box::new(|s| {
                let p = s.processed as f64 / 100_000_000.0;
                (p, s.processed >= 100_000_000)
            }),
        },
        Def {
            id: "marathon".into(),
            name: "Marathon".into(),
            description: "1,000,000 tokens in a single day".into(),
            rule: Box::new(|s| {
                let p = s.max_day_processed as f64 / 1_000_000.0;
                (p, s.max_day_processed >= 1_000_000)
            }),
        },
        Def {
            id: "streak3".into(),
            name: "Streak I".into(),
            description: "3-day streak".into(),
            rule: Box::new(|s| {
                let best = s.longest_streak.max(s.current_streak);
                let p = best as f64 / 3.0;
                (p, best >= 3)
            }),
        },
        Def {
            id: "streak7".into(),
            name: "Streak II".into(),
            description: "7-day streak".into(),
            rule: Box::new(|s| {
                let best = s.longest_streak.max(s.current_streak);
                let p = best as f64 / 7.0;
                (p, best >= 7)
            }),
        },
        Def {
            id: "streak30".into(),
            name: "Streak III".into(),
            description: "30-day streak".into(),
            rule: Box::new(|s| {
                let best = s.longest_streak.max(s.current_streak);
                let p = best as f64 / 30.0;
                (p, best >= 30)
            }),
        },
        Def {
            id: "polyglot2".into(),
            name: "Polyglot I".into(),
            description: "Use 2 AI tools".into(),
            rule: Box::new(|s| {
                let p = s.tools_used as f64 / 2.0;
                (p, s.tools_used >= 2)
            }),
        },
        Def {
            id: "polyglot3".into(),
            name: "Polyglot II".into(),
            description: "Use 3 AI tools".into(),
            rule: Box::new(|s| {
                let p = s.tools_used as f64 / 3.0;
                (p, s.tools_used >= 3)
            }),
        },
        Def {
            id: "nightowl".into(),
            name: "Night Owl".into(),
            description: "Peak hour before 4 AM with 50+ events".into(),
            rule: Box::new(|s| {
                let p = if s.peak_hour < 4 {
                    (s.peak_events as f64 / 50.0).min(1.0)
                } else {
                    0.0
                };
                (p, s.peak_hour < 4 && s.peak_events >= 50)
            }),
        },
        Def {
            id: "opus".into(),
            name: "Opus Devotee".into(),
            description: "Opus >= 50% of processed".into(),
            rule: Box::new(|s| {
                let p = if s.processed > 0 {
                    s.opus_share as f64 / s.processed as f64 / 0.5
                } else {
                    0.0
                };
                (p, s.processed > 0 && s.opus_share as f64 / s.processed as f64 >= 0.5)
            }),
        },
        Def {
            id: "hopper".into(),
            name: "Model Hopper".into(),
            description: "Use 4+ distinct models".into(),
            rule: Box::new(|s| {
                let p = s.models_used as f64 / 4.0;
                (p, s.models_used >= 4)
            }),
        },
        Def {
            id: "cache".into(),
            name: "Cache Whisperer".into(),
            description: "Cache read >= 90% of billed".into(),
            rule: Box::new(|s| {
                let p = if s.billed > 0 {
                    s.cache_read as f64 / s.billed as f64 / 0.9
                } else {
                    0.0
                };
                (p, s.billed > 0 && s.cache_read as f64 / s.billed as f64 >= 0.9)
            }),
        },
        Def {
            id: "spend100".into(),
            name: "Big Spender I".into(),
            description: "Est. cost >= $100".into(),
            rule: Box::new(|s| {
                let p = s.cost / 100.0;
                (p, s.cost >= 100.0)
            }),
        },
        Def {
            id: "spend1k".into(),
            name: "Big Spender II".into(),
            description: "Est. cost >= $1,000".into(),
            rule: Box::new(|s| {
                let p = s.cost / 1000.0;
                (p, s.cost >= 1000.0)
            }),
        },
        Def {
            id: "locked_in".into(),
            name: "Locked In".into(),
            description: "Avg 3h+ focus/day over 7+ days".into(),
            rule: Box::new(|s| {
                let avg = s.total_focus_sec.checked_div(s.active_days).unwrap_or(0);
                let p = if s.active_days >= 7 {
                    avg as f64 / (3.0 * 3600.0)
                } else {
                    s.active_days as f64 / 7.0
                };
                (p, s.active_days >= 7 && avg >= 3 * 3600)
            }),
        },
    ]
}

#[derive(Default)]
struct Stats {
    processed: u64,
    billed: u64,
    cache_read: u64,
    cost: f64,
    active_days: u64,
    tools_used: usize,
    longest_streak: u64,
    current_streak: u64,
    max_day_processed: u64,
    total_focus_sec: u64,
    peak_hour: u8,
    peak_events: u64,
    opus_share: u64,
    models_used: usize,
}

fn compute_stats(snap: &Snapshot) -> Stats {
    let mut s = Stats::default();
    let mut all_days: HashMap<String, DayAgg> = HashMap::new();
    let mut hours = [0u64; 24];
    let mut models: HashSet<String> = HashSet::new();

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
            for (h, hr) in hours.iter_mut().enumerate() {
                *hr += d.hours[h];
            }

            let opus = d.models.get("claude-opus-4-8").copied().unwrap_or(0)
                + d.models.get("claude-opus-4-7").copied().unwrap_or(0);
            s.opus_share += opus;
        }
    }

    s.models_used = models.len();

    let peak = hours.iter().enumerate().max_by_key(|(_, v)| *v);
    if let Some((h, v)) = peak {
        s.peak_hour = h as u8;
        s.peak_events = *v;
    }

    s.active_days = all_days.len() as u64;
    s.max_day_processed = all_days.values().map(|d| d.processed).max().unwrap_or(0);

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
}
