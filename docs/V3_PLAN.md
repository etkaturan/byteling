# Byteling v3 — Design & Plan

> v3 turns Byteling from a single hardcoded pet into a **modular pet platform**:
> many unique characters, each a bundle of swappable modules (renderer, animations,
> personality, movement, effects). This document captures the v2 bugs to fix first
> and the architecture that makes future features cheap to add.

**Status:** planning · **Builds on:** v2.0.0 (shipped)

---

## Part 1 — v2 bugs to fix first

We fix these before layering v3 features on top. A clean foundation matters more
than more features on a shaky one. Each bug below has a suspected cause and a
direction; causes are confirmed during the fix, not assumed.

### 1.1 Pet doesn't reliably appear on launch
**Symptom:** In the packaged (installed) build, the pet sometimes fails to show;
closing and reopening several times eventually works. Not reproducible in `dev`.

**Suspected causes:**
- A race between the transparent always-on-top window initializing and the React
  app mounting / `get_species` resolving. The overlay gates its entire render on
  `if (!species) return null`, so if that command races window setup, the window
  can appear blank/invisible.
- Transparent + always-on-top windows occasionally initialize behind other windows
  or with an unpainted first frame.

**Direction:**
- Don't gate the whole overlay on a command result; render the window shell
  immediately and fill content in as data arrives.
- Verify the window is explicitly shown and focused after the webview is ready
  (a "ready" signal from frontend → Rust `show()`), rather than relying on
  auto-show timing.
- Investigate in the **packaged** build specifically (dev masks the timing).

### 1.2 AI reactions: silent, random, or inconsistent
**Symptom:** Even with a Groq key, the pet sometimes stays silent, says off-topic
things, or reacts inconsistently to events.

**Suspected causes:**
- **Silence is partly by design:** the global `MIN_GAP_MS` (45s) plus per-trigger
  cooldowns skip many triggers. It reads as a bug but it's over-aggressive rate
  limiting.
- **Random lines:** thin prompt context and reasoning-model drift produce vague
  output; canned fallback firing on slow Groq mixes quality unpredictably.

**Direction:**
- Rework rate limiting into a clearer budget (e.g. a priority system: important
  events always speak; idle filler is what gets throttled).
