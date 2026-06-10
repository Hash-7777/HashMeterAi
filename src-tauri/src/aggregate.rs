// ==============================================================
// HashMeterAi — Aggregate usage events into per-source/day records
// ==============================================================

use crate::model::{DayRecord, Snapshot, SourceOutput, UsageEvent};
use crate::sources::registry;
use chrono::{Local, Timelike};
use std::collections::{HashMap, HashSet};

const IDLE_CAP_SEC: i64 = 300;
const MIN_TURN_SEC: u64 = 30;

pub fn build(events: Vec<UsageEvent>) -> Snapshot {
    // Group events by source id.
    let mut by_source: HashMap<&str, Vec<UsageEvent>> = HashMap::new();
    for ev in events {
        by_source.entry(ev.source).or_default().push(ev);
    }

    let mut tools = HashMap::new();

    // Ensure every registered source appears in the output.
    for src in registry() {
        let id = src.id();
        let present = by_source.contains_key(id);
        let days = if present {
            aggregate_source(by_source.remove(id).unwrap())
        } else {
            Vec::new()
        };
        tools.insert(
            id.to_string(),
            SourceOutput {
                label: src.label().to_string(),
                present,
                days,
            },
        );
    }

    Snapshot {
        generated_at: Local::now().to_rfc3339(),
        tools,
    }
}

fn aggregate_source(events: Vec<UsageEvent>) -> Vec<DayRecord> {
    let mut by_day: HashMap<String, DayRecord> = HashMap::new();
    let mut sessions_set: HashMap<String, HashSet<String>> = HashMap::new();

    for ev in &events {
        let day = ev.date.clone();
        let rec = by_day.entry(day.clone()).or_insert_with(|| DayRecord::new(&day));

        rec.messages += 1;
        rec.new_in += ev.new_in;
        rec.write += ev.cache_write;
        rec.read += ev.cache_read;
        rec.out += ev.out;
        rec.cost += ev.cost;

        let h = ev.ts.hour() as usize;
        if h < 24 {
            rec.hours[h] += 1;
        }

        sessions_set
            .entry(day.clone())
            .or_default()
            .insert(ev.session.clone());

        let billed = ev.new_in + ev.cache_write + ev.cache_read + ev.out;
        *rec.models.entry(ev.model.clone()).or_insert(0) += billed;
    }

    // Compute focused time per day from session gaps.
    let focus_by_day = compute_focus(&events);
    for (day, sec) in focus_by_day {
        if let Some(rec) = by_day.get_mut(&day) {
            rec.focus_sec = sec;
        }
    }

    // Transfer session sets into sorted vectors.
    for (day, rec) in by_day.iter_mut() {
        if let Some(set) = sessions_set.remove(day) {
            let mut v: Vec<String> = set.into_iter().collect();
            v.sort();
            rec.sessions = v;
        }
    }

    let mut days: Vec<DayRecord> = by_day.into_values().collect();
    days.sort_by(|a, b| a.date.cmp(&b.date));
    days
}

