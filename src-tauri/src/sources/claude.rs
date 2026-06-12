// ==============================================================
// HashMeterAi — Claude Code adapter
//
// Root: ~/.claude/projects/**/*.jsonl
// Format: JSONL per line.
// ==============================================================

use crate::model::UsageEvent;
use crate::rates::event_cost;
use crate::sources::{ScanCtx, Source};
use chrono::Local;
use std::collections::HashSet;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

pub struct Claude;

impl Source for Claude {
    fn id(&self) -> &'static str {
        "claude"
    }

    fn label(&self) -> &'static str {
        "Claude Code"
    }

    fn detect(&self, ctx: &ScanCtx) -> bool {
        ctx.home.join(".claude/projects").is_dir()
    }

    fn roots(&self, ctx: &ScanCtx) -> Vec<std::path::PathBuf> {
        vec![ctx.home.join(".claude/projects")]
    }

    fn scan(&self, ctx: &ScanCtx) -> Vec<UsageEvent> {
        let root = ctx.home.join(".claude/projects");
        let mut events = Vec::new();
        let mut seen = HashSet::new();

        let files = walk_jsonl(&root);
        for path in files {
            if let Ok(file) = File::open(&path) {
                let reader = BufReader::new(file);
                for line in reader.lines().map_while(Result::ok) {
                    if line.is_empty() {
                        continue;
                    }
                    if let Ok(ev) = serde_json::from_str::<serde_json::Value>(&line) {
                        if let Some(evt) = parse_line(&ev, &mut seen) {
                            events.push(evt);
                        }
                    }
                }
            }
        }
        events
    }
}

fn walk_jsonl(root: &PathBuf) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for e in walkdir::WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let p = e.path();
        if p.extension().and_then(|s| s.to_str()) == Some("jsonl") {
            let name = p.file_name().and_then(|s| s.to_str()).unwrap_or("");
            if name == "auth.json"
                || name == "credentials"
                || name.ends_with(".key")
                || name.ends_with(".pem")
            {
                continue;
            }
            out.push(p.to_path_buf());
        }
    }
    out
}

fn parse_line(ev: &serde_json::Value, seen: &mut HashSet<String>) -> Option<UsageEvent> {
    let ts_str = ev.get("timestamp")?.as_str()?;
    let ts = chrono::DateTime::parse_from_rfc3339(ts_str).ok()?;
    let ts_local = ts.with_timezone(&Local);
    let day = ts_local.date_naive().to_string();

    let sid = ev
        .get("sessionId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let typ = ev.get("type")?.as_str()?;
    if typ != "user" && typ != "assistant" {
        return None;
    }

    if typ == "user" {
        return Some(UsageEvent {
            ts: ts_local,
            date: day,
            source: "claude",
            model: String::new(),
            new_in: 0,
            cache_write: 0,
            cache_read: 0,
            out: 0,
            session: sid,
            cost: 0.0,
        });
    }

    let msg = ev.get("message")?;
    let mid = msg.get("id").and_then(|v| v.as_str());
    if let Some(id) = mid {
        if seen.contains(id) {
            return None;
        }
        seen.insert(id.to_string());
    }

    let model = msg
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("claude-opus-4-8")
        .to_string();

    let usage = msg.get("usage")?;
    let ni = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
    let cw = usage
        .get("cache_creation_input_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let cr = usage
        .get("cache_read_input_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let ot = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);

    let cost = event_cost(&model, "claude", ni, cw, cr, ot);

    Some(UsageEvent {
        ts: ts_local,
        date: day,
        source: "claude",
        model,
        new_in: ni,
        cache_write: cw,
        cache_read: cr,
        out: ot,
        session: sid,
        cost,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn synth_user(ts: &str) -> serde_json::Value {
        serde_json::json!({
            "type": "user",
            "timestamp": ts,
            "sessionId": "s1",
        })
    }

    fn synth_assistant(ts: &str, mid: &str, model: &str, ni: u64, cw: u64, cr: u64, ot: u64) -> serde_json::Value {
        serde_json::json!({
            "type": "assistant",
            "timestamp": ts,
            "sessionId": "s1",
            "message": {
                "id": mid,
                "model": model,
                "usage": {
                    "input_tokens": ni,
                    "cache_creation_input_tokens": cw,
                    "cache_read_input_tokens": cr,
                    "output_tokens": ot,
                }
            }
        })
    }

    #[test]
    fn claude_user_event_counts_message_no_tokens() {
        let mut seen = HashSet::new();
        let ev = parse_line(&synth_user("2026-06-10T12:00:00Z"), &mut seen).unwrap();
        assert_eq!(ev.source, "claude");
        assert_eq!(ev.new_in, 0);
        assert_eq!(ev.out, 0);
        assert_eq!(ev.session, "s1");
    }

    #[test]
    fn claude_assistant_event_parses_four_buckets() {
        let mut seen = HashSet::new();
        let ev = parse_line(
            &synth_assistant("2026-06-10T12:01:00Z", "m1", "claude-opus-4-8", 100, 10, 20, 50),
            &mut seen,
        )
        .unwrap();
        assert_eq!(ev.new_in, 100);
        assert_eq!(ev.cache_write, 10);
        assert_eq!(ev.cache_read, 20);
        assert_eq!(ev.out, 50);
        assert_eq!(ev.model, "claude-opus-4-8");
        assert!(ev.cost > 0.0);
    }

    #[test]
    fn claude_dedup_skips_duplicate_message_id() {
        let mut seen = HashSet::new();
        let a = synth_assistant("2026-06-10T12:01:00Z", "dup", "claude-opus-4-8", 10, 0, 0, 5);
        let b = synth_assistant("2026-06-10T12:02:00Z", "dup", "claude-opus-4-8", 10, 0, 0, 5);
        assert!(parse_line(&a, &mut seen).is_some());
        assert!(parse_line(&b, &mut seen).is_none());
        assert_eq!(seen.len(), 1);
    }

    #[test]
    fn claude_ignores_non_user_assistant() {
        let mut seen = HashSet::new();
        let ev = serde_json::json!({"type": "system", "timestamp": "2026-06-10T12:00:00Z"});
        assert!(parse_line(&ev, &mut seen).is_none());
    }
}
