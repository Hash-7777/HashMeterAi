// ==============================================================
// HashMeterAi — HashCortx adapter
//
// HashCortx is a local Tauri app that keeps its conversations in the
// WKWebView localStorage, not in a usage log. There are NO real token
// counts on disk — only message text and a per-chat model id. So this
// adapter ESTIMATES tokens from text length (~4 chars/token) and reports
// a $0 cost (HashCortx runs on free-tier providers). The UI labels these
// numbers as estimated; never present them as measured usage.
//
// Storage (macOS): the localStorage lives in SQLite files under
//   ~/Library/WebKit/{com.hashcortx.app,hashcortx}/**/LocalStorage/localstorage.sqlite3
// in an `ItemTable(key, value)` table. The chat keys are:
//   atelier_chats, atelier_code_chats, atelier_forge_chats  (createdAt = ms epoch)
//   hc-coder-sessions                                       (date = string)
// Each chat: { id, model, createdAt, messages:[{role, content}] }.
// ==============================================================

use crate::model::UsageEvent;
use crate::rates::event_cost;
use crate::sources::{ScanCtx, Source};
use chrono::Local;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub struct HashCortx;

const CHAT_KEYS: [&str; 4] = [
    "atelier_chats",
    "atelier_code_chats",
    "atelier_forge_chats",
    "hc-coder-sessions",
];

impl Source for HashCortx {
    fn id(&self) -> &'static str {
        "hashcortx"
    }

    fn label(&self) -> &'static str {
        "HashCortx"
    }

    fn detect(&self, ctx: &ScanCtx) -> bool {
        webkit_roots(ctx).iter().any(|r| r.is_dir())
    }

    fn scan(&self, ctx: &ScanCtx) -> Vec<UsageEvent> {
        let mut events = Vec::new();
        let mut seen_chats: HashSet<String> = HashSet::new();

        for root in webkit_roots(ctx) {
            for db in find_localstorage_dbs(&root) {
                let fallback_ms = file_modified_ms(&db);
                for value in read_chat_values(&db) {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&value) {
                        events.extend(events_from_chats(&json, fallback_ms, &mut seen_chats));
                    }
                }
            }
        }
        events
    }
}

/// Candidate WebKit data roots for HashCortx (current + legacy bundle dirs).
fn webkit_roots(ctx: &ScanCtx) -> Vec<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        ["com.hashcortx.app", "hashcortx"]
            .iter()
            .map(|id| ctx.home.join("Library/WebKit").join(id))
            .collect()
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = ctx;
        Vec::new()
    }
}

/// Every localstorage.sqlite3 under a WebKit root.
fn find_localstorage_dbs(root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if !root.is_dir() {
        return out;
    }
    for e in walkdir::WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let p = e.path();
        if p.file_name().and_then(|s| s.to_str()) == Some("localstorage.sqlite3") {
            out.push(p.to_path_buf());
        }
    }
    out
}