fn compute_focus(events: &[UsageEvent]) -> HashMap<String, u64> {
    let mut by_session: HashMap<String, Vec<&UsageEvent>> = HashMap::new();
    for ev in events {
        by_session.entry(ev.session.clone()).or_default().push(ev);
    }

    let mut focus: HashMap<String, u64> = HashMap::new();
    for sess_events in by_session.values_mut() {
        sess_events.sort_by_key(|e| e.ts);
        for w in sess_events.windows(2) {
            let gap = w[1].ts.signed_duration_since(w[0].ts).num_seconds();
            let add = if gap <= IDLE_CAP_SEC {
                gap.max(0) as u64
            } else {
                MIN_TURN_SEC
            };
            *focus.entry(w[0].date.clone()).or_insert(0) += add;
        }
    }
    focus
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn make_event(
        source: &'static str,
        date: &str,
        hour: u32,
        min: u32,
        sec: u32,
        session: &str,
        model: &str,
        ni: u64,
        cw: u64,
        cr: u64,
        ot: u64,
        cost: f64,
    ) -> UsageEvent {
        let ts = Local
            .with_ymd_and_hms(
                date[0..4].parse().unwrap(),
                date[5..7].parse().unwrap(),
                date[8..10].parse().unwrap(),
                hour,
                min,
                sec,
            )
            .unwrap();
        UsageEvent {
            ts,
            date: date.to_string(),
            source,
            model: model.to_string(),
            new_in: ni,
            cache_write: cw,
            cache_read: cr,
            out: ot,
            session: session.to_string(),
            cost,
        }
    }

    #[test]
    fn aggregate_groups_by_day_and_sums_buckets() {
        let events = vec![
            make_event("claude", "2026-06-10", 10, 0, 0, "s1", "opus", 100, 10, 20, 50, 0.01),
            make_event("claude", "2026-06-10", 11, 0, 0, "s1", "opus", 50, 5, 10, 25, 0.005),
            make_event("claude", "2026-06-11", 9, 0, 0, "s2", "sonnet", 30, 0, 0, 15, 0.002),
        ];
        let snap = build(events);
        let claude = snap.tools.get("claude").unwrap();
        assert!(claude.present);
        assert_eq!(claude.days.len(), 2);

        let d1 = &claude.days[0];
        assert_eq!(d1.date, "2026-06-10");
        assert_eq!(d1.messages, 2);
        assert_eq!(d1.new_in, 150);
        assert_eq!(d1.write, 15);
        assert_eq!(d1.read, 30);
        assert_eq!(d1.out, 75);
        assert_eq!(d1.sessions, vec!["s1"]);
        assert_eq!(d1.hours[10], 1);
        assert_eq!(d1.hours[11], 1);

        let d2 = &claude.days[1];
        assert_eq!(d2.date, "2026-06-11");
        assert_eq!(d2.new_in, 30);
        assert_eq!(d2.sessions, vec!["s2"]);
    }

    #[test]
    fn aggregate_models_use_billed_tokens() {
        let events = vec![
            make_event("claude", "2026-06-10", 10, 0, 0, "s1", "opus", 100, 10, 20, 50, 0.01),
        ];
        let snap = build(events);
        let claude = snap.tools.get("claude").unwrap();
        let d1 = &claude.days[0];
        assert_eq!(d1.models.get("opus"), Some(&(100 + 10 + 20 + 50)));
    }

    #[test]
    fn aggregate_absent_source_has_empty_days() {
        let events = vec![];
        let snap = build(events);
        let claude = snap.tools.get("claude").unwrap();
        assert!(!claude.present);
        assert!(claude.days.is_empty());
    }

    #[test]
    fn focus_time_counts_gaps_under_idle_cap() {
        // Two events in the same session, 120 seconds apart
        let events = vec![
            make_event("claude", "2026-06-10", 10, 0, 0, "s1", "opus", 10, 0, 0, 5, 0.0),
            make_event("claude", "2026-06-10", 10, 2, 0, "s1", "opus", 10, 0, 0, 5, 0.0),
        ];
        let snap = build(events);
        let day = &snap.tools.get("claude").unwrap().days[0];
        assert_eq!(day.focus_sec, 120);
    }

    #[test]
    fn focus_time_uses_min_turn_for_large_gaps() {
        // Two events 600 seconds apart -> gap > 300, so MIN_TURN_SEC
        let events = vec![
            make_event("claude", "2026-06-10", 10, 0, 0, "s1", "opus", 10, 0, 0, 5, 0.0),
            make_event("claude", "2026-06-10", 10, 10, 0, "s1", "opus", 10, 0, 0, 5, 0.0),
        ];
        let snap = build(events);
        let day = &snap.tools.get("claude").unwrap().days[0];
        assert_eq!(day.focus_sec, MIN_TURN_SEC);
    }

    #[test]
    fn focus_time_is_zero_for_single_event_session() {
        let events = vec![
            make_event("claude", "2026-06-10", 10, 0, 0, "s1", "opus", 10, 0, 0, 5, 0.0),
        ];
        let snap = build(events);
        let day = &snap.tools.get("claude").unwrap().days[0];
        assert_eq!(day.focus_sec, 0);
    }

    #[test]
    fn focus_time_splits_across_days() {
        // Session spans midnight: 23:59 on day 1, 00:01 on day 2 (gap = 120s)
        let events = vec![
            make_event("claude", "2026-06-10", 23, 59, 0, "s1", "opus", 10, 0, 0, 5, 0.0),
            make_event("claude", "2026-06-11", 0, 1, 0, "s1", "opus", 10, 0, 0, 5, 0.0),
        ];
        let snap = build(events);
        let claude = snap.tools.get("claude").unwrap();
        let d1 = &claude.days[0];
        let d2 = &claude.days[1];
        // Gap attributed to day of first event
        assert_eq!(d1.focus_sec, 120);
        assert_eq!(d2.focus_sec, 0);
    }
}
