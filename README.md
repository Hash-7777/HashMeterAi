<div align="center">

# ⚡ HashMeterAi

### See how much AI you *really* use.

**The honest, local-first usage meter for AI coding tools.**
Claude Code · Codex · Kimi · Continue — unified into one clean dashboard.

[![License](https://img.shields.io/badge/license-Apache--2.0-FD802E)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20·%20Windows%20·%20Linux-1b323f)](#install)
[![Built with](https://img.shields.io/badge/built%20with-Tauri%20·%20Rust-1b323f)](#tech)
[![Network](https://img.shields.io/badge/network-zero%20calls-54ffc4)](SECURITY.md)
[![Status](https://img.shields.io/badge/status-in%20active%20development-FD802E)](#roadmap)

</div>

---

> Your tools' built-in meters skip sessions, miss whole days, and only count themselves. **HashMeterAi reads the raw local transcripts** every tool already writes, and shows you the *true* picture — across all of them, in one place. 100% offline. Nothing leaves your machine.

## ✨ What you get

- 💸 **The money number.** Your estimated **$ of AI compute used** at public API rates — the stat everyone wants to screenshot.
- 🔢 **Processed tokens** — the *truest* measure of work the model actually did (not inflated by cached re-reads). With the fun "≈ N× The Lord of the Rings" yardstick.
- ⏱️ **Average focus time** — honest active-time-with-AI per day.
- 🧠 **Your AI persona** — *"Prompt Architect · Night-Shift Shipper"* — generated from your real patterns, and **every claim shows the number behind it**. No vanity, no lies.
- 🏆 **Achievements** — Million-Token Club, streaks, Night Owl, Polyglot… unlocked at real thresholds.
- 🗓️ **Calendar of activity** — your daily usage, GitHub-style but a real calendar.
- 📤 **One-click Share card** — a clean branded image of your stats + persona to post. Brag, honestly.

## 🔒 Privacy is the whole point

HashMeterAi is built **read-a-little, send-nothing**:

| Guarantee | |
|---|---|
| 🚫 **Zero network** | No telemetry, no analytics, no auto-update pings. It literally cannot phone home. |
| 👁️ **Metadata only** | Reads token *counts, timestamps, model names* — **never your prompts, code, or replies.** |
| 🔑 **Never touches secrets** | Skips `auth.json`, credentials, and keys entirely. |
| 📖 **Read-only** | It cannot modify any tool's data. Ever. |
| 💻 **100% local** | Everything is computed on your machine. Your usage is yours. |

The only thing that ever leaves is a brag-card PNG **you** choose to export. → [SECURITY.md](SECURITY.md)

## 🧩 Supported tools

| Tool | Status |
|---|---|
| Claude Code | ✅ |
| Codex (OpenAI) | ✅ |
| Kimi | ✅ |
| Continue.dev | ✅ |
| Cline / Roo | 🧪 adapter-ready |
| Cursor · Copilot · Windsurf | ⛔ usage is server-side (no local data to read) |

> Adding a tool is **one Rust file** — the architecture is a pluggable source adapter. PRs welcome.

## 📸 Screenshots

_Landing with v0.1 — dark, pumpkin-on-charcoal, big satisfying numbers._

## 🚀 Install

> **🚧 In active development.** Prebuilt installers (`.dmg` / `.msi` / `.AppImage`) ship with the first release.

Build from source:
```bash
git clone https://github.com/Hash-7777/HashMeterAi.git
cd HashMeterAi
npm install
npm run tauri dev      # run it
npm run tauri build    # produce a native bundle
```
Requires Rust (stable) and Node ≥ 18.

## <a id="tech"></a>🛠️ Tech

**Tauri v2 + Rust + vanilla JavaScript** — no Electron, no bundler. One small native binary (target < 15 MB). All parsing/aggregation in Rust (parallel + incremental → instant refresh). The UI is plain HTML/CSS/JS.

## <a id="roadmap"></a>🗺️ Roadmap

- [x] Unified scan: Claude · Codex · Kimi
- [ ] Onboarding · $ + Processed heroes · calendar
- [ ] Continue.dev + adapter framework
- [ ] Persona engine
- [ ] Achievements + Share card
- [ ] Packaged releases (mac/win/linux)

## 🤝 Contributing

Issues and PRs welcome — especially new source adapters. Keep it honest, local, and light.

## 📄 License

[Apache-2.0](LICENSE) © 2026 Seif Hashish (Hash-7777)

---

<div align="center"><sub>The <b>$</b> figure is the value of compute at public API list prices — on a subscription you don't pay per token. Honest by design.</sub></div>
