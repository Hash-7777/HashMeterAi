// ==============================================================
// HashMeterAi — Persona engine
//
// Deterministic rule engine. Every trait cites its metric.
// ==============================================================

use crate::model::Snapshot;
use serde::Serialize;
use std::collections::{HashMap, HashSet};

const PROCESSED_FLOOR: u64 = 50_000;

#[derive(Debug, Clone, Serialize)]
pub struct Persona {
    pub title: String,
    pub subtitle: String,
    pub description: String,
    pub traits: Vec<Trait>,
    pub confidence: String,
    /// Honest "where do you stand" line (top X% vs. the modeled benchmark), or
    /// `None` below the data floor. See `benchmark.rs`.
    pub standing: Option<crate::benchmark::Standing>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Trait {
    pub label: String,
    pub why: String,
}

pub fn from_snapshot(snap: &Snapshot, name: &str) -> Persona {
    let stats = compute_stats(snap);
    let standing = crate::benchmark::standing(snap);

    if stats.processed < PROCESSED_FLOOR {
        return Persona {
            title: "Just getting started".to_string(),
            subtitle: "Dabbler".to_string(),
            description: format!(
                "{}, you've processed {} tokens so far. Not enough usage yet to read your style — keep going and check back.",
                cap(name), human(stats.processed)
            ),
            traits: vec![Trait {
                label: "Building data".to_string(),
                why: format!("{} processed / {} floor", human(stats.processed), human(PROCESSED_FLOOR)),
            }],
            confidence: "low".to_string(),
            standing,
        };
    }

    let base = pick_base(&stats);
    let modifier = pick_modifier(&stats);
    let subtitle = pick_subtitle(stats.processed);
    let title = format!("{} \u{00b7} {}", base, modifier);

    let mut traits = Vec::new();
    traits.push(Trait {
        label: base.to_string(),
        why: base_why(&stats, &base),
    });
    traits.push(Trait {
        label: modifier.to_string(),
        why: modifier_why(&stats, &modifier),
    });
    traits.push(Trait {
        label: "Volume".to_string(),
        why: format!("{} processed tokens", human(stats.processed)),
    });
    if stats.tools_used >= 2 {
        traits.push(Trait {
            label: "Multi-Tool".to_string(),
            why: format!("{} tools with usage", stats.tools_used),
        });
    }

    let confidence = if stats.active_days >= 14 && stats.events >= 200 {
        "high"
    } else if stats.active_days >= 7 && stats.events >= 50 {
        "medium"
    } else {
        "low"
    }
    .to_string();

    let desc = build_description(name, &stats, &base, &modifier, &subtitle);

    Persona {
        title,
        subtitle,
        description: desc,
        traits,
        confidence,
        standing,
    }
}

#[derive(Default)]
struct Stats {
    processed: u64,
    real: u64,
    billed: u64,
    new_in: u64,
    write: u64,
    out: u64,
    cost: f64,
    sessions: HashSet<String>,
    active_days: u64,
    events: u64,
    tools_used: usize,
    peak_hour: u8,
    current_streak: u64,
    longest_streak: u64,
    max_day_processed: u64,
    total_focus_sec: u64,
    first_date: Option<String>,
    model_share: HashMap<String, u64>,
}

fn compute_stats(snap: &Snapshot) -> Stats {
    let mut s = Stats::default();
    let mut all_days: HashMap<String, DayAgg> = HashMap::new();
    let mut hours = [0u64; 24];

    for tool in snap.tools.values() {
        if !tool.present || tool.days.is_empty() {
            continue;
        }
        s.tools_used += 1;
        for d in &tool.days {
            s.processed += d.new_in + d.write + d.out;
            s.real += d.new_in + d.out;
            s.billed += d.new_in + d.write + d.read + d.out;
            s.new_in += d.new_in;
            s.write += d.write;
            s.out += d.out;
            s.cost += d.cost;
            s.events += d.messages;
            s.sessions.extend(d.sessions.iter().cloned());

            let day_proc = d.new_in + d.write + d.out;

            let agg = all_days.entry(d.date.clone()).or_default();
            agg.processed += day_proc;
            agg.focus_sec += d.focus_sec;

            for (m, v) in &d.models {
                *s.model_share.entry(m.clone()).or_insert(0) += *v;
            }
            for (h, hr) in hours.iter_mut().enumerate() {
                *hr += d.hours[h];
            }

            if s.first_date.is_none() || d.date < s.first_date.as_ref().unwrap().clone() {
                s.first_date = Some(d.date.clone());
            }
        }
    }

    s.peak_hour = hours
        .iter()
        .enumerate()
        .max_by_key(|(_, v)| *v)
        .map(|(i, _)| i as u8)
        .unwrap_or(0);

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

fn pick_base(stats: &Stats) -> String {
    let input = stats.new_in + stats.write;
    let out_ratio = stats.out as f64 / input.max(1) as f64;
    let in_ratio = input as f64 / stats.out.max(1) as f64;

    // Generation-heavy: the model writes far more than it's fed.
    if stats.out > 0 && out_ratio >= 2.5 {
        return "Output Engine".to_string();
    }
    if stats.out > 0 && out_ratio >= 1.3 {
        return "Generator".to_string();
    }
    // Context-heavy: huge prompts, lean replies.
    if input > 0 && in_ratio >= 4.0 {
        return "Context Hoarder".to_string();
    }
    if input > 0 && in_ratio >= 2.5 {
        return "Context Maximalist".to_string();
    }
    // Tool breadth.
    if stats.tools_used >= 5 {
        return "Full-Stack Operator".to_string();
    }
    if stats.tools_used >= 3 {
        return "Multi-Tool Operator".to_string();
    }
    // Model affinity is measured against total billed tokens (the same basis
    // model_share is keyed on), so numerator and denominator share a unit.
    let billed_total: u64 = stats.model_share.values().sum();
    let opus = stats.model_share.get("claude-opus-4-8").copied().unwrap_or(0)
        + stats.model_share.get("claude-opus-4-7").copied().unwrap_or(0);
    if billed_total > 0 && opus as f64 / billed_total as f64 >= 0.55 {
        return "Deep Thinker".to_string();
    }
    let sonnet = stats.model_share.get("claude-sonnet-4-6").copied().unwrap_or(0);
    if billed_total > 0 && sonnet as f64 / billed_total as f64 >= 0.55 {
        return "Workhorse".to_string();
    }
    let haiku = stats.model_share.get("claude-haiku-4-5-20251001").copied().unwrap_or(0)
        + stats.model_share.get("claude-haiku-4-5").copied().unwrap_or(0);
    if billed_total > 0 && haiku as f64 / billed_total as f64 >= 0.55 {
        return "Speed Runner".to_string();
    }
    "AI Engineer".to_string()
}

fn pick_modifier(stats: &Stats) -> String {
    let avg_focus = stats.total_focus_sec.checked_div(stats.active_days).unwrap_or(0);
    // Ordered most-impressive first, so the brag-worthiest signal wins.
    if stats.current_streak >= 30 {
        return "Iron-Willed".to_string();
    }
    if stats.max_day_processed >= 10_000_000 {
        return "Heavy Lifter".to_string();
    }
    if stats.peak_hour < 5 {
        return "Night-Shift Shipper".to_string();
    }
    if stats.max_day_processed >= 1_000_000 {
        return "Marathoner".to_string();
    }
    if stats.current_streak >= 7 {
        return "Daily Driver".to_string();
    }
    if avg_focus >= 3 * 3600 {
        return "Locked-In".to_string();
    }
    if stats.peak_hour >= 22 {
        return "Midnight Tinkerer".to_string();
    }
    if (5..8).contains(&stats.peak_hour) {
        return "Dawn Patroller".to_string();
    }
    "Builder".to_string()
}

fn pick_subtitle(processed: u64) -> String {
    if processed >= 1_000_000_000 {
        "Titan".to_string()
    } else if processed >= 250_000_000 {
        "Powerhouse".to_string()
    } else if processed >= 100_000_000 {
        "Heavy Operator".to_string()
    } else if processed >= 20_000_000 {
        "Power User".to_string()
    } else if processed >= 1_000_000 {
        "Regular".to_string()
    } else {
        "Dabbler".to_string()
    }
}

// "a" / "an" for a label, so descriptions read cleanly ("an Output Engine").
fn article(word: &str) -> &'static str {
    match word.chars().next() {
        Some(c) if "AEIOUaeiou".contains(c) => "an",
        _ => "a",
    }
}

fn base_why(stats: &Stats, base: &str) -> String {
    let input = stats.new_in + stats.write;
    match base {
        "Output Engine" | "Generator" => format!(
            "out {:.1}\u{00d7} input ({} out / {} in)",
            stats.out as f64 / input.max(1) as f64,
            human(stats.out),
            human(input)
        ),
        "Context Hoarder" | "Context Maximalist" => format!(
            "input {:.1}\u{00d7} output ({} in / {} out)",
            input as f64 / stats.out.max(1) as f64,
            human(input),
            human(stats.out)
        ),
        "Full-Stack Operator" | "Multi-Tool Operator" => format!("{} tools with usage", stats.tools_used),
        "Deep Thinker" => "Opus >= 55% of billed tokens".to_string(),
        "Workhorse" => "Sonnet >= 55% of billed tokens".to_string(),
        "Speed Runner" => "Haiku/small >= 55% of billed tokens".to_string(),
        _ => "Balanced input/output ratio".to_string(),
    }
}

fn modifier_why(stats: &Stats, modifier: &str) -> String {
    match modifier {
        "Night-Shift Shipper" | "Midnight Tinkerer" | "Dawn Patroller" => {
            format!("peak hour {}:00", stats.peak_hour)
        }
        "Iron-Willed" | "Daily Driver" => format!("{}-day streak", stats.current_streak),
        "Heavy Lifter" | "Marathoner" => {
            format!("max day {} processed", human(stats.max_day_processed))
        }
        "Locked-In" => {
            let avg = stats.total_focus_sec.checked_div(stats.active_days).unwrap_or(0);
            format!("avg {} focus/day", duration(avg))
        }
        _ => "Steady builder rhythm".to_string(),
    }
}

fn build_description(
    name: &str,
    stats: &Stats,
    base: &str,
    modifier: &str,
    subtitle: &str,
) -> String {
    let peak_label = if stats.peak_hour < 12 {
        format!("{} AM", stats.peak_hour)
    } else {
        format!("{} PM", stats.peak_hour - 12)
    };
    let avg_focus = stats.total_focus_sec.checked_div(stats.active_days).unwrap_or(0);
    let fav = stats
        .model_share
        .iter()
        .max_by_key(|(_, v)| *v)
        .map(|(k, _)| k.clone())
        .unwrap_or_else(|| "unknown".to_string());

    let modifier_explain = match modifier {
        "Night-Shift Shipper" => "ships code after midnight",
        "Midnight Tinkerer" => "ships late into the night",
        "Dawn Patroller" => "starts before the world wakes",
        "Iron-Willed" => "never lets the streak break",
        "Daily Driver" => "codes with AI every single day",
        "Heavy Lifter" => "moves huge volume in a single day",
        "Marathoner" => "has marathon sessions",
        "Locked-In" => "stays locked in for hours",
        _ => "builds steadily",
    };

    format!(
        "{}, you've processed {} tokens across {} tools — mostly {} around {}. You average {} of focused work a day and your best day hit {}. That reads as {} {} who {}. Volume tier: {}.",
        cap(name),
        human(stats.processed),
        stats.tools_used,
        pretty_model(&fav),
        peak_label,
        duration(avg_focus),
        human(stats.max_day_processed),
        article(base),
        base,
        modifier_explain,
        subtitle
    )
}

// Display a model id as a clean name. Never show raw hyphenated ids to the user.
fn pretty_model(id: &str) -> String {
    match id {
        "claude-opus-4-8" => "Opus 4.8".to_string(),
        "claude-opus-4-7" => "Opus 4.7".to_string(),
        "claude-sonnet-4-6" => "Sonnet 4.6".to_string(),
        "claude-haiku-4-5-20251001" | "claude-haiku-4-5" => "Haiku 4.5".to_string(),
        "gpt-5.5" => "GPT-5.5".to_string(),
        "gpt-5" => "GPT-5".to_string(),
        "kimi-code/kimi-for-coding" => "Kimi for Coding".to_string(),
        "<synthetic>" => "Synthetic".to_string(),
        other => other
            .strip_prefix("claude-")
            .unwrap_or(other)
            .split(['-', '_', '/'])
            .filter(|w| !w.is_empty())
            .map(cap)
            .collect::<Vec<_>>()
            .join(" "),
    }
}

// Capitalize the first character (for display names and words).
fn cap(s: &str) -> String {
    let mut ch = s.chars();
    match ch.next() {
        Some(f) => f.to_uppercase().collect::<String>() + ch.as_str(),
        None => String::new(),
    }
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

fn duration(sec: u64) -> String {
    let h = sec / 3600;
    let m = (sec % 3600) / 60;
    if h > 0 {
        format!("{}h {}m", h, m)
    } else {
        format!("{}m", m)
    }
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
    fn low_data_returns_starter() {
        let snap = snap_with(vec![day(100)], true);
        let p = from_snapshot(&snap, "Test");
        assert_eq!(p.title, "Just getting started");
        assert_eq!(p.confidence, "low");
    }

    #[test]
    fn enough_data_returns_persona() {
        let mut d = day(60_000);
        d.write = 10_000;
        d.out = 5_000;
        d.hours[14] = 50;
        let snap = snap_with(vec![d], true);
        let p = from_snapshot(&snap, "Test");
        assert!(!p.title.is_empty());
        assert!(!p.title.contains("Just getting started"));
        assert!(!p.traits.is_empty());
    }

    #[test]
    fn output_engine_when_very_output_heavy() {
        let mut d = day(60_000);
        d.new_in = 10_000;
        d.write = 0;
        d.out = 50_000; // out 5x input -> Output Engine (>= 2.5x)
        d.hours[10] = 1;
        let snap = snap_with(vec![d], true);
        let p = from_snapshot(&snap, "Test");
        assert!(p.title.contains("Output Engine"));
    }

    #[test]
    fn generator_when_moderately_output_heavy() {
        let mut d = day(60_000);
        d.new_in = 40_000;
        d.write = 0;
        d.out = 64_000; // out 1.6x input -> Generator, below the 2.5x cut
        d.hours[10] = 1;
        let snap = snap_with(vec![d], true);
        let p = from_snapshot(&snap, "Test");
        assert!(p.title.contains("Generator"));
        assert!(!p.title.contains("Output Engine"));
    }

    #[test]
    fn workhorse_when_sonnet_heavy() {
        let mut d = day(60_000);
        d.new_in = 60_000;
        d.write = 0;
        d.out = 45_000; // ratios sub-threshold so model affinity decides
        d.hours[14] = 5;
        d.models.insert("claude-sonnet-4-6".to_string(), 100);
        let snap = snap_with(vec![d], true);
        let p = from_snapshot(&snap, "Test");
        assert!(p.title.contains("Workhorse"));
    }

    #[test]
    fn night_shift_when_peak_before_5am() {
        let mut d = day(60_000);
        d.hours[2] = 100;
        let snap = snap_with(vec![d], true);
        let p = from_snapshot(&snap, "Test");
        assert!(p.title.contains("Night-Shift Shipper"));
    }
}
