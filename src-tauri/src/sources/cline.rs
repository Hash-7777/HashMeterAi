// ==============================================================
// HashMeterAi — Cline adapter (guarded)
//
// Roots (VS Code / Cursor / Windsurf globalStorage):
//   macOS: ~/Library/Application Support/{Code,Cursor,Windsurf}/...
//   Linux: ~/.config/{Code,Cursor}/...
//   Windows: %APPDATA%\{Code,Cursor}\...
//
// Per task: <taskId>/ui_messages.json (array).
// Token usage in entries where say == "api_req_started";
// text is a JSON string containing { tokensIn, tokensOut, ... }.
//
// This adapter parses defensively; schema mismatches are skipped
// rather than crashing the scan.
// ==============================================================

use crate::model::UsageEvent;
use crate::rates::event_cost;
use crate::sources::{ScanCtx, Source};
use chrono::Local;
use std::fs::File;
use std::io::Read;
use std::path::PathBuf;

pub struct Cline;

impl Source for Cline {
    fn id(&self) -> &'static str {
        "cline"
    }

    fn label(&self) -> &'static str {
        "Cline"
    }

    fn detect(&self, ctx: &ScanCtx) -> bool {
        possible_roots(ctx)
            .iter()
            .any(|r| r.is_dir())
    }

    fn roots(&self, ctx: &ScanCtx) -> Vec<std::path::PathBuf> {
        possible_roots(ctx)
    }

    fn scan(&self, ctx: &ScanCtx) -> Vec<UsageEvent> {
        let mut events = Vec::new();
        for root in possible_roots(ctx) {
            if !root.is_dir() {
                continue;
            }
            events.extend(scan_root(&root));
        }
        events
    }
}

fn possible_roots(ctx: &ScanCtx) -> Vec<PathBuf> {
    let mut out = Vec::new();
    #[cfg(target_os = "macos")]
    {
        for editor in ["Code", "Cursor", "Windsurf"] {
            out.push(
                ctx.home
                    .join(format!(
                        "Library/Application Support/{}/User/globalStorage/saoudrizwan.claude-dev/tasks",
                        editor
                    )),
            );
        }
    }
    #[cfg(target_os = "linux")]
    {
        for editor in ["Code", "Cursor"] {
            out.push(
                ctx.home
                    .join(format!(
                        ".config/{}/User/globalStorage/saoudrizwan.claude-dev/tasks",
                        editor
                    )),
            );
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            for editor in ["Code", "Cursor"] {
                out.push(
                    PathBuf::from(&appdata)
                        .join(format!(
                            "{}\\User\\globalStorage\\saoudrizwan.claude-dev\\tasks",
                            editor
                        )),
                );
            }
        }
    }
    out
}

fn scan_root(root: &PathBuf) -> Vec<UsageEvent> {
    let mut events = Vec::new();
    let entries = match std::fs::read_dir(root) {
        Ok(e) => e,
        Err(_) => return events,
    };

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let task_id = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let msg_file = path.join("ui_messages.json");
        if !msg_file.exists() {
            continue;
        }
        events.extend(parse_task(&msg_file, &task_id));
    }
    events
}

fn parse_task(path: &PathBuf, task_id: &str) -> Vec<UsageEvent> {
    let mut out = Vec::new();
    let mut buf = String::new();
    if File::open(path)
        .and_then(|mut f| f.read_to_string(&mut buf))
        .is_err()
    {
        return out;
    }

    let arr = match serde_json::from_str::<Vec<serde_json::Value>>(&buf) {
        Ok(a) => a,
        Err(_) => return out,
    };

    for item in arr {
        if item.get("say").and_then(|v| v.as_str()) != Some("api_req_started") {
            continue;
        }
        let text = match item.get("text").and_then(|v| v.as_str()) {
            Some(t) => t,
            None => continue,
        };
        let inner = match serde_json::from_str::<serde_json::Value>(text) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if let Some(ev) = parse_api_req(&inner, task_id) {
            out.push(ev);
        }
    }
    out
}

fn parse_api_req(inner: &serde_json::Value, task_id: &str) -> Option<UsageEvent> {
    let ts_raw = inner
        .get("ts")
        .and_then(|v| v.as_i64())
        .or_else(|| inner.get("timestamp").and_then(|v| v.as_i64()))?;
    let ts = chrono::DateTime::from_timestamp(ts_raw / 1000, ((ts_raw % 1000) as u32) * 1_000_000)?;
    let ts_local = ts.with_timezone(&Local);
    let day = ts_local.date_naive().to_string();

    let ni = inner.get("tokensIn").and_then(|v| v.as_u64()).unwrap_or(0);
    let ot = inner.get("tokensOut").and_then(|v| v.as_u64()).unwrap_or(0);
    let cw = inner.get("cacheWrites").and_then(|v| v.as_u64()).unwrap_or(0);
    let cr = inner.get("cacheReads").and_then(|v| v.as_u64()).unwrap_or(0);

    let model = inner
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let cost = event_cost(model, "cline", ni, cw, cr, ot);

    Some(UsageEvent {
        ts: ts_local,
        date: day,
        source: "cline",
        model: model.to_string(),
        new_in: ni,
        cache_write: cw,
        cache_read: cr,
        out: ot,
        session: task_id.to_string(),
        cost,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn synth(ts: i64, ni: u64, ot: u64, cw: u64, cr: u64) -> serde_json::Value {
        serde_json::json!({
            "ts": ts,
            "tokensIn": ni,
            "tokensOut": ot,
            "cacheWrites": cw,
            "cacheReads": cr,
            "model": "claude-sonnet-4",
        })
    }

    #[test]
    fn cline_maps_four_buckets() {
        let ms = 1750152000000i64;
        let inner = synth(ms, 200, 80, 10, 20);
        let evt = parse_api_req(&inner, "task-1").unwrap();
        assert_eq!(evt.source, "cline");
        assert_eq!(evt.new_in, 200);
        assert_eq!(evt.out, 80);
        assert_eq!(evt.cache_write, 10);
        assert_eq!(evt.cache_read, 20);
        assert_eq!(evt.session, "task-1");
        assert!(evt.cost > 0.0);
    }

    #[test]
    fn cline_skips_non_api_req_entries() {
        let arr = vec![
            serde_json::json!({"say": "text", "text": "hello"}),
            serde_json::json!({"say": "api_req_started", "text": "not-json"}),
        ];
        let out = parse_task_entries(&arr);
        assert!(out.is_empty());
    }

    fn parse_task_entries(arr: &[serde_json::Value]) -> Vec<UsageEvent> {
        let mut out = Vec::new();
        for item in arr {
            if item.get("say").and_then(|v| v.as_str()) != Some("api_req_started") {
                continue;
            }
            let text = match item.get("text").and_then(|v| v.as_str()) {
                Some(t) => t,
                None => continue,
            };
            let inner = match serde_json::from_str::<serde_json::Value>(text) {
                Ok(v) => v,
                Err(_) => continue,
            };
            if let Some(ev) = parse_api_req(&inner, "t") {
                out.push(ev);
            }
        }
        out
    }
}
