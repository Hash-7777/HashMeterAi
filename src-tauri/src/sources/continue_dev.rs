// ==============================================================
// HashMeterAi — Continue.dev adapter
//
// Root: ~/.continue/dev_data/**/tokensGenerated.jsonl
// Format: JSONL; events where eventName == "tokensGenerated".
// ==============================================================

use crate::model::UsageEvent;
use crate::rates::event_cost;
use crate::sources::{ScanCtx, Source};
use chrono::Local;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

pub struct ContinueDev;

impl Source for ContinueDev {
    fn id(&self) -> &'static str {
        "continue"
    }

    fn label(&self) -> &'static str {
        "Continue"
    }

    fn detect(&self, ctx: &ScanCtx) -> bool {
        ctx.home.join(".continue/dev_data").is_dir()
    }

    fn scan(&self, ctx: &ScanCtx) -> Vec<UsageEvent> {
        let root = ctx.home.join(".continue/dev_data");
        let mut events = Vec::new();

        let files = walk_tokens(&root);
        for path in files {
            if let Ok(file) = File::open(&path) {
                let reader = BufReader::new(file);
                for line in reader.lines().map_while(Result::ok) {
                    if line.is_empty() {
                        continue;
                    }
                    if !line.contains("tokensGenerated") {
                        continue;
                    }
                    if let Ok(ev) = serde_json::from_str::<serde_json::Value>(&line) {
                        if let Some(evt) = parse_line(&ev) {
                            events.push(evt);
                        }
                    }
                }
            }
        }
        events
    }
}

fn walk_tokens(root: &PathBuf) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if !root.exists() {
        return out;
    }
    for e in walkdir::WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let p = e.path();
        if p.file_name().and_then(|s| s.to_str()) == Some("tokensGenerated.jsonl") {
            out.push(p.to_path_buf());
        }
    }
    out
}

fn parse_line(ev: &serde_json::Value) -> Option<UsageEvent> {
    let event_name = ev.get("eventName")?.as_str()?;
    if event_name != "tokensGenerated" {
        return None;
    }

    let ts_str = ev.get("timestamp")?.as_str()?;
    let ts = chrono::DateTime::parse_from_rfc3339(ts_str).ok()?;
    let ts_local = ts.with_timezone(&Local);
    let day = ts_local.date_naive().to_string();

    let model = ev.get("model").and_then(|v| v.as_str()).unwrap_or("unknown");
    let provider = ev.get("provider").and_then(|v| v.as_str()).unwrap_or("");
    let ni = ev.get("promptTokens").and_then(|v| v.as_u64()).unwrap_or(0);
    let ot = ev.get("generatedTokens").and_then(|v| v.as_u64()).unwrap_or(0);

    let is_local = provider.eq_ignore_ascii_case("ollama")
        || provider.eq_ignore_ascii_case("lmstudio")
        || provider.eq_ignore_ascii_case("local");
    let cost = if is_local {
        0.0
    } else {
        event_cost(model, provider, ni, 0, 0, ot)
    };

    let session = format!("continue:{}", day);

    Some(UsageEvent {
        ts: ts_local,
        date: day,
        source: "continue",
        model: model.to_string(),
        new_in: ni,
        cache_write: 0,
        cache_read: 0,
        out: ot,
        session,
        cost,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn synth(ts: &str, model: &str, provider: &str, pt: u64, gt: u64) -> serde_json::Value {
        serde_json::json!({
            "timestamp": ts,
            "eventName": "tokensGenerated",
            "model": model,
            "provider": provider,
            "promptTokens": pt,
            "generatedTokens": gt,
        })
    }

    #[test]
    fn continue_maps_prompt_and_generated() {
        let ev = synth("2026-06-10T12:00:00Z", "llama3.1:8b", "ollama", 186, 42);
        let evt = parse_line(&ev).unwrap();
        assert_eq!(evt.source, "continue");
        assert_eq!(evt.model, "llama3.1:8b");
        assert_eq!(evt.new_in, 186);
        assert_eq!(evt.out, 42);
        assert_eq!(evt.cache_write, 0);
        assert_eq!(evt.cache_read, 0);
        assert_eq!(evt.cost, 0.0); // ollama = local = free
    }

    #[test]
    fn continue_cloud_provider_has_cost() {
        let ev = synth("2026-06-10T12:00:00Z", "gpt-4", "openai", 1000, 500);
        let evt = parse_line(&ev).unwrap();
        assert!(evt.cost > 0.0);
    }

    #[test]
    fn continue_ignores_non_tokens_generated() {
        let ev = serde_json::json!({
            "timestamp": "2026-06-10T12:00:00Z",
            "eventName": "otherEvent",
            "model": "x",
            "provider": "y",
            "promptTokens": 10,
            "generatedTokens": 5,
        });
        assert!(parse_line(&ev).is_none());
    }
}
