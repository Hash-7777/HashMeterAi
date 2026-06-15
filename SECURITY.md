# Security Policy

HashMeterAi is designed around one idea: read a little, send nothing. Security and privacy are not a feature here — they are the architecture.

## Security guarantees

These hold for every release. If any is ever untrue, it is a bug — please report it.

1. **Zero network.** The app makes no network calls of any kind — no telemetry, no analytics, no crash reporting, no auto-update checks. Its Content-Security-Policy has no external connect-src, and it bundles all fonts, scripts, and styles locally. It cannot exfiltrate data because it never opens a connection.
2. **Metadata only.** It reads only token counts, timestamps, and model names from your tools' local transcripts. It does not parse or store your prompts, your code, or the model's replies.
3. **Never reads secrets.** Adapters skip credential and key files (auth.json, credentials, *.key, *.pem) and parse only files that contain token-usage fields, so API keys are never read, displayed, or stored.
4. **Read-only.** The app has no write access to any tool's data directory. It cannot modify, delete, or corrupt your sessions.
5. **100% local.** All parsing, aggregation, persona, and achievement logic runs on your machine. Your usage data never leaves it.

The only artifact that ever leaves your machine is a share-card image that you explicitly export (via copy-to-clipboard or a save dialog). It contains aggregate numbers and your chosen display name — no file paths, no content, no identifiers.

## What it reads (and nothing else)

Read-only, from a fixed allowlist of locations: the local transcript and usage files written by Claude Code, Codex, Kimi, the Qwen Code CLI, HashCortx, and HashCerebrum. (GLM, MiniMax, and Gemini have no files of their own — they run through Claude Code, so they are read from Claude's transcripts.) Only the numeric usage fields, model names, and event timestamps are parsed.

## What it never does

- Connect to the internet
- Read message, prompt, or response content
- Read API keys or credentials
- Write to any tool's data folder
- Send telemetry or "anonymous usage stats"

## Permissions and sandbox

Built on Tauri v2 with a locked capability set. The filesystem (fs) plugin is **not enabled** — the app reads via Rust `std::fs` and restricts itself in code to a fixed set of per-tool usage directories (resolved at runtime from the user's home directory). The only granted capabilities are a save dialog (used solely for the Share export), the opener (to reveal the data folder and open the project's own GitHub links — restricted to http(s) URLs), a local key-value store for your name and preferences, and window controls. There is no shell access and no filesystem-write capability.

## Threat model

- A malicious or malformed transcript line cannot crash or take over the app: parsing is defensive (errors are skipped, never fatal) and written in memory-safe Rust.
- A compromised dependency has nothing to exfiltrate with — there is no network capability to abuse.
- Your data at rest stays in the tools' own files; HashMeterAi keeps only small local aggregates (name, unlocked achievements, preferences) in its app-data directory.

## Reporting a vulnerability

Please report security issues privately by opening a GitHub Security Advisory:
https://github.com/Hash-7777/HashMeterAi/security/advisories/new

Do not open a public issue for a security report. We will acknowledge, investigate, and credit you (if you wish) once a fix ships.

## Supported versions

During pre-1.0 development, only the latest commit on main is supported. Security fixes land on main first.
