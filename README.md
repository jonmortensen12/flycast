# Flycast headless harness

Runs the real physics core in Node with no renderer and no headset, driven by a
scripted caster. A 5.5 s cast simulates in about 0.8 s.

## The key design choice: no duplicated physics

`sim.mjs` is **generated**, not written. `build-sim.py` slices sections 1–3 and
`resetCast` straight out of `index.html` by section marker and bolts on a small
driver surface. So the harness can never drift from the game.

**Re-run `python3 build-sim.py` after every edit to `index.html`.**

```
cp ../index.html .          # whatever you just changed
python3 build-sim.py        # regenerate sim.mjs
node exp-verify.mjs         # confirm nothing regressed
```

## Files

| file | what it is |
|---|---|
| `build-sim.py` | extracts the physics core → `sim.mjs` |
| `three-stub.mjs` | ~90 lines standing in for THREE's Vector3/Quaternion |
| `caster.mjs` | the scripted caster — rod pitch over time, stroke parameters |
| `run.mjs` | driver + loop-quality metrics. `node run.mjs one` traces one cast |
| `exp-stretch.mjs` | line stretch vs node length vs solver iterations |
| `exp-verify.mjs` | regression check on stretch after the solver fix |
| `exp-pause.mjs` | pause-timing sweep across rod models |
| `exp-grab.mjs` | grab-and-release energy test |
| `iso.mjs` / `iso2.mjs` | single-config stretch measurement, one per process |
| `record.mjs` | runs clips and dumps `frames.json` |
| `render.py` | `frames.json` -> four-view MP4 (PIL + ffmpeg) |

## Making a video

```
node record.mjs        # edit the clip list at the bottom
python3 render.py      # writes flycast-sim.mp4
```

Each clip is `record(name, note, {config, stroke, iter})`. `config` overrides any
setting in `P`, `stroke` overrides the caster, and `iter` pins solver iterations
(0 uses the adaptive rule).

**Run every experiment in its own process.** Runs share module state, and
sequential runs in one process contaminate each other — that produced a wrong
convergence number before it was caught.

## How the caster drives the rod

The game's entire rod input is two world points per frame, `_k0` and `_k1`. The
caster supplies a hand position and quaternion; `setHand()` derives the same two
points the controller would. Everything downstream is unmodified game code.

Stroke parameters live in `STROKE` in `caster.mjs`: start/back/forward angles,
stroke durations, pause, and `power` — the acceleration exponent. Casting is
accelerate-then-stop-dead, so the ease accelerates all the way to a hard
terminus rather than decelerating into it.

## Metric status — read this before trusting a number

**Trustworthy:** peak stretch (chord ÷ material length), max rod bend, max tip
speed, node count, solver iterations. These are direct measurements with obvious
correct values.

**Not yet trustworthy:** `maxLoopH` and `peakStraight`. `maxLoopH` measures the
vertical spread of *all* airborne line, which includes belly sagging toward the
water, so it reads ~4 m regardless of whether a tight loop formed.
`peakStraight` saturates near 1.0 because the line eventually straightens under
gravity no matter what the stroke did. Both need rewriting before they can
discriminate between rods — see below.

## Running the tests

```
node smoke.mjs                 everything — the only run that can pass
node smoke.mjs fight zone      just those sections
node smoke.mjs --list          the section names
```

A full run is ~10 minutes (583 s measured, down from 692 s); a single section
is 30-90 s, because the fixed cost of loading the game and settling the water
is about 30 s and the rest is the section itself. Where the time goes:

| section | cost | why |
|---|---|---|
| `fight` | 350 s | four twenty-second fights, hooked and played |
| `water`, `specks` | ~18 s each | 200-250 frames to settle the grid before measuring it |
| everything else | seconds | |

**A filtered run is not a green build, and it does not print OK.** These tests
deliberately share one world — they hook fish, spook them, press buttons, move
the rig and draw from the same random stream — so a section run alone sees a
different world from the same section run in sequence. It can pass alone and
fail in place, or the reverse: `ROD-BEND` fails on its own because it needs
state earlier sections leave behind. Use it for a fast answer while you work,
and confirm with a full run before shipping.

## The harness had rotted, and is only partly repaired

It could not be imported at all on a clean checkout, some commits before anyone noticed.
Four separate causes, all now fixed:

- `three-stub.mjs` had Vector3 and Quaternion and nothing else, while section 3 had grown
  to build a net, a boat, obstacles and a speck cloud at module scope. It now has inert
  scene-graph and geometry stubs — which, following this file's own rule, **raise rather
  than invent** if anything tries to read rendering data back out of them.
- The same growth left the slice referencing `camera`, `scene` and `player`. `build-sim.py`
  supplies them as bare scene-graph nodes.
- `build-sim.py`'s own driver referenced an undeclared `_grabFrom`, so every run died the
  moment it reached the grab path.
- `physics()` calls `pushOutCanopy`, which lives in section 4 and was not being carried.
  `pull_function` lifts it by name; it is genuinely physical code that happens to sit next
  to the meshes it relates to.

`exp-verify.mjs` runs again. **`diag2.mjs` still does not** — its own separate THREE stub is
several features behind (`setFromAxisAngle` and `setScalar` added; it now falls over on
`window.addEventListener`). Every fight bug in HANDOFF section 5 was found with it, so it is
worth an hour before the next change to the fight.

## What to fix next in the harness

1. **A real loop metric.** Find the loop apex — the point of maximum curvature
   along the airborne line — then measure the perpendicular distance between the
   two legs on either side of it. That is loop width, and it is what a caster
   actually judges. Ignore everything behind the apex.
2. **Turnover as a time series, not a peak.** Record when the leader straightens
   relative to the forward stop. Late turnover and no turnover both currently
   score ~1.0.
3. **Rod bend is suspiciously high.** 96° total at the default stroke, 64° at
   half speed, 162° with a narrow arc. A real 5wt at 30 ft bends nowhere near
   that. Either the caster's stroke is far too aggressive or the blank is too
   soft — worth resolving before any rod comparison, because it contaminates
   everything. Clip 3 in the video is this question.
