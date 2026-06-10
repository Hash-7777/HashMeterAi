// ==============================================================
// HashMeterAi — Data model
//
// Normalized usage event and the Snapshot contract.
// ==============================================================

use chrono::{DateTime, Local};
use serde::Serialize;
use std::collections::HashMap;

/// One atomic usage event, normalized from any source adapter.
#[derive(Debug, Clone)]
pub struct UsageEvent {
    pub ts: DateTime<Local>,
    pub date: String, // YYYY-MM-DD in local time
    pub source: &'static str,
    pub model: String,
    pub new_in: u64,
    pub cache_write: u64,
    pub cache_read: u64,
    pub out: u64,
    pub session: String,
    pub cost: f64,
}

/// Per-day aggregated record for a single source.
#[derive(Debug, Clone, Serialize)]
pub struct DayRecord {
    pub date: String,
    pub messages: u64,
    #[serde(rename = "newIn")]
    pub new_in: u64,
    pub write: u64,
    pub read: u64,
    pub out: u64,
    pub cost: f64,
    pub sessions: Vec<String>,
    pub hours: Vec<u64>,
    pub models: HashMap<String, u64>,
    pub focus_sec: u64,
}

/// Output for one tool inside the Snapshot.
#[derive(Debug, Clone, Serialize)]
pub struct SourceOutput {
    pub label: String,
    pub present: bool,
    pub days: Vec<DayRecord>,
}

/// The single JSON payload returned to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct Snapshot {
    pub generated_at: String,
    pub tools: HashMap<String, SourceOutput>,
}

impl DayRecord {
    pub fn new(date: &str) -> Self {
        Self {
            date: date.to_string(),
            messages: 0,
            new_in: 0,
            write: 0,
            read: 0,
            out: 0,
            cost: 0.0,
            sessions: Vec::new(),
            hours: vec![0; 24],
            models: HashMap::new(),
            focus_sec: 0,
        }
    }
}
