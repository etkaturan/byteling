# Byteling v4 — "Memory"

> v1 gave it a body. v2 gave it a voice. v3 gave it movement.
> **v4 gives it a past.**

This is the largest release so far, and the most foundational. It adds the thing
the concept has been missing — your Byteling currently wakes with total amnesia
every launch — and it builds the seams that a future backend will slot into
without a rewrite.

**Status:** planning · **Builds on:** v3.0.0 (shipped)

---

## Part 0 — Why "Memory"

Right now your Byteling doesn't know it's the same creature you had yesterday.
It doesn't know how long you've had it, that you groomed it last week, or that
this is the third disk scare this month. It reacts to the present moment and
nothing else. That's the difference between a widget and a companion.

Persistence isn't one item on a list — it's the keystone. It unlocks the hatch
date, real age, care history, the weekly letter, and evolution. It also makes
the AI *smart* rather than merely contextual: a model that knows "47 days
together, last groomed 9 days ago, mood trending down" writes fundamentally
better lines than one that only sees right now.

Everything in v4 hangs off that idea.

---

## Part 1 — Scope, and what we're deliberately not building

### In scope

Twelve stages (Part 3). The headline additions: a public website, a save file
and everything it unlocks, wearables, and evolution.

### Explicitly out of scope, deferred to v5+

**No backend. No user accounts. No payments. No cloud sync.**

The reasoning, recorded so we don't relitigate it: accounts, a database,
payment processing and sync are the hardest, riskiest and most expensive parts
of the whole vision — and they serve the fewest people. Carrying your Byteling's
memory to a new PC is a wonderful feature *for someone who already loves
Byteling*. That audience doesn't exist yet. Building three months of auth,
Postgres, Stripe and GDPR compliance before anyone has arrived is how projects
die before their good part ships.

So: build the thing that brings people (a real website, a shareable pet), then
build for the people it brings.

### But: architect so v5 is additive

This is the part that matters, and it's the same move that made the v3 module
refactor pay off — build the seams now, fill them when there's demand.

| v4 decision | What it buys in v5 |
| --- | --- |
| Save file has a **schema version** from day one | Migrations and sync have something to negotiate with |
| The pet gets a **stable local ID** | It can be claimed by an account later without identity confusion |
| Save state is a **single serializable document** | It's already the sync payload |
| Wearables carry **`id` and `price`** (price unused) | The shop reads real data on day one |
| The site has a **`lib/` boundary** where an API client will live | Adding a backend touches one folder, not every page |
| Site content lives in **typed data files**, not JSX | Those files become API responses |

Nothing in v4 ships a server. Everything in v4 is *shaped* for one.

---

## Part 2 — The website

**Stage 1, and first for a reason.** Byteling currently exists only as a GitHub
repo, which reaches programmers and nobody else. A landing page is the single
highest-leverage publicity move available.

### Stack

**Next.js**, static export, deployed free (Vercel/Netlify/Pages). No server, no
database, no API routes in v4 — but Next.js is chosen precisely *because* those
are one folder away when v5 needs them.

### Structure

```
web/
  app/                 routes: landing, download, (later: shop, account)
  components/          the real Byteling SVG, download button, etc.
  lib/
    releases.ts        typed data: versions, assets, notes
    content.ts         page copy as data, not hardcoded JSX
    api/               EMPTY IN v4 — where the client lands in v5
  public/              icon, wordmark, hero gif
```

`lib/releases.ts` is the interesting one: v4 hardcodes the release list; v5
fetches it from the GitHub API or a backend. The pages don't change either way,
because they read from `lib/`, never from a fetch call directly.

### The design brief

**Hard requirement: it must not look vibe-coded.**

The tells to avoid, named explicitly so we can check ourselves: purple-to-blue
gradients, glassmorphic frosted cards, a pulsing green "online" dot, a
three-column feature grid with generic outline icons, a "Trusted by" row with no
logos, and copy that says "Elevate your workflow."

The antidote isn't more design — it's **restraint plus one real idea.**

Byteling's real idea is obvious: **the site should feel like the app.** Dark,
warm, ember-hued. And the hero isn't a screenshot of the pet — it's **the actual
Byteling**, the same procedural SVG component from `src/Creature.tsx`, breathing
and blinking on the page, reacting to your cursor. Possibly hatching a different
creature for each visitor.

That's a landing page nobody can copy, because it *is* the product. It's also
the clearest possible demonstration of what the app does, with no explanation
needed.

The rest is a download button that actually works, an honest explanation, and
nothing else. One idea, executed well, beats six features in cards.

---

## Part 3 — The twelve stages

Ordered so each unlocks the next, with visible payoffs early to keep momentum.

