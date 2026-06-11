// ==============================================================
// HashMeterAi — Cost rate table
//
// $ per 1_000_000 tokens: (input, output, cache_write, cache_read)
// Anthropic rates are exact; OpenAI / Kimi are estimates.
// ==============================================================

use std::collections::HashMap;

pub struct Rate {
    pub input: f64,
    pub output: f64,
    pub cache_write: f64,
    pub cache_read: f64,
}

pub fn rate_table() -> HashMap<&'static str, Rate> {
    let mut m = HashMap::new();
    m.insert(
        "claude-opus-4-8",
        Rate {
            input: 5.0,
            output: 25.0,
            cache_write: 6.25,
            cache_read: 0.50,
        },
    );
    m.insert(
        "claude-opus-4-7",
        Rate {
            input: 5.0,
            output: 25.0,
            cache_write: 6.25,
            cache_read: 0.50,
        },
    );
    m.insert(
        "claude-sonnet-4-6",
        Rate {
            input: 3.0,
            output: 15.0,
            cache_write: 3.75,
            cache_read: 0.30,
        },
    );
    m.insert(
        "claude-haiku-4-5-20251001",
        Rate {
            input: 1.0,
            output: 5.0,
            cache_write: 1.25,
            cache_read: 0.10,
        },
    );
    m.insert(
        "gpt-5.5",
        Rate {
            input: 1.25,
            output: 10.0,
            cache_write: 1.25,
            cache_read: 0.125,
        },
    );
    m.insert(
        "kimi-code/kimi-for-coding",
        Rate {
            input: 0.60,
            output: 2.50,
            cache_write: 0.60,
            cache_read: 0.15,
        },
    );
    m
}

/// Fallback rates when model is unknown, keyed by source id.
pub fn default_rate(source: &str) -> Rate {
    match source {
        "claude" => Rate {
            input: 5.0,
            output: 25.0,
            cache_write: 6.25,
            cache_read: 0.50,
        },
        "codex" => Rate {
            input: 1.25,
            output: 10.0,
            cache_write: 1.25,
            cache_read: 0.125,
        },
        "kimi" => Rate {
            input: 0.60,
            output: 2.50,
            cache_write: 0.60,
            cache_read: 0.15,
        },
        // HashCortx: token counts are estimated from message text (the app does
        // not record real usage), and it runs on free-tier providers (Groq,
        // Cerebras, SambaNova, ...). We therefore do not invent a dollar cost —
        // its rate is zero and the UI labels its tokens as estimated.
        "hashcortx" => Rate {
            input: 0.0,
            output: 0.0,
            cache_write: 0.0,
            cache_read: 0.0,
        },
        _ => Rate {
            input: 1.0,
            output: 5.0,
            cache_write: 1.0,
            cache_read: 0.1,
        },
    }
}

/// Compute event cost in dollars.
pub fn event_cost(model: &str, source: &str, ni: u64, wr: u64, rd: u64, ot: u64) -> f64 {
    let table = rate_table();
    let fallback = default_rate(source);
    let r = table.get(model).unwrap_or(&fallback);
    let cost = (ni as f64) * r.input
        + (ot as f64) * r.output
        + (wr as f64) * r.cache_write
        + (rd as f64) * r.cache_read;
    cost / 1_000_000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_cost_known_model() {
        // claude-opus-4-8: 5/25/6.25/0.5 per 1M
        // 1000 input + 500 output = 5000 + 12500 = 17500 / 1M = 0.0175
        let c = event_cost("claude-opus-4-8", "claude", 1000, 0, 0, 500);
        assert!((c - 0.0175).abs() < 1e-9);
    }

    #[test]
    fn event_cost_unknown_model_uses_default() {
        let c1 = event_cost("unknown-model", "claude", 1_000_000, 0, 0, 0);
        // should use claude default (opus rates)
        assert!((c1 - 5.0).abs() < 1e-9);

        let c2 = event_cost("unknown-model", "codex", 1_000_000, 0, 0, 0);
        assert!((c2 - 1.25).abs() < 1e-9);
    }

    #[test]
    fn event_cost_hashcortx_is_zero() {
        // HashCortx runs on free-tier providers and its tokens are estimated,
        // so it must never produce a dollar cost.
        let c = event_cost("gpt-oss-120b", "hashcortx", 1_000_000, 0, 0, 1_000_000);
        assert_eq!(c, 0.0);
    }

    #[test]
    fn event_cost_includes_all_buckets() {
        // gpt-5.5: 1.25/10/1.25/0.125
        // ni=1000, wr=200, rd=300, ot=400
        // cost = 1250 + 4000 + 250 + 37.5 = 5537.5 / 1M = 0.0055375
        let c = event_cost("gpt-5.5", "codex", 1000, 200, 300, 400);
        assert!((c - 0.0055375).abs() < 1e-9);
    }
}
