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
