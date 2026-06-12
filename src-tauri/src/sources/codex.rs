// ==============================================================
// HashMeterAi — Codex (OpenAI) adapter
//
// Root: ~/.codex/sessions/**/rollout-*.jsonl
// Format: JSONL; token events are payload.type == "token_count".
// ==============================================================

use crate::model::UsageEvent;
use crate::rates::event_cost;
use crate::sources::{ScanCtx, Source};
use chrono::Local;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

pub struct Codex;

impl Source for Codex {
    fn id(&self) -> &'static str {
        "codex"
    }

    fn label(&self) -> &'static str {
        "Codex"
    }

    fn detect(&self, ctx: &ScanCtx) -> bool {
        ctx.home.join(".codex/sessions").is_dir()
    }

    fn roots(&self, ctx: &ScanCtx) -> Vec<std::path::PathBuf> {
        vec![ctx.home.join(".codex/sessions")]
    }

    fn scan(&self, ctx: &ScanCtx) -> Vec<UsageEvent> {
        let root = ctx.home.join(".codex/sessions");
        let mut events = Vec::new();

        let files = walk_rollouts(&root);
        for path in files {
            let sid = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            let mut model = "gpt".to_string();

            if let Ok(file) = File::open(&path) {
                let reader = BufReader::new(file);
                for line in reader.lines().map_while(Result::ok) {
                    if line.is_empty() {
                        continue;
                    }
                    if !line.contains("token_count") && !line.contains("model") {
                        continue;
                    }
                    if let Ok(ev) = serde_json::from_str::<serde_json::Value>(&line) {
                        let payload = ev.get("payload");
                        if let Some(p) = payload.and_then(|p| p.as_object()) {
                            if let Some(m) = p.get("model").and_then(|v| v.as_str()) {
                                model = m.to_string();
                            }
                        }
                        if let Some(evt) = parse_line(&ev, &sid, &model) {
                            events.push(evt);
                        }
                    }
                }
            }
        }
        events
    }
}

fn walk_rollouts(root: &PathBuf) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for e in walkdir::WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let p = e.path();
        if let Some(name) = p.file_name().and_then(|s| s.to_str()) {
            if name.starts_with("rollout-") && name.ends_with(".jsonl") {
                out.push(p.to_path_buf());
            }
        }
    }
    out
}

fn parse_line(ev: &serde_json::Value, sid: &str, model: &str) -> Option<UsageEvent> {
    let ts_str = ev.get("timestamp")?.as_str()?;
    let ts = chrono::DateTime::parse_from_rfc3339(ts_str).ok()?;
    let ts_local = ts.with_timezone(&Local);
    let day = ts_local.date_naive().to_string();

    let payload = ev.get("payload")?;
    let ptype = payload.get("type")?.as_str()?;
    if ptype != "token_count" {
        return None;
    }

    let info = payload.get("info")?;
    let lu = info.get("last_token_usage")?;

    let it = lu.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
    let ca = lu
        .get("cached_input_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let ot = lu.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);

    let ni = it.saturating_sub(ca);
    let cost = event_cost(model, "codex", ni, 0, ca, ot);

    Some(UsageEvent {
        ts: ts_local,
        date: day,
        source: "codex",
        model: model.to_string(),
        new_in: ni,
        cache_write: 0,
        cache_read: ca,
        out: ot,
        session: sid.to_string(),
        cost,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn synth_token_count(ts: &str, it: u64, ca: u64, ot: u64) -> serde_json::Value {
        serde_json::json!({
            "timestamp": ts,
            "payload": {
                "type": "token_count",
                "info": {
                    "last_token_usage": {
                        "input_tokens": it,
                        "cached_input_tokens": ca,
                        "output_tokens": ot,
                    }
                }
            }
        })
    }

    #[test]
    fn codex_token_count_maps_four_buckets() {
        let ev = synth_token_count("2026-06-10T12:00:00Z", 200, 50, 80);
        let evt = parse_line(&ev, "rollout-1.jsonl", "gpt-5.5").unwrap();
        assert_eq!(evt.source, "codex");
        assert_eq!(evt.new_in, 150); // 200 - 50
        assert_eq!(evt.cache_read, 50);
        assert_eq!(evt.out, 80);
        assert_eq!(evt.cache_write, 0);
        assert_eq!(evt.model, "gpt-5.5");
        assert!(evt.cost > 0.0);
    }

    #[test]
    fn codex_ignores_non_token_count() {
        let ev = serde_json::json!({
            "timestamp": "2026-06-10T12:00:00Z",
            "payload": {"type": "other"}
        });
        assert!(parse_line(&ev, "sid", "gpt").is_none());
    }

    #[test]
    fn codex_zero_cached() {
        let ev = synth_token_count("2026-06-10T12:00:00Z", 100, 0, 30);
        let evt = parse_line(&ev, "sid", "gpt").unwrap();
        assert_eq!(evt.new_in, 100);
        assert_eq!(evt.cache_read, 0);
    }
}
