# Byteling

**A desktop pet that *is* your computer, made visible.**

Byteling hatches a creature from your actual hardware — your CPU, your GPU, your
drives — and that creature's health mirrors your machine's. A hot GPU makes it
uncomfortable. A full disk makes it hungry. Weeks of uptime make it tired. Look
after your Byteling and you're looking after your PC.

Everyone's is different. Your hardware fingerprint decides its family, its size,
its colour, even how many limbs it has. There is exactly one of yours.

[**Download for Windows →**](https://github.com/etkaturan/byteling/releases/latest)

---

## What it does

**It reads your machine.** GPU temperature and load, free disk space, junk files,
RAM pressure, uptime. Five needs — comfort, space, tidiness, rest, energy — feed
one mood, dominated by whichever need is worst. If something's wrong, you'll see
it on your pet's face before you see it in Task Manager.

**It talks.** Your Byteling speaks in character about how it feels, what time it
is, and what you're doing. Switch to your editor and it notices. Launch a game
and it worries about its temperature. Flick between apps too fast and it gets
dizzy. Add a free [Groq](https://console.groq.com) key for an AI voice; without
one it falls back to built-in lines and still has plenty to say.

**It moves.** Drag it and its limbs trail behind it, body leaning into the
motion, glowing motes scattering in its wake. Let it wander and it explores your
screen on its own — but only when you're away from the keyboard, only along the
edges, never during fullscreen games, and it stops the instant you grab it.
Off by default.

**It asks for care.** Groom it to clear temp files and empty the recycle bin.
It'll tell you if it worked.

**It stays out of the way.** Clicks in empty space pass straight through to
whatever's behind it — the pet only catches the mouse where it's actually drawn.

## Install

Grab the installer from the
[**releases page**](https://github.com/etkaturan/byteling/releases/latest) and
run it. Windows SmartScreen will warn you the first time — the app isn't
code-signed yet — so click **More info → Run anyway**.

Byteling lives in your system tray. Right-click the pet for actions; open the
clinic from the tray for vitals, the shop, and settings.

## Privacy

Byteling is local-first and reads only what it needs to keep your pet alive:

- **No telemetry.** Nothing is collected, nothing phones home.
- **No admin rights.** It never asks for elevation.
- **App awareness reads the executable name only** — never window titles, never
  screen contents, never what you're typing.
- **The AI voice is opt-in and bring-your-own-key.** With a key set, the only
  thing sent to Groq is a short description of your pet's situation: its species,
  its mood, what just happened, the hour, and a one-line system hint like "disk
  nearly full". Your key is stored locally and never leaves your machine except
  to call Groq.

## Built with

Tauri 2 · Rust · React · TypeScript · Vite

The Rust side handles sensors, the simulation, and Windows integration. The
frontend renders the pet as procedural SVG — no image assets, so it stays sharp
at any size and every creature is generated rather than drawn.

Some things worth a look if you're reading the source:

- **`src-tauri/src/sim/`** — the simulation. Pure functions, unit-tested:
  hardware readings in, needs and mood out. Worst-need-dominated scoring with
  EMA smoothing so the pet doesn't twitch at every sensor blip.
- **`src-tauri/src/sensors/foreground.rs`** — app awareness via a Win32 event
  hook (`SetWinEventHook`), so focus changes arrive instantly and the app costs
  nothing while idle.
- **`src/pets/`** — the pet platform. A pet is a bundle of swappable modules;
  adding a companion is adding data, not code.
- **`src/roaming.ts`** — the wandering brain. A state machine built around
  restraint: the best roaming is mostly not roaming.

## Development

```bash
npm install
npm run tauri dev      # run it
npm run tauri build    # build the installer
cargo test             # run the simulation tests (from src-tauri/)
```

Requires Node and the Rust toolchain. Windows only for now — the sensors and
window integration are Win32-specific.

## Docs

- [Architecture](docs/ARCHITECTURE.md) — how the pieces fit together
- [v3 plan](docs/V3_PLAN.md) — the modular pet platform

## License

MIT