- Tighten prompts; give the model more specific, structured context.
- Make canned-vs-LLM handoff deterministic (decide up front which will speak,
  don't race them).

### 1.3 Speech bubbles are slow (~4-5s after an app opens)
**Symptom:** Open Discord → the Discord line appears 4-5 seconds later.

**Confirmed contributing factors (they stack):**
- Foreground detection **polls every 2 seconds** → up to 2s just to notice.
- Settle debounce (1.5-2.5s) before reacting.
- Groq latency (~1s).

**Direction — the important architectural change:**
- Replace **interval polling** with **event-driven** foreground detection using
  the Windows event hook (`SetWinEventHook` with `EVENT_SYSTEM_FOREGROUND`), which
  fires *instantly* on focus change. This removes the polling latency entirely and
  is lighter on CPU.
- Reduce the settle debounce now that detection is instant.
- Consider showing an instant canned reaction, then letting the LLM line replace it
  only if it improves things (revisit the no-flicker tradeoff).

### 1.4 Weak app identification
**Symptom:** Many apps are unrecognized → classified "Other" → generic or wrong
speech.

**Cause:** `classify()` and `pretty_app_name()` only know a small hardcoded set of
executables.

**Direction:**
- Expand the app map substantially (top ~100 common apps: editors, browsers, games,
  chat, media, office, creative tools).
- Better fallback naming from the executable (strip version suffixes, handle
  `PascalCase`/`snake_case`, drop `.exe`).
- Smarter category inference (e.g. install path hints, fullscreen ⇒ likely game).
- Never emit a confident wrong line for an unknown app — degrade to a neutral line.

---

## Part 2 — v3 architecture: the modular pet platform

### 2.1 Core idea
A **Pet** stops being one hardcoded component and becomes a bundle of independent,
swappable modules. Any module can change without touching the others.

```
Pet = {
  identity:    name, bio, unlock state, price (price unused for now)
  renderer:    HOW it's drawn — procedural SVG / sprite-sheet / (future) other
  animations:  named states → visuals (idle, moving, thinking, tired, happy, ...)
  personality: voice profile → LLM system prompt + canned lines + catchphrases
  movement:    roaming behavior + physics (how it decides where to go)
}
```

Plus a cross-cutting **effects layer** (trails, etc.) that observes pet
position/velocity and draws independently of which pet is active.

### 2.2 Why this structure (it is the unlock for every planned feature)
- **Roaming** lives only in `movement`. The app asks the module for a position; it
  doesn't know or care how that position is chosen. Different pets can roam
  differently (a calm Sage drifts; a hyper electric pet darts).
- **Trail effects** are a separate effects layer keyed off position/velocity. Works
  for roaming AND manual drag because both just change position. New trail styles =
  new registry entries. A settings toggle turns it on/off.
- **Per-pet animations** live in `renderer` + `animations`. A procedural pet
  computes states from math; a sprite pet loads image frames. The app calls
  `render(state)` and stays agnostic.
- **Different model types** = different `renderer` implementations behind ONE
  interface (procedural SVG now; sprite-sheets next; Lottie/3D possible later).

### 2.3 The renderer interface (the most important seam)
A renderer is anything that can draw the pet in a given animation state at a given
size. Two implementations planned:
- **ProceduralRenderer** — the current SVG creature, driven by species/character
  parameters. Cheap, infinitely variable, no assets.
- **SpriteRenderer** — loads a per-character sprite sheet + a manifest mapping
  animation states to frame ranges/fps. Enables hand-crafted animated pets (e.g. an
  electric-mouse-style character with 10-20 states: idle, move, think, tired,
  happy, sleep, ...).

The app only ever calls the interface; it never branches on renderer type.

### 2.4 Characters in this first build
Three, proving the system:
1. **Hardware default** — the procedural creature your PC hatches (existing system,
   re-expressed through the module structure). ProceduralRenderer.
2. **An electric-mouse-style character** (original, inspired-by — NOT a licensed
   character) — the first SpriteRenderer target, to prove sprite-based pets.
3. **A simple cat** — a second distinct character (renderer TBD: procedural or
   sprite).

**IP note:** all characters are ORIGINAL / inspired-by. No licensed IP (no actual
Pikachu/Naruto/etc.). This protects the project's use as a public, portfolio,
and potentially commercial piece. Revisit licensing only with proper rights.

### 2.5 Character = data bundle
Adding a character should be adding one registry entry, not new code:
```
Character {
  id, name, bio,
  renderer_kind,            // Procedural | Sprite
  art_params / asset_ref,   // palette+shape params, or sprite-sheet reference
  personality_profile,      // descriptor that shapes the LLM prompt
  canned_lines,             // in-voice fallback lines
  catchphrases,             // optional signature lines
  movement_kind,            // which roaming behavior
  unlocked, price           // price present but unused (marketplace-ready)
}
```

### 2.6 The shop
An in-clinic panel that lists characters, previews each, and switches the ACTIVE
one. All free/unlocked for now. `price`/`locked` fields exist but are inert.

**Marketplace (future, explicitly out of scope for v3):** a paid store with real
money is a separate, business-scale project (payment processing + fees, user
accounts/auth, a backend server that breaks local-first, VAT/legal in the EU,
privacy policy + terms). Recommended order: ship the free local shop → grow an
audience → add payments only if there's demand. The data model built now is the
right foundation for that day, so nothing is wasted.

---

## Part 3 — build order for v3

Each step is its own PR, building on the clean seams from step 1.

1. **Bug-fix pass** — the four v2 bugs above, especially event-driven foreground
   detection (1.3) and reliable launch (1.1). Ship as a v2.1 patch before v3
   features, so the shipped app improves for current users.
2. **Module refactor + Character registry** — define the interfaces (renderer,
   personality, movement, animations, identity); refactor the current pet into "the
   default character" expressed through them; add the 2 new characters' data. No new
   UI. Proves the seams.
3. **Movement module + roaming** — the unique, non-random roam algorithm as a
   swappable behavior.
4. **Effects layer + trails** — trail system, settings toggle, first trail style;
   works for roam and drag.
5. **SpriteRenderer** — enable sprite-sheet pets; wire the electric-mouse character's
   animation set.
6. **Shop UI** — browse/preview/switch characters in the clinic.
7. **Polish** — custom app/tray icon, clinic redesign, and any remaining design work.

Deferred (post-v3 or as-needed): persistence + hatch date, all-drives storage panel,
"tuck in" reboot action, build/age tuning, weekly checkup letter, "chat with your
Byteling" box, signed installer via GitHub Actions, README hero GIF, local-model
(Ollama) option, autostart fix.
