// ==============================================================
// HashMeterAi — Qwen adapter (Qwen Code CLI + Qwen desktop, one source)
//
// The on-disk format is NOT publicly documented (qwen-code is a Gemini-CLI
// fork; the desktop app is newer). So this is a BEST-EFFORT, flexible reader:
// it walks JSON / JSONL under the Qwen data dirs and recognizes the common
// per-message token-usage shapes, attributing each record to its model:
//   - Gemini:    usageMetadata { promptTokenCount, candidatesTokenCount,
//                cachedContentTokenCount }
//   - OpenAI:    usage { prompt_tokens, completion_tokens,
//                prompt_tokens_details.cached_tokens }
//   - Anthropic: usage { input_tokens, output_tokens,
//                cache_creation_input_tokens, cache_read_input_tokens }
//   - generic camelCase: inputTokens / outputTokens / ...
//
// VERIFY against real Qwen logs and adjust the field names / paths if a shape
// differs — synthetic tests below lock in the shapes we currently support.
// ==============================================================

use crate::model::UsageEvent;
use crate::rates::event_cost;
use crate::sources::{ScanCtx, Source};
use chrono::{DateTime, Local};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

pub struct Qwen;

impl Source for Qwen {
    fn id(&self) -> &'static str {
        "qwen"
    }

    fn label(&self) -> &'static str {
        "Qwen"
    }

    fn detect(&self, ctx: &ScanCtx) -> bool {
        self.roots(ctx).iter().any(|p| p.exists())
    }

    fn roots(&self, ctx: &ScanCtx) -> Vec<PathBuf> {
        // Qwen Code CLI (~/.qwen) plus likely desktop-app support dirs. Both
        // roll up under the single "Qwen" source.
        vec![
            ctx.home.join(".qwen"),
            ctx.home.join(".config/qwen"),
            ctx.home.join("Library/Application Support/Qwen"),
            ctx.home.join("Library/Application Support/qwen"),
            ctx.home.join("Library/Application Support/Qwen Code"),
        ]
    }

    fn scan(&self, ctx: &ScanCtx) -> Vec<UsageEvent> {
        let mut events = Vec::new();
        for root in self.roots(ctx) {
            if !root.exists() {
                continue;
            }
            for e in walkdir::WalkDir::new(&root)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let p = e.path();
                let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("");
                if ext != "json" && ext != "jsonl" {
                    continue;
                }
                let sid = format!(
                    "qwen:{}",
                    p.file_stem().and_then(|s| s.to_str()).unwrap_or("")
                );
                if let Ok(content) = fs::read_to_string(p) {
                    scan_content(&content, &sid, &mut events);
                }
            }
        }
        events
    }
}

fn scan_content(content: &str, sid: &str, out: &mut Vec<UsageEvent>) {
    // Whole-file JSON first (a history/checkpoint array or object); fall back to
    // JSONL, one record per line.
    if let Ok(v) = serde_json::from_str::<Value>(content) {
        collect_from_value(&v, sid, out);
    } else {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || (!line.contains("oken") && !line.contains("usage")) {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<Value>(line) {
                if let Some(ev) = record_to_event(&v, sid) {
                    out.push(ev);
                }
            }
        }
    }
}

fn collect_from_value(v: &Value, sid: &str, out: &mut Vec<UsageEvent>) {
    match v {
        Value::Array(arr) => {
            for el in arr {
                collect_from_value(el, sid, out);
            }
        }
        Value::Object(map) => {
            if let Some(ev) = record_to_event(v, sid) {
                out.push(ev);
                return;
            }
            for key in ["messages", "history", "turns", "records", "events", "items"] {
                if let Some(arr) = map.get(key).and_then(|x| x.as_array()) {
                    for el in arr {
                        collect_from_value(el, sid, out);
                    }
                }
            }
        }
        _ => {}
    }
}

fn record_to_event(v: &Value, sid: &str) -> Option<UsageEvent> {
    let usage = pick_usage(v)?;
    let (ni, cw, cr, ot) = extract_tokens(usage)?;
    if ni == 0 && cw == 0 && cr == 0 && ot == 0 {
        return None;
    }
    let ts = pick_ts(v)?;
    let date = ts.date_naive().to_string();
    let model = pick_model(v).unwrap_or_else(|| "qwen".to_string());
    let cost = event_cost(&model, "qwen", ni, cw, cr, ot);
    Some(UsageEvent {
        ts,
        date,
        source: "qwen",
        model,
        new_in: ni,
        cache_write: cw,
        cache_read: cr,
        out: ot,
        session: sid.to_string(),
        cost,
    })
}

fn get_path<'a>(v: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut cur = v;
    for k in path {
        cur = cur.get(*k)?;
    }
    Some(cur)
}

fn has_token_fields(v: &Value) -> bool {
    const KEYS: &[&str] = &[
        "promptTokenCount",
        "candidatesTokenCount",
        "totalTokenCount",
        "prompt_tokens",
        "completion_tokens",
        "input_tokens",
        "output_tokens",
        "inputTokens",
        "outputTokens",
    ];
    v.is_object() && KEYS.iter().any(|k| v.get(*k).is_some())
}

fn pick_usage(v: &Value) -> Option<&Value> {
    const PATHS: &[&[&str]] = &[
        &["usage"],
        &["usageMetadata"],
        &["response", "usageMetadata"],
        &["response", "usage"],
        &["message", "usage"],
    ];
    for path in PATHS {
        if let Some(u) = get_path(v, path) {
            if has_token_fields(u) {
                return Some(u);
            }
        }
    }
    if has_token_fields(v) {
        return Some(v);
    }
    None
}

fn num(v: &Value, k: &str) -> u64 {
    v.get(k).and_then(|x| x.as_u64()).unwrap_or(0)
}

