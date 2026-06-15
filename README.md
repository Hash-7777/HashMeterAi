<div align="center">

# HashMeterAi

### See how much AI you really use.

**The honest, local-first usage meter for AI coding tools.**
Claude Code, Codex, Kimi, Qwen CLI, HashCortx, HashCerebrum — unified into one clean dashboard with usage based trophies :)

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
- **Your AI persona.** For example, "Deep Diver, Night Owl" — generated from your real patterns, and **every claim shows the number behind it.** No vanity, no lies.
- **Where you stand.** An honest "top X% of AI developers" read, computed against a documented, fully offline usage benchmark modeled from public 2025–26 figures — always shown with the number behind it, never a made-up rank.
- **Achievements.** Sixty ranked trophies across **Volume**, **Intensity**, and **Mastery** (twenty each) — from First Steps to the Billion-token clubs, Night Owl to Whale. Every token trophy counts **processed (real-work) tokens**, not the inflated billed footprint, and shows its *true* earn date on a tier-shaped medallion. Your three rarest headline your Share card.
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
| Claude Code | **Supported.** Also counts GLM (Z.ai), MiniMax, and Gemini when they're run *through* Claude Code via an Anthropic-compatible endpoint — those turns stay on the Claude tab and keep their own model name in the Models breakdown. |
| Codex (OpenAI) | Supported |
| Kimi | Supported (classified by model) |
| Qwen CLI | Supported — reads the Qwen Code CLI (`~/.qwen`), classified by model |
| HashCortx | Supported (records real per-response token counts) |
| HashCerebrum | Supported (records real per-response token counts) |
| Qwen desktop app | Not supported — chat lives in a Chromium IndexedDB (binary LevelDB); no readable per-message token data |
| Antigravity (Google) | Not supported — conversations are stored as binary protobuf blobs with no token-count fields recorded locally |
| Gemini CLI | Not supported — token counts are only written when telemetry logging is enabled (off by default) |
| Cursor, Copilot, Windsurf | Not supported — usage is server-side; no local data to read |

**Models.** Model names and public list-price rates are recognized for the Claude, GPT/Codex, Kimi, Qwen, GLM, MiniMax, and Gemini families — so even a non-Anthropic model run through Claude Code is named and costed correctly, never lumped under a generic label.

> Adding a tool is one Rust file — the architecture is a pluggable source adapter. PRs welcome.

## Screenshots

<img width="1235" height="836" alt="hashmeterai-screenshot" src="https://github.com/user-attachments/assets/57ac641a-4cb9-454f-b620-3d41be784ede" />
<img width="2400" height="1260" alt="hashmeterai-share-card" src="https://github.com/user-attachments/assets/b7562c49-92f1-47f0-8871-3fed524394e9" />
<img width="1081" height="487" alt="persona-screen" src="https://github.com/user-attachments/assets/9275be40-1342-4204-bf8f-7337e1c51aba" />
<img width="1235" height="836" alt="achievements-screen" src="https://github.com/user-attachments/assets/583a21fd-8e93-494f-8516-0c70f5d4d194" />


## Install

Download the installer for your OS from the [Releases page](https://github.com/Hash-7777/HashMeterAi/releases), or build from source (below).

> **Why your OS shows a warning.** HashMeterAi is a free, open-source project and ships **unsigned** — code-signing certificates (an Apple Developer ID, a Windows EV certificate) are paid, ongoing costs. The warning means "not signed," **not** "unsafe": there's no network access, and every line of source is in this repo for you to read or build yourself. Each warning below is a one-time step.

### macOS — `.dmg`

1. Open the `.dmg` and drag **HashMeterAi** to **Applications**.
2. On first launch macOS says *"HashMeterAi can't be opened because Apple cannot check it for malicious software."* Get past it once, either way:
   - **Right-click (or Control-click) the app → Open → Open**, or
   - **System Settings → Privacy & Security**, scroll to the HashMeterAi message → **Open Anyway**.
3. If instead you see *"HashMeterAi is damaged and can't be opened"* (quarantine, common on Apple Silicon), clear the quarantine flag in Terminal, then reopen:
   ```bash
   xattr -dr com.apple.quarantine /Applications/HashMeterAi.app
   ```

### Windows — `.msi` / `.exe`

1. Run the installer. Windows SmartScreen shows *"Windows protected your PC — unknown publisher."*
2. Click **More info → Run anyway** (one time only).
3. If your browser flags the download, choose **Keep**.

### Linux — `.AppImage` or `.deb`

Linux doesn't block unsigned apps the way macOS and Windows do, so there's no "unknown developer" prompt.

- **AppImage** — make it executable and run:
  ```bash
  chmod +x HashMeterAi_*.AppImage
  ./HashMeterAi_*.AppImage
  ```
  If it won't start, install FUSE: `sudo apt install libfuse2` (Debian/Ubuntu) or your distro's equivalent.
- **.deb** (Debian/Ubuntu):
  ```bash
  sudo dpkg -i HashMeterAi_*.deb
  sudo apt-get install -f   # pull in any missing dependencies
  ```

### Build from source

```bash
git clone https://github.com/Hash-7777/HashMeterAi.git
cd HashMeterAi
npm install
npm run tauri dev      # run it
npm run tauri build    # produce a native bundle in src-tauri/target/release/bundle/
```
Requires Rust (stable) and Node 18+. Building from source skips every OS warning above — the app is local to your machine.

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

## Disclaimer

- **Estimates, not bills.** The cost figure is the value of compute at public API list prices — on a subscription you don't pay per token. Token counts are read from each tool's local files and may differ from a provider's official dashboard.
- **Not a live ranking.** The "top X%" standing is a percentile against a static, modeled 2025–26 usage benchmark computed entirely on your machine — it is labeled as a modeled benchmark, not a real-time leaderboard.
- **Trademarks.** All product names, logos, and brands are the property of their respective owners and are used for identification only. HashMeterAi is independent and is **not** affiliated with, endorsed by, or sponsored by Anthropic, OpenAI, Google, Alibaba, Moonshot AI, Z.ai, MiniMax, or any other tool named.
- **No warranty.** HashMeterAi is provided "as is", without warranty of any kind, as set out in the license.

## License

[Apache-2.0](LICENSE), Copyright 2026 Seif Hashish (Hash-7777). Provided "as is", without warranty of any kind.

---

<div align="center"><sub>The dollar figure is the value of compute at public API list prices — on a subscription you don't pay per token. The "top X%" standing is a percentile against a static benchmark curve modeled from public 2025–26 AI-coding usage data (≈$6/dev-day on Claude Code, agentic tasks of 1–3.5M tokens, power users at millions/day) — computed entirely on your machine, shown with its underlying number, and labeled as a modeled benchmark, not a live ranking. Honest by design.</sub></div>