### 1. The website
Landing page + download page. Live Byteling hero. Download button per version,
structured for other-OS builds later. Brand assets applied. Ships standalone —
it works regardless of what else lands.

### 2. The save file
A versioned JSON document in the app config dir. The keystone.

```
SaveFile {
  schema_version: u32,        // migrations + future sync
  pet_id: Uuid,               // stable identity, claimable later
  hatched_at: DateTime,
  care_events: Vec<CareEvent>,   // grooms: when, MB freed
  mood_days: Vec<MoodDay>,       // daily rollups, never raw samples
  milestones: Vec<Milestone>,
  sessions: u32,
  total_uptime_secs: u64,
}
```

Written on first run, read on every launch, saved on change and on a timer.
Rollups not raw data — a year of daily summaries is small; a year of 5-second
samples is not.

**Design constraint: it must survive a Windows reinstall.** Once written, the
save file — not the OS install date — is the source of truth for age. That fixes
the real bug where a reinstalled machine reports a newborn creature.

### 3. Hatch date, real age, birth certificate
The clinic shows "hatched 14 March 2026 · 47 days old." Life-stage now comes
from **your relationship with the pet**, not a registry key. A Byteling you've
kept for a year becomes an Elder — earned, not detected. Much better story.

### 4. Memory-aware AI
Where v4 earns its name. `SpeechContext` grows relationship facts: days
together, days since last groom, mood trend, milestone today. Same pipeline,
dramatically better lines:

> "47 days together and you still haven't cleaned my temp folder. Bold."
> "That's the third disk scare this month. I'm starting to take it personally."
> "One month today. You're stuck with me."

Early in the order on purpose: it's the first moment the release *feels* like
its theme.

### 5. Bug fixes
- **Dizzy over-triggers.** One app switch shouldn't do it — the event-hook
  rewrite made detection instant and per-exe, so the old 5-in-30s threshold now
  trips immediately. Needs a real burst to count.
- **`cursor_idle_ms` returns 0 until the cursor moves once**, so roaming won't
  start after a fresh launch until you jiggle the mouse.

### 6. Wearables
**The right answer to the art problem.** Hats, ears, tails, moustaches layered
on the base creature. Small, simple SVG shapes — drawable without an artist,
infinitely combinable, and naturally sellable later.

The trick: **ears + tail + whiskers turn the octopus-blob into a cat.** We get
character variety without a single new renderer.

```
Wearable {
  id, name,
  slot: Head | Face | Back | Body,
  render: (species) => SVG,   // hue-aware, so it matches the pet
  price: u32,                 // unused in v4
  owned: bool,                // always true in v4
}
```

Equipped items live in the save file. Renders as a layer inside `PetView`, so it
works for any pet and any future renderer.

### 7. Care history + storage panels
Two clinic tabs. **History**: a timeline of grooms and a mood sparkline across
weeks — genuinely useful information about your machine that nothing else shows
you. **Storage**: the C/D/E stomach bars (informational; the Space need stays
C:-only).

### 8. Evolution
**Your Byteling is the accumulated evidence of how you treat your computer.**

Not a level bar. A `condition` value derived from care history modulates the
existing Creature params: months of a clean, cool machine → brighter glow,
fuller markings, calmer movement. Neglect → weathered, duller, thin aura.

Cheap to build (the Creature already takes params), and it's the emotional core
the concept has been reaching for. It's also the thing that earns a screenshot:
*"this is my 6-month Byteling"* is a post. A static creature isn't.

### 9. The weekly checkup letter
Waiting for persistence since v2. Once a week your Byteling writes you a note in
character about the week — what happened, how it felt, what needs attention.

A **shareable artifact**, which matters for reach. People post letters from
their computer.

### 10. Autostart, branding, hero GIF
Autostart finally (cut from v2, half-wired since). The pulse wordmark applied.
And the **hero GIF** — ten seconds of the pet reacting to app switches then
wandering off with its trail. Probably the highest-leverage single asset in the
release: right now the repo asks people to *imagine* the pet.

### 11. Signed installer
Via GitHub Actions. Kills the SmartScreen warning that currently greets every
download — the biggest friction between a curious visitor and a running pet.

### 12. Ship v4.0.0
Release, docs, announce.

---

## Part 4 — The spine

If v4 had to stop early and still be a real release: **stages 1–4.** The website
brings people, the save file gives the pet a past, age makes it visible, and
memory-aware AI makes it *felt*. Everything after that is depth.

---

## Part 5 — What we're still not doing

- **Sprite pets** — still blocked on art, and wearables now cover the need
  better. The renderer interface stays ready.
- **Edge-perching** — still the hardest feature for the least payoff.
- **The marketplace** — v5, if the audience arrives.
