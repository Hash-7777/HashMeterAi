// ==============================================================
// HashMeterAi — Kimi adapter (new + old formats)
//
// NEW: ~/.kimi-code/sessions/**/wire.jsonl   (type == "usage.record")
// OLD: ~/.kimi/sessions/**/wire.jsonl       (message.payload.token_usage)
// ==============================================================

use crate::model::UsageEvent;
use crate::rates::event_cost;
use crate::sources::{ScanCtx, Source};
use chrono::Local;
use std::collections::HashSet;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

pub struct Kimi;

impl Source for Kimi {
    fn id(&self) -> &'static str {
        "kimi"
    }

    fn label(&self) -> &'static str {
        "Kimi"
    }

    fn detect(&self, ctx: &ScanCtx) -> bool {
        ctx.home.join(".kimi-code/sessions").is_dir()
            || ctx.home.join(".kimi/sessions").is_dir()
    }

    fn roots(&self, ctx: &ScanCtx) -> Vec<std::path::PathBuf> {
        vec![
            ctx.home.join(".kimi-code/sessions"),
            ctx.home.join(".kimi/sessions"),
        ]
    }

    fn scan(&self, ctx: &ScanCtx) -> Vec<UsageEvent> {
        let mut events = Vec::new();
        events.extend(scan_new(ctx));
        events.extend(scan_old(ctx));
        events
    }
}

// ---------- NEW format ----------

fn scan_new(ctx: &ScanCtx) -> Vec<UsageEvent> {
    let root = ctx.home.join(".kimi-code/sessions");
    let mut events = Vec::new();

    let files = walk_wire(&root);
    for path in files {
        let sid = extract_session_new(&path);
        let mut model = "kimi-code/kimi-for-coding".to_string();

        if let Ok(file) = File::open(&path) {
            let reader = BufReader::new(file);
            for line in reader.lines().map_while(Result::ok) {
                if line.is_empty() {
                    continue;
                }
                if !line.contains("usage") && !line.contains("model") {
                    continue;
                }
                if let Ok(ev) = serde_json::from_str::<serde_json::Value>(&line) {
                    // Track the active model so each usage record is attributed to
                    // the model that produced it (Kimi can switch versions within a
                    // session). Prefer the most specific field present.
                    for key in ["model", "modelName", "modelId", "modelAlias"] {
                        if let Some(m) = ev.get(key).and_then(|v| v.as_str()) {
                            if !m.is_empty() {
                                model = m.to_string();
                                break;
                            }
                        }
                    }
                    if ev.get("type").and_then(|v| v.as_str()) != Some("usage.record") {
                        continue;
                    }
                    if let Some(evt) = parse_new_line(&ev, &sid, &model) {
                        events.push(evt);
                    }
                }
            }
        }
    }
    events
}

fn extract_session_new(path: &std::path::Path) -> String {
    let s = path.to_string_lossy();
    if let Some(pos) = s.find("/session_") {
        let rest = &s[pos + 9..];
        let end = rest.find('/').unwrap_or(rest.len());
        format!("kc:{}", &rest[..end])
    } else {
        format!("kc:{}", path.file_name().and_then(|n| n.to_str()).unwrap_or(""))
    }
}

fn parse_new_line(ev: &serde_json::Value, sid: &str, model: &str) -> Option<UsageEvent> {
    let usage = ev.get("usage")?;
    let t = ev.get("time")?.as_i64()?;
    let ts = chrono::DateTime::from_timestamp(t / 1000, ((t % 1000) as u32) * 1_000_000)?;
    let ts_local = ts.with_timezone(&Local);
    let day = ts_local.date_naive().to_string();

    let ni = usage.get("inputOther").and_then(|v| v.as_u64()).unwrap_or(0);
    let cw = usage
        .get("inputCacheCreation")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let cr = usage
        .get("inputCacheRead")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let ot = usage.get("output").and_then(|v| v.as_u64()).unwrap_or(0);

    let cost = event_cost(model, "kimi", ni, cw, cr, ot);

    Some(UsageEvent {
        ts: ts_local,
        date: day,
        source: "kimi",
        model: model.to_string(),
        new_in: ni,
        cache_write: cw,
        cache_read: cr,
        out: ot,
        session: sid.to_string(),
        cost,
    })
}

// ---------- OLD format ----------

fn scan_old(ctx: &ScanCtx) -> Vec<UsageEvent> {
    let root = ctx.home.join(".kimi/sessions");
    let mut events = Vec::new();
    let mut seen = HashSet::new();

    let files = walk_wire(&root);
    for path in files {
        let sid = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        if let Ok(file) = File::open(&path) {
            let reader = BufReader::new(file);
            for line in reader.lines().map_while(Result::ok) {
                if line.is_empty() {
                    continue;
                }
                if !line.contains("token_usage") {
                    continue;
                }
                if let Ok(ev) = serde_json::from_str::<serde_json::Value>(&line) {
                    if let Some(evt) = parse_old_line(&ev, &sid, &mut seen) {
                        events.push(evt);
                    }
                }
            }
        }
    }
    events
}