fn file_modified_ms(path: &Path) -> i64 {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Read the chat-key blobs out of one localStorage SQLite file.
///
/// The DB may be in WAL mode and owned by a running HashCortx, so we copy
/// it (plus its -wal/-shm sidecars) to a temp dir and read the copy. That
/// never touches HashCortx's locks and still sees WAL-pending writes.
fn read_chat_values(db: &Path) -> Vec<String> {
    let mut out = Vec::new();

    let tmp = match copy_db_to_temp(db) {
        Some(t) => t,
        None => return out,
    };

    if let Ok(conn) = rusqlite::Connection::open(&tmp.db) {
        if let Ok(mut stmt) = conn.prepare("SELECT key, value FROM ItemTable") {
            let rows = stmt.query_map([], |row| {
                let key: String = row.get(0)?;
                let val: Option<Vec<u8>> = row.get(1)?;
                Ok((key, val))
            });
            if let Ok(rows) = rows {
                for (key, val) in rows.flatten() {
                    if !CHAT_KEYS.contains(&key.as_str()) {
                        continue;
                    }
                    if let Some(bytes) = val {
                        if let Some(s) = decode_value(&bytes) {
                            out.push(s);
                        }
                    }
                }
            }
        }
    }

    tmp.cleanup();
    out
}

struct TempDb {
    dir: PathBuf,
    db: PathBuf,
}

impl TempDb {
    fn cleanup(&self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

fn copy_db_to_temp(db: &Path) -> Option<TempDb> {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("hashmeterai-hc-{}", nanos));
    std::fs::create_dir_all(&dir).ok()?;

    let dest = dir.join("localstorage.sqlite3");
    std::fs::copy(db, &dest).ok()?;
    // Copy the WAL/SHM sidecars if present so pending writes are visible.
    for ext in ["-wal", "-shm"] {
        let side = with_suffix(db, ext);
        if side.exists() {
            let _ = std::fs::copy(&side, with_suffix(&dest, ext));
        }
    }
    Some(TempDb { dir, db: dest })
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut s = path.as_os_str().to_os_string();
    s.push(suffix);
    PathBuf::from(s)
}

/// WebKit stores localStorage values as a UTF-16LE blob (occasionally
/// UTF-8). Decode to the JSON text, trimming NUL padding.
fn decode_value(bytes: &[u8]) -> Option<String> {
    if bytes.len() >= 2 && bytes.len() % 2 == 0 {
        let units: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        if let Ok(s) = String::from_utf16(&units) {
            let t = s.trim_matches('\u{0}').trim();
            if t.starts_with('[') || t.starts_with('{') {
                return Some(t.to_string());
            }
        }
    }
    if let Ok(s) = std::str::from_utf8(bytes) {
        let t = s.trim_matches('\u{0}').trim();
        if t.starts_with('[') || t.starts_with('{') {
            return Some(t.to_string());
        }
    }
    None
}

/// Estimate token count from text. ~4 characters per token is the standard
/// rough heuristic for English-weighted content.
fn est_tokens(text: &str) -> u64 {
    let chars = text.chars().count() as f64;
    (chars / 4.0).ceil() as u64
}

/// Normalize a HashCortx model id (`cloud:groq:openai/gpt-oss-120b`) to a
/// clean short id (`gpt-oss-120b`) for display and model-share grouping.
fn normalize_model(raw: &str) -> String {
    let after_provider = raw.rsplit(':').next().unwrap_or(raw);
    let leaf = after_provider.rsplit('/').next().unwrap_or(after_provider);
    let leaf = leaf.trim();
    if leaf.is_empty() {
        "hashcortx".to_string()
    } else {
        leaf.to_string()
    }
}

/// Resolve a chat's timestamp (ms epoch). Prefers `createdAt`/`updatedAt`,
/// then a parseable `date` string, then the file's modified time.
fn chat_timestamp_ms(chat: &serde_json::Value, fallback_ms: i64) -> i64 {
    for key in ["createdAt", "updatedAt"] {
        if let Some(ms) = chat.get(key).and_then(|v| v.as_i64()) {
            if ms > 0 {
                return ms;
            }
        }
    }
    if let Some(date) = chat.get("date").and_then(|v| v.as_str()) {
        if let Some(ms) = parse_date_ms(date) {
            return ms;
        }
    }
    fallback_ms
}

fn parse_date_ms(date: &str) -> Option<i64> {
    use chrono::TimeZone;
    let date = date.trim();
    // ISO first, then a few human formats HashCortx may emit.
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date) {
        return Some(dt.timestamp_millis());
    }
    for fmt in ["%Y-%m-%d", "%b %d, %Y", "%b %d %Y", "%m/%d/%Y", "%d/%m/%Y"] {
        if let Ok(d) = chrono::NaiveDate::parse_from_str(date, fmt) {
            if let Some(ndt) = d.and_hms_opt(12, 0, 0) {
                if let chrono::LocalResult::Single(dt) = Local.from_local_datetime(&ndt) {
                    return Some(dt.timestamp_millis());
                }
            }
        }
    }
    None
}

/// Turn one decoded chat-array JSON into estimated usage events.
fn events_from_chats(
    json: &serde_json::Value,
    fallback_ms: i64,
    seen_chats: &mut HashSet<String>,
) -> Vec<UsageEvent> {
    let mut out = Vec::new();
    let chats = match json.as_array() {
        Some(a) => a,
        None => return out,
    };

    for chat in chats {
        let id = chat
            .get("id")
            .map(|v| match v {
                serde_json::Value::String(s) => s.clone(),
                other => other.to_string(),
            })
            .unwrap_or_default();
        // Skip duplicate chats seen in another (legacy) store.
        let dedup_key = if id.is_empty() {
            None
        } else {
            Some(format!("{}|{}", chat_timestamp_ms(chat, fallback_ms), id))
        };
        if let Some(k) = &dedup_key {
            if seen_chats.contains(k) {
                continue;
            }
            seen_chats.insert(k.clone());
        }

        let messages = chat
            .get("messages")
            .or_else(|| chat.get("msgs"))
            .and_then(|v| v.as_array());
        let messages = match messages {
            Some(m) => m,
            None => continue,
        };

        let model = chat
            .get("model")
            .and_then(|v| v.as_str())
            .map(normalize_model)
            .unwrap_or_else(|| "hashcortx".to_string());

        let ms = chat_timestamp_ms(chat, fallback_ms);
        let ts = match chrono::DateTime::from_timestamp_millis(ms) {
            Some(t) => t.with_timezone(&Local),
            None => continue,
        };
        let day = ts.date_naive().to_string();
        let session = if id.is_empty() {
            format!("hc:{}", day)
        } else {
            format!("hc:{}", id)
        };

        for msg in messages {
            let content = match msg.get("content").and_then(|v| v.as_str()) {
                Some(c) if !c.is_empty() => c,
                _ => continue,
            };
            let role = msg.get("role").and_then(|v| v.as_str()).unwrap_or("user");
            let est = est_tokens(content);
            if est == 0 {
                continue;
            }
            let (ni, ot) = if role == "assistant" {
                (0, est)
            } else {
                (est, 0)
            };
            // Free-tier providers -> zero cost (rate table maps hashcortx to 0).
            let cost = event_cost(&model, "hashcortx", ni, 0, 0, ot);
            out.push(UsageEvent {
                ts,
                date: day.clone(),
                source: "hashcortx",
                model: model.clone(),
                new_in: ni,
                cache_write: 0,
                cache_read: 0,
                out: ot,
                session: session.clone(),
                cost,
            });
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn estimate_is_quarter_of_chars() {
        assert_eq!(est_tokens(""), 0);
        assert_eq!(est_tokens("abcd"), 1);
        assert_eq!(est_tokens("abcde"), 2); // 5/4 -> ceil 2
        assert_eq!(est_tokens(&"x".repeat(400)), 100);
    }

    #[test]
    fn normalize_strips_provider_prefix() {
        assert_eq!(normalize_model("cloud:groq:openai/gpt-oss-120b"), "gpt-oss-120b");
        assert_eq!(normalize_model("cloud:groq:llama-3.1-8b-instant"), "llama-3.1-8b-instant");
        assert_eq!(normalize_model("cloud:groq:qwen/qwen3-32b"), "qwen3-32b");
        assert_eq!(normalize_model(""), "hashcortx");
    }

    #[test]
    fn decode_utf16le_json() {
        let json = "[{\"id\":\"a\"}]";
        let bytes: Vec<u8> = json.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
        assert_eq!(decode_value(&bytes).as_deref(), Some(json));
    }

    #[test]
    fn events_split_input_output_and_estimate() {
        // user content 8 chars -> 2 tokens in; assistant 12 chars -> 3 tokens out
        let json = serde_json::json!([{
            "id": "c1",
            "model": "cloud:groq:openai/gpt-oss-120b",
            "createdAt": 1_750_000_000_000i64,
            "messages": [
                { "role": "user", "content": "12345678" },
                { "role": "assistant", "content": "abcdefghijkl" }
            ]
        }]);
        let mut seen = HashSet::new();
        let evs = events_from_chats(&json, 0, &mut seen);
        assert_eq!(evs.len(), 2);
        assert_eq!(evs[0].source, "hashcortx");
        assert_eq!(evs[0].model, "gpt-oss-120b");
        assert_eq!(evs[0].new_in, 2);
        assert_eq!(evs[0].out, 0);
        assert_eq!(evs[1].new_in, 0);
        assert_eq!(evs[1].out, 3);
        assert_eq!(evs[0].cost, 0.0); // free-tier
        assert_eq!(evs[0].session, "hc:c1");
    }

    #[test]
    fn dedupes_identical_chat_across_stores() {
        let json = serde_json::json!([{
            "id": "dup",
            "createdAt": 1_750_000_000_000i64,
            "messages": [{ "role": "user", "content": "hello there" }]
        }]);
        let mut seen = HashSet::new();
        let a = events_from_chats(&json, 0, &mut seen);
        let b = events_from_chats(&json, 0, &mut seen);
        assert_eq!(a.len(), 1);
        assert!(b.is_empty());
    }

    #[test]
    fn coder_session_uses_date_string() {
        let json = serde_json::json!([{
            "id": 7,
            "date": "2026-05-11",
            "msgs": [{ "role": "assistant", "content": "abcd" }]
        }]);
        let mut seen = HashSet::new();
        let evs = events_from_chats(&json, 0, &mut seen);
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].date, "2026-05-11");
        assert_eq!(evs[0].out, 1);
    }
}
