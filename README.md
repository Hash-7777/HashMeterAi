<div align="center">

# HashMeterAi

### See how much AI you really use.

**The honest, local-first usage meter for AI coding tools.**
Claude Code, Codex, Kimi, HashCortx, HashCerebrum — unified into one clean dashboard.

[![License](https://img.shields.io/badge/license-Apache--2.0-FD802E)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20|%20Windows%20|%20Linux-1b323f)](#install)
[![Built with](https://img.shields.io/badge/built%20with-Tauri%20|%20Rust-1b323f)](#tech)
[![Network](https://img.shields.io/badge/network-zero%20calls-54ffc4)](SECURITY.md)
[![Status](https://img.shields.io/badge/status-in%20active%20development-FD802E)](#install)

</div>

---

> Your tools' built-in meters skip sessions, miss whole days, and only count themselves. **HashMeterAi reads the raw local transcripts** every tool already writes, and shows you the true picture — across all of them, in one place. 100% offline. Nothing leaves your machine.

## What you get

- **The money number.** Your estimated dollar value of AI compute used at public API rates — the stat everyone wants to screenshot.
- **Processed tokens.** The truest measure of work the model actually did (not inflated by cached re-reads), with the "approximately N times The Lord of the Rings" yardstick.
- **Average focus time.** Honest active-time-with-AI per day.
- **Your AI persona.** For example, "Prompt Architect, Night-Shift Shipper" — generated from your real patterns, and **every claim shows the number behind it.** No vanity, no lies.
- **Where you stand.** An honest "top X% of AI developers" read, computed against a documented, fully offline usage benchmark modeled from public 2025–26 figures — always shown with the number behind it, never a made-up rank.
- **Achievements.** Thirty ranked trophies — from First Steps to Billionaire, Night Owl to Whale — each a real threshold with its *true* earn date and a tier-shaped medallion. The single hardest one you've earned headlines your Share card.
- **Calendar of activity.** Your daily usage as a real calendar.
- **One-click Share card.** A clean branded image of your stats and persona to post. Brag, honestly.

## Privacy is the whole point

HashMeterAi is built to read a little and send nothing:

| Guarantee | |
|---|---|
| **Zero network** | No telemetry, no analytics, no auto-update pings. It cannot phone home. |
| **Metadata only** | Reads token counts, timestamps, and model names — never your prompts, code, or replies. |
| **Never touches secrets** | Skips auth files, credentials, and keys entirely. |
| **Read-only** | It cannot modify any tool's data. Ever. |
| **100% local** | Everything is computed on your machine. Your usage is yours. |

The only thing that ever leaves is a brag-card image that **you** choose to export. See [SECURITY.md](SECURITY.md).

## Supported tools

| Tool | Status |
|---|---|
| Claude Code | Supported |
| Codex (OpenAI) | Supported |
| Kimi | Supported |
| HashCortx | Supported (records real per-response token counts) |
| HashCerebrum | Supported (records real per-response token counts) |
| Cline / Roo | Adapter-ready |
| Cursor, Copilot, Windsurf | Not supported (usage is server-side; no local data to read) |

> Adding a tool is one Rust file — the architecture is a pluggable source adapter. PRs welcome.

## Screenshots

Landing with v0.1 — dark, pumpkin-on-charcoal, big satisfying numbers.

## Install

> **In active development.** Prebuilt installers (.dmg, .msi, .AppImage) ship with the first release.

Build from source:
```bash
git clone https://github.com/Hash-7777/HashMeterAi.git
cd HashMeterAi
npm install
npm run tauri dev      # run it
npm run tauri build    # produce a native bundle
```
Requires Rust (stable) and Node 18+.

## <a id="tech"></a>Tech

**Tauri v2 + Rust + vanilla JavaScript** — no Electron, no bundler. One small native binary (target under 15 MB). All parsing and aggregation in Rust (parallel and incremental, so refresh is instant). The UI is plain HTML, CSS, and JS.

## The Hash ecosystem

HashMeterAi is one of three local-first, privacy-first apps by the same developer — no cloud, no telemetry, your data stays on your machine:

| App | What it is |
|---|---|
| **[HashMeterAi](https://github.com/Hash-7777/HashMeterAi)** *(this app)* | See how much AI you really use — the honest local usage meter for AI coding tools. |
| **[HashCortX](https://github.com/Hash-7777/HashCortX)** | The local-first AI workspace — eleven modes, ten providers, zero telemetry. |
| **[HashCerebrum](https://github.com/Hash-7777/HashCerebrum)** | A local-first medical-research workbench with a 3D brain interface for searching, citing, and peer-reviewing research. |

HashCortX and HashCerebrum write a local token-usage log that HashMeterAi reads, so your usage across the whole ecosystem is measured accurately in one place.

## Contributing

Issues and PRs welcome — especially new source adapters. Keep it honest, local, and light.

## License

[Apache-2.0](LICENSE), Copyright 2026 Seif Hashish (Hash-7777)

---

<div align="center"><sub>The dollar figure is the value of compute at public API list prices — on a subscription you don't pay per token. The "top X%" standing is a percentile against a static benchmark curve modeled from public 2025–26 AI-coding usage data (≈$6/dev-day on Claude Code, agentic tasks of 1–3.5M tokens, power users at millions/day) — computed entirely on your machine, shown with its underlying number, and labeled as a modeled benchmark, not a live ranking. Honest by design.</sub></div>