fn parse_old_line(
    ev: &serde_json::Value,
    sid: &str,
    seen: &mut HashSet<String>,
) -> Option<UsageEvent> {
    let payload = ev.get("message")?.get("payload")?;
    let tu = payload.get("token_usage")?;

    let mid = payload.get("message_id").and_then(|v| v.as_str());
    if let Some(id) = mid {
        if seen.contains(id) {
            return None;
        }
        seen.insert(id.to_string());
    }

    let ts_raw = ev.get("timestamp")?.as_f64()?;
    let ts = chrono::DateTime::from_timestamp(ts_raw as i64, 0)?;
    let ts_local = ts.with_timezone(&Local);
    let day = ts_local.date_naive().to_string();

    let ni = tu.get("input_other").and_then(|v| v.as_u64()).unwrap_or(0);
    let cw = tu
        .get("input_cache_creation")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let cr = tu
        .get("input_cache_read")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let ot = tu.get("output").and_then(|v| v.as_u64()).unwrap_or(0);

    // Use the per-message model when the transcript records one, so Kimi usage
    // is classified by model rather than lumped under a single name.
    let model = payload
        .get("model")
        .or_else(|| payload.get("model_name"))
        .or_else(|| ev.get("message").and_then(|m| m.get("model")))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("kimi-code/kimi-for-coding");
    let cost = event_cost(model, "kimi", ni, cw, cr, ot);

    Some(UsageEvent {
        ts: ts_local,
        date: day,
        source: "kimi",
        model: model.to_string(),
        new_in: ni,
        cache_write: cw,
        cache_read: cr,
        out: ot,
        session: sid.to_string(),
        cost,
    })
}

// ---------- helpers ----------

fn walk_wire(root: &std::path::Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if !root.exists() {
        return out;
    }
    for e in walkdir::WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let p = e.path();
        if p.file_name().and_then(|s| s.to_str()) == Some("wire.jsonl") {
            out.push(p.to_path_buf());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn synth_new(ts_ms: i64, ni: u64, cw: u64, cr: u64, ot: u64) -> serde_json::Value {
        serde_json::json!({
            "type": "usage.record",
            "time": ts_ms,
            "usage": {
                "inputOther": ni,
                "inputCacheCreation": cw,
                "inputCacheRead": cr,
                "output": ot,
            }
        })
    }

    fn synth_old(ts: f64, mid: &str, ni: u64, cw: u64, cr: u64, ot: u64) -> serde_json::Value {
        serde_json::json!({
            "timestamp": ts,
            "message": {
                "payload": {
                    "message_id": mid,
                    "token_usage": {
                        "input_other": ni,
                        "input_cache_creation": cw,
                        "input_cache_read": cr,
                        "output": ot,
                    }
                }
            }
        })
    }

    #[test]
    fn kimi_new_format_four_buckets() {
        // 2026-06-10 12:00:00 UTC in ms
        let ms = 1750152000000i64;
        let ev = synth_new(ms, 80, 5, 15, 40);
        let evt = parse_new_line(&ev, "kc:s1", "kimi-code/kimi-for-coding").unwrap();
        assert_eq!(evt.source, "kimi");
        assert_eq!(evt.new_in, 80);
        assert_eq!(evt.cache_write, 5);
        assert_eq!(evt.cache_read, 15);
        assert_eq!(evt.out, 40);
        assert!(evt.cost > 0.0);
    }

    #[test]
    fn kimi_old_format_four_buckets_and_dedup() {
        let mut seen = HashSet::new();
        let ev = synth_old(1750152000.0, "old1", 60, 3, 10, 25);
        let evt = parse_old_line(&ev, "sid-old", &mut seen).unwrap();
        assert_eq!(evt.new_in, 60);
        assert_eq!(evt.cache_write, 3);
        assert_eq!(evt.cache_read, 10);
        assert_eq!(evt.out, 25);
        assert_eq!(evt.model, "kimi-code/kimi-for-coding");

        // duplicate message_id should be skipped
        let dup = synth_old(1750152001.0, "old1", 60, 3, 10, 25);
        assert!(parse_old_line(&dup, "sid-old", &mut seen).is_none());
    }

    #[test]
    fn kimi_new_ignores_non_usage_record() {
        let ev = serde_json::json!({"type": "context.append_loop_event", "time": 0});
        assert!(parse_new_line(&ev, "sid", "model").is_none());
    }

    #[test]
    fn kimi_old_reads_model_when_present() {
        // When the transcript records a model, usage is attributed to it instead
        // of the generic Kimi name — so Kimi is classified by model.
        let mut seen = HashSet::new();
        let mut ev = synth_old(1750152000.0, "mid-x", 10, 0, 0, 5);
        ev["message"]["payload"]["model"] = serde_json::json!("kimi-2.6");
        let evt = parse_old_line(&ev, "sid", &mut seen).unwrap();
        assert_eq!(evt.model, "kimi-2.6");
    }
}
