// ==============================================================
// HashMeterAi — Shared usage.jsonl reader (HashMeter ecosystem)
//
// HashCortx and HashCerebrum now record one JSON line per model
// response to a usage.jsonl log — real, MEASURED token counts, never
// any message content. This reader turns those lines into the same
// UsageEvent the Claude/Kimi/Codex adapters produce, so their tokens
// are counted as measured (not estimated).
//
// Line shape (the ecosystem contract):
//   {"ts":ISO8601,"model":str,"input_tokens":int,"output_tokens":int,
//    "cache_read":int,"cache_write":int,"cost":float}
// ==============================================================

use crate::model::UsageEvent;
use crate::rates::event_cost;
use chrono::Local;
use serde::Deserialize;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
struct UsageRecord {
    ts: String,
    #[serde(default)]
    model: String,
    #[serde(default)]
    input_tokens: u64,
    #[serde(default)]
    output_tokens: u64,
    #[serde(default)]
    cache_read: u64,
    #[serde(default)]
    cache_write: u64,
}

/// Read the first existing usage.jsonl among `candidates` into measured events
/// tagged with `source`. Missing file or unreadable lines yield nothing.
pub fn read_usage_log(candidates: &[PathBuf], source: &'static str) -> Vec<UsageEvent> {
    candidates
        .iter()
        .find(|p| p.is_file())
        .map(|p| parse_file(p, source))
        .unwrap_or_default()
}

fn parse_file(path: &Path, source: &'static str) -> Vec<UsageEvent> {
    match std::fs::read_to_string(path) {
        Ok(text) => parse_lines(&text, source),
        Err(_) => Vec::new(),
    }
}

fn parse_lines(text: &str, source: &'static str) -> Vec<UsageEvent> {
    let mut out = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(rec) = serde_json::from_str::<UsageRecord>(line) else {
            continue;
        };
        let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(&rec.ts) else {
            continue;
        };
        let ts = parsed.with_timezone(&Local);
        let date = ts.date_naive().to_string();
        let model = if rec.model.is_empty() {
            "unknown".to_string()
        } else {
            rec.model
        };
        // Value at public API list prices (0 for these free-tier sources unless
        // the model is in the rate table); the counts themselves are measured.
        let cost = event_cost(
            &model,
            source,
            rec.input_tokens,
            rec.cache_write,
            rec.cache_read,
            rec.output_tokens,
        );
        out.push(UsageEvent {
            ts,
            date,
            source,
            model,
            new_in: rec.input_tokens,
            cache_write: rec.cache_write,
            cache_read: rec.cache_read,
            out: rec.output_tokens,
            session: String::new(),
            cost,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_measured_lines_and_skips_junk() {
        let text = concat!(
            "{\"ts\":\"2026-06-12T01:22:09Z\",\"model\":\"llama-3.3-70b\",\"input_tokens\":4120,\"output_tokens\":880}\n",
            "this is not json\n",
            "{\"ts\":\"not-a-timestamp\",\"model\":\"m\",\"input_tokens\":1,\"output_tokens\":1}\n",
            "\n",
            "{\"ts\":\"2026-06-12T02:00:00+00:00\",\"model\":\"gemini-2.0-flash\",\"input_tokens\":10,\"output_tokens\":5,\"cache_read\":3}\n",
        );
        let evs = parse_lines(text, "hashcortx");
        assert_eq!(evs.len(), 2, "only the two valid lines parse");
        assert_eq!(evs[0].source, "hashcortx");
        assert_eq!(evs[0].new_in, 4120);
        assert_eq!(evs[0].out, 880);
        assert_eq!(evs[0].date, "2026-06-12");
        assert_eq!(evs[1].model, "gemini-2.0-flash");
        assert_eq!(evs[1].cache_read, 3);
    }

    #[test]
    fn missing_model_becomes_unknown() {
        let evs = parse_lines(
            "{\"ts\":\"2026-06-12T01:00:00Z\",\"input_tokens\":5,\"output_tokens\":2}",
            "hashcerebrum",
        );
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].model, "unknown");
        assert_eq!(evs[0].source, "hashcerebrum");
    }
}