// Returns (new_input, cache_write, cache_read, output) for the first recognized
// token-usage shape.
fn extract_tokens(v: &Value) -> Option<(u64, u64, u64, u64)> {
    if v.get("promptTokenCount").is_some() || v.get("candidatesTokenCount").is_some() {
        // Gemini: promptTokenCount includes cached input.
        let prompt = num(v, "promptTokenCount");
        let cached = num(v, "cachedContentTokenCount");
        return Some((prompt.saturating_sub(cached), 0, cached, num(v, "candidatesTokenCount")));
    }
    if v.get("prompt_tokens").is_some() || v.get("completion_tokens").is_some() {
        // OpenAI-style.
        let prompt = num(v, "prompt_tokens");
        let cached = v
            .get("prompt_tokens_details")
            .map(|d| num(d, "cached_tokens"))
            .unwrap_or(0);
        return Some((prompt.saturating_sub(cached), 0, cached, num(v, "completion_tokens")));
    }
    if v.get("input_tokens").is_some() || v.get("output_tokens").is_some() {
        // Anthropic-style.
        return Some((
            num(v, "input_tokens"),
            num(v, "cache_creation_input_tokens"),
            num(v, "cache_read_input_tokens"),
            num(v, "output_tokens"),
        ));
    }
    if v.get("inputTokens").is_some() || v.get("outputTokens").is_some() {
        // generic camelCase.
        return Some((
            num(v, "inputTokens"),
            num(v, "cacheCreationInputTokens"),
            num(v, "cacheReadInputTokens"),
            num(v, "outputTokens"),
        ));
    }
    None
}

fn pick_model(v: &Value) -> Option<String> {
    const PATHS: &[&[&str]] = &[
        &["model"],
        &["modelName"],
        &["modelId"],
        &["model_id"],
        &["response", "modelVersion"],
        &["request", "model"],
        &["message", "model"],
    ];
    for path in PATHS {
        if let Some(s) = get_path(v, path).and_then(|x| x.as_str()) {
            if !s.is_empty() {
                return Some(s.to_string());
            }
        }
    }
    None
}

fn pick_ts(v: &Value) -> Option<DateTime<Local>> {
    for k in ["timestamp", "time", "createdAt", "created_at", "date", "ts"] {
        if let Some(val) = v.get(k) {
            if let Some(dt) = parse_ts(val) {
                return Some(dt);
            }
        }
    }
    None
}

fn parse_ts(val: &Value) -> Option<DateTime<Local>> {
    if let Some(n) = val.as_i64() {
        let (secs, nsub) = if n > 1_000_000_000_000 {
            (n / 1000, ((n % 1000) as u32) * 1_000_000)
        } else {
            (n, 0)
        };
        return DateTime::from_timestamp(secs, nsub).map(|d| d.with_timezone(&Local));
    }
    if let Some(s) = val.as_str() {
        if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
            return Some(dt.with_timezone(&Local));
        }
        if let Ok(n) = s.parse::<i64>() {
            let secs = if n > 1_000_000_000_000 { n / 1000 } else { n };
            return DateTime::from_timestamp(secs, 0).map(|d| d.with_timezone(&Local));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn gemini_shape_classified_by_model() {
        let v = json!({
            "timestamp": "2026-06-10T12:00:00Z",
            "response": {
                "modelVersion": "qwen3-coder",
                "usageMetadata": {
                    "promptTokenCount": 100,
                    "cachedContentTokenCount": 40,
                    "candidatesTokenCount": 30,
                    "totalTokenCount": 130
                }
            }
        });
        let ev = record_to_event(&v, "qwen:s").unwrap();
        assert_eq!(ev.source, "qwen");
        assert_eq!(ev.model, "qwen3-coder");
        assert_eq!(ev.new_in, 60); // 100 prompt - 40 cached
        assert_eq!(ev.cache_read, 40);
        assert_eq!(ev.out, 30);
    }

    #[test]
    fn openai_shape() {
        let v = json!({
            "time": 1750152000,
            "model": "qwen-max",
            "usage": {
                "prompt_tokens": 80,
                "completion_tokens": 20,
                "prompt_tokens_details": { "cached_tokens": 10 }
            }
        });
        let ev = record_to_event(&v, "qwen:s").unwrap();
        assert_eq!(ev.model, "qwen-max");
        assert_eq!(ev.new_in, 70);
        assert_eq!(ev.cache_read, 10);
        assert_eq!(ev.out, 20);
    }

    #[test]
    fn anthropic_shape_with_ms_timestamp() {
        let v = json!({
            "timestamp": 1_750_152_000_000_i64,
            "model": "qwen3-32b",
            "usage": {
                "input_tokens": 50,
                "output_tokens": 25,
                "cache_creation_input_tokens": 5,
                "cache_read_input_tokens": 15
            }
        });
        let ev = record_to_event(&v, "qwen:s").unwrap();
        assert_eq!(ev.new_in, 50);
        assert_eq!(ev.cache_write, 5);
        assert_eq!(ev.cache_read, 15);
        assert_eq!(ev.out, 25);
    }

    #[test]
    fn record_without_usage_is_skipped() {
        let v = json!({"timestamp": "2026-06-10T12:00:00Z", "type": "user", "message": "hi"});
        assert!(record_to_event(&v, "qwen:s").is_none());
    }

    #[test]
    fn whole_file_history_array() {
        let content = r#"{"messages":[{"time":1750152000,"model":"qwen3-coder","usage":{"prompt_tokens":10,"completion_tokens":5}}]}"#;
        let mut out = Vec::new();
        scan_content(content, "qwen:s", &mut out);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].model, "qwen3-coder");
        assert_eq!(out[0].out, 5);
    }
}
