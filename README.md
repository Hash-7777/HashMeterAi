<div align="center">

# HashMeterAi

### See how much AI you really use.

**The honest, local-first usage meter for AI coding tools.**
Claude Code, Codex, Kimi, HashCortx — unified into one clean dashboard.

[![License](https://img.shields.io/badge/license-Apache--2.0-FD802E)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20|%20Windows%20|%20Linux-1b323f)](#install)
[![Built with](https://img.shields.io/badge/built%20with-Tauri%20|%20Rust-1b323f)](#tech)
[![Network](https://img.shields.io/badge/network-zero%20calls-54ffc4)](SECURITY.md)
[![Status](https://img.shields.io/badge/status-in%20active%20development-FD802E)](#roadmap)

</div>

---

> Your tools' built-in meters skip sessions, miss whole days, and only count themselves. **HashMeterAi reads the raw local transcripts** every tool already writes, and shows you the true picture — across all of them, in one place. 100% offline. Nothing leaves your machine.

## What you get

- **The money number.** Your estimated dollar value of AI compute used at public API rates — the stat everyone wants to screenshot.
- **Processed tokens.** The truest measure of work the model actually did (not inflated by cached re-reads), with the "approximately N times The Lord of the Rings" yardstick.
- **Average focus time.** Honest active-time-with-AI per day.
- **Your AI persona.** For example, "Prompt Architect, Night-Shift Shipper" — generated from your real patterns, and **every claim shows the number behind it.** No vanity, no lies.
- **Achievements.** Million-Token Club, streaks, Night Owl, Polyglot, and more — unlocked at real thresholds.
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
| HashCortx | Supported (tokens estimated from message length) |
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

## <a id="roadmap"></a>Roadmap

- [x] Unified scan: Claude, Codex, Kimi, HashCortx
- [ ] Onboarding, dollar and Processed heroes, calendar
- [ ] Broader adapter framework
- [ ] Persona engine
- [ ] Achievements and Share card
- [ ] Packaged releases (macOS, Windows, Linux)

## Contributing

Issues and PRs welcome — especially new source adapters. Keep it honest, local, and light.

## License

[Apache-2.0](LICENSE), Copyright 2026 Seif Hashish (Hash-7777)

---

<div align="center"><sub>The dollar figure is the value of compute at public API list prices — on a subscription you don't pay per token. Honest by design.</sub></div>
