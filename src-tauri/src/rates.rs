// ==============================================================
// HashMeterAi — Cost rate table
//
// $ per 1_000_000 tokens: (input, output, cache_write, cache_read)
// Anthropic and OpenAI rates are public list prices, encoded via per-provider
// helpers so cache pricing follows each provider's rule exactly. Kimi is an
// estimate. HashCortx / HashCerebrum are free-tier (zero, see default_rate).
// ==============================================================

use std::collections::HashMap;

pub struct Rate {
    pub input: f64,
    pub output: f64,
    pub cache_write: f64,
    pub cache_read: f64,
}

// Anthropic bills cache writes at 1.25x the input rate and cache reads at 0.10x.
// Encoding the rule here keeps every Claude row exact and consistent.
fn anthropic(input: f64, output: f64) -> Rate {
    Rate {
        input,
        output,
        cache_write: input * 1.25,
        cache_read: input * 0.10,
    }
}

// OpenAI charges cached input at the input rate (no separate write premium) and
// cache reads at 0.10x input.
fn openai(input: f64, output: f64) -> Rate {
    Rate {
        input,
        output,
        cache_write: input,
        cache_read: input * 0.10,
    }
}

// Moonshot / Kimi — cache read at 0.25x input (estimate).
fn kimi(input: f64, output: f64) -> Rate {
    Rate {
        input,
        output,
        cache_write: input,
        cache_read: input * 0.25,
    }
}

pub fn rate_table() -> HashMap<&'static str, Rate> {
    let mut m = HashMap::new();

    // ===== Anthropic (Claude) — public list prices, exact =====
    m.insert("claude-fable-5", anthropic(10.0, 50.0));
    m.insert("claude-opus-4-8", anthropic(5.0, 25.0));
    m.insert("claude-opus-4-7", anthropic(5.0, 25.0));
    m.insert("claude-opus-4-6", anthropic(5.0, 25.0));
    m.insert("claude-opus-4-5", anthropic(5.0, 25.0));
    m.insert("claude-sonnet-4-6", anthropic(3.0, 15.0));
    m.insert("claude-sonnet-4-5", anthropic(3.0, 15.0));
    m.insert("claude-haiku-4-5", anthropic(1.0, 5.0));
    m.insert("claude-haiku-4-5-20251001", anthropic(1.0, 5.0));

    // ===== OpenAI (Codex) — public list prices for the GPT-5 family =====
    m.insert("gpt-5.5", openai(1.25, 10.0));
    m.insert("gpt-5.1", openai(1.25, 10.0));
    m.insert("gpt-5", openai(1.25, 10.0));
    m.insert("gpt-5-codex", openai(1.25, 10.0));
    m.insert("gpt-5.5-codex", openai(1.25, 10.0));
    m.insert("gpt-5-mini", openai(0.25, 2.0));
    m.insert("gpt-5-nano", openai(0.05, 0.40));

    // ===== Kimi (Moonshot) — estimate =====
    m.insert("kimi-code/kimi-for-coding", kimi(0.60, 2.50));
    m.insert("kimi-k2", kimi(0.60, 2.50));

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
        // HashCortx and HashCerebrum now record REAL token counts (usage.jsonl),
        // but they run on free-tier providers (Groq, Cerebras, SambaNova, Gemini
        // free, local Ollama, ...). The token counts are measured; we still do
        // not invent a dollar cost for free-tier compute, so the rate is zero.
        "hashcortx" | "hashcerebrum" => Rate {
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
