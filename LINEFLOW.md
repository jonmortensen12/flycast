# Flycast — line flow between the reel, the guides and your hands

Companion to `HANDOFF.md`. That document covers the physics as a whole; this one
covers the subsystem that decides **how much material sits on each side of the
guides, and how fast that changes** — the feed rule, the spool payout, the
grips, and the slack pool between the reel and the stripping guide.

It exists because that subsystem was the source of a family of bugs that all
looked like "the pooled line jumps around" and all turned out to be the same
mistake wearing different clothes.

Read alongside section 2.2 and 2.3 of `HANDOFF.md`.

---

## 1. The one mistake behind most of it

**Any rule that moves a material boundary must move it at a rate something
physical would allow.** Every bug below is a violation of that sentence.

`lineOut` and `offSpool` are material coordinates. Moving them reassigns which
piece of line sits in each guide. The solver then has to relocate nodes to match,
and because velocity is recovered as `(pos - prd) / h` with `h` = 2.3 ms, **a
2 cm relocation reads as 8.6 m/s and a 5 cm one as 21.6 m/s**. There is no
separate "teleport" path — a boundary that jumps *is* a velocity spike, always.

So the design rule for this subsystem: boundaries move at velocities, velocities
come from forces, forces come from tension against friction. Nothing steps.

---

## 2. What was wrong, and what it was replaced with

### 2.1 The feed rule saturated its own clamp

The rule computed slip from tension excess against an effective mass taken from
**one node's** `invM` — 3.96e-5 kg at 0.08 m spacing. The mass that actually has
to accelerate is the sliding column, order 7.7e-3 kg. **195x out.**

The consequence was not "slightly too fast". It was bang-bang: any imbalance
over about 0.25 N reached the velocity clamp *inside a single 2.3 ms substep*,
so the feed only ever ran full-off or full-on, dithering at 432 Hz.

An earlier attempt had already converted the feed from a position step to a
velocity (`feedVel`), which was the right structural move, but kept the
single-node mass. That is why it did not help: the saturation simply migrated
from the position clamp to the velocity clamp, and two exponential decays
(`pow(0.05, h/0.02)` and `pow(0.5, h/0.06)`) were added to mop up after it.

**Now:** `mSlip` is the real column mass — tiptop to spool lip, plus half the
line outside the tip — scaled by the `Slip inertia` setting. Tension excess
accelerates against it. Inside the friction cone, Coulomb friction arrests it and
cannot overshoot zero. Both exponential decays are gone.

### 2.2 Slip inertia wants ~0.06, not 1.00, and that is not a fudge

The derived full-column figure is 1.00. In the headset it needs **0.06**.

That gap is real physics, not tuning slop. A tension wave in 5wt line at ~1 N
travels about 32 m/s, so in one 2.3 ms substep it covers roughly 7 cm. **Line
further away than that has not heard about the feed yet and cannot resist it.**
The inertia felt at the guide over one substep is the material within one wave
transit, not metres of column out to the reel. 0.06 of the column works out to
about half a metre of line, which is the right order for that.

Measured landmarks, in the headset:

| Slip inertia | behaviour |
|---|---|
| below ~0.02 | the old jitter returns |
| **0.06** | **clean feed, no jitter on a slow pull** |
| above ~0.6 | line creeps back down the rod, pool grows while casting |
| above 1.0 | line falls through the guides under its own weight if the rod points up |

The high-inertia failures have a specific cause worth knowing: acceleration is
`F/mSlip` and arrest is `hold/mSlip`, so **one parameter controls both**. Heavier
means slower to start *and* slower to stop, and the drift wins.

**The principled fix, not yet done:** derive `mSlip` from a tension-dependent
coupling length, `L = sqrt(T/mu) * h`, instead of the whole column. That would
put the default back at 1.00 and make it adapt with load. It would move the
current tuning, so it was deliberately left for its own session.

### 2.3 The routing pulley was rate-limiting the wrong quantity

`grabArc` chased a target slaved to `lineOut` through a hard 1.2 m/s limiter —
0.0167 m per frame. Ordinary feed runs 0.020 m per frame and peaks at 0.236.
**The limiter could not keep up with normal casting.**

When line feeds out, the material at your fingers must move with `lineOut` one
for one and *no line slides through your fingers at all*. That is bookkeeping,
not sliding, and it should not be rate limited. Limiting the total meant the
stripper-to-hand span carried the wrong material length every frame.

Measured in the ghost recordings: that span should have sat still at 0.68 m. It
wandered between 0.53 and 1.61 m, mean 0.97, stdev 0.23, swinging 3.2 cm per
frame and up to 26.6 cm.

**Now:** the limiter applies to the arc *relative* to the stripping guide, and
the slide itself is a critically damped velocity (`Hand slide rate`) rather than
a hard cap. At the default of 8 rad/s a 0.2 m hand move settles in ~720 ms with a
0.6 m/s peak and no overshoot.

**This is still not good enough.** Routing continues to throw the pool around
under fast feed, and `Routing enabled` now **defaults to off**. See section 5.

### 2.4 `MIN_SLACK` could not span the gap it was guarding

`MIN_SLACK` is a fixed 0.25 m. The stripping guide sits further from the reel
than that on any real rod. So the clamp pinned the belly at a length that
physically cannot cover the distance, which produced:

- the line pulling dead straight,
- a **visible gap at the reel**, because the soft reel pin could not close it,
- and a deadlock, because the same clamp pushes `lineOut` back, so nothing could
  leave the tiptop either.

**Now:** the floor is the live stripping-guide-to-reel distance plus a margin
exposed as `Reel slack m` (default 0.10).

**A small residual pool after a cast is correct and is not a bug.** That straight
run always holds line — real material spanning a real gap, which can never be
shot. Only the margin above it is adjustable, and at 0.00 the visible gap
returns.

### 2.5 The spool payout test ran when nothing was gripping

The geometric payout rule — material from grip to spool cannot be shorter than
the straight distance — is only meaningful when something actually **grips** the
line. It was running under routing too, where line slides through the fingers
freely. `Lr` grew every time `offSpool` grew, until `Dr - Lr - deadband` could
never be positive again and **the reel stopped giving line permanently after a
few pulls**.

**Now:** geometric branch under a pinch only. Routing falls through to the
tension test, same as an empty hand.

### 2.6 The payout threshold was unreachable while holding line

`thr = spoolDrag * 1.15 + statFric`. At a 3.0 drag setting that is 3.5 N, and
since 2.4 guarantees the belly always has slack, the spool probe can never see
anything close to it. Symptom: the spool would not give unless the drag was
turned below 3.

A drag set for a running fish is not what you pull against when stripping line
off the spool by hand. **Now:** `Drag when held` (default 1.00) substitutes while
the left hand holds line or the cork is clamped. It only ever lowers, and the
fish-fighting drag path still uses the true setting, so a run is unaffected.

### 2.7 A grip blocked all feed instead of just the reel side

`handPinched` and `rodPinch` both zeroed the feed outright. But a grip stops line
being drawn **from the reel side**; the pool between the stripping guide and that
grip is still free to go out through the guides. That is what a grip does.

**Now:** feed draws from whichever reservoir is available, taking the smallest on
offer — the grip nearest the stripping guide governs. Handles a cork clamp, a
left-hand pinch, or both at once.

### 2.8 Coulomb arrest collapsed exactly when it was needed

The arrest force used `statFric + min(Tin, Tout) * (cap - 1)`. With a loaded tip
against a slack belly, `min` is zero, so the whole hold collapsed to `statFric`
alone — 0.05 N — which is the commonest case in casting and the one where the
line most needs holding.

**Now:** `statFric + max(Tin, Tout) * (1 - 1/cap)`, which is the capstan
statement: friction available is `T_high - T_low`.

### 2.9 Velocity wound up behind every clamp

`feedVel` was clamped in position but never zeroed, so it accumulated behind a
clamp and sprang the moment the clamp released. Every clamp — belly exhausted,
`MIN_OUT` floor, slack floor — and reset cast now zero it.

---

## 3. New settings

All under **FRICTION** in the menu.

| Setting | Default | What it does |
|---|---|---|
| `slipInertia` | 0.06 | Mass resisting feed, as a fraction of the sliding column. See 2.2. |
| `dragHeld` | 1.00 | Reel drag substituted while the line is held. Only ever lowers. |
| `reelSlack` | 0.10 | Margin of slack above the straight stripper-to-reel run. |
| `routeOn` | 0 | Whether a light trigger squeeze routes line at all. Off by default. |
| `handSlide` | 8.0 | Critically damped slide rate through routing fingers, rad/s. |

---

## 4. How these were found, and how to find the next one

Nearly all of it came from the **ghost recorder**, not from watching the headset.
Two 3-second captures were enough. The recorder now also logs `feedVel` and
`mSlip`, so the feed is directly observable.

The metrics that actually discriminated:

| Metric | What a healthy value looks like | What it caught |
|---|---|---|
| Path travelled ÷ net change in `lineOut` | near 1.0 | 1.77x — the boundary was oscillating, not moving |
| Direction reversals per capture | few | 15 with no hand on the line, 95 while routing |
| Histogram of per-frame `d(lineOut)` | smooth, unimodal | a cluster sitting on the clamp = saturation |
| Mean `lineVmax` on frames where `lineOut` moved, vs frames where it did not | similar | 4.2 vs 2.2, and 12.5 vs 6.7 — the boundary was the source |
| Correlation of `d(grabArc)` with `d(lineOut)` | near 1 while feeding | −0.03 — the hand pin had come unstuck from the guide |

**A cluster of per-frame steps sitting on a clamp value is the signature of this
entire bug family.** If a clamp is where the operating point lives rather than a
safety net, the gain feeding it is wrong.

---

## 5. Still open

1. **The threshold collapses when the belly is slack.** `Tin` is read at a probe
   just below the stripping guide and only accumulates when that segment is
   taut. A slack belly means `Tin` ≈ 0, so the capstan threshold reduces to
   `statFric` alone, 0.05 N — and the weight of 6 m of fly line hanging outside
   the tiptop is the same order. The line is therefore permanently marginally
   over threshold. **Measured: 0.86 m of unbidden feed in 2.8 s with no hand on
   the line at all.** This is the largest remaining known defect in the
   subsystem and it has never been addressed.

   Warning for whoever takes it: the obvious fixes (raise the floor, raise
   `statFric`) push the same direction as raising `Slip inertia`, and stacking
   them re-creates HANDOFF bug 2, line welded to the rod tip. Fix the threshold
   *or* the inertia, measure, then decide.

2. **Routing still throws the pool around** under fast feed, and is off by
   default. 2.3 improved it but did not solve it. The remaining suspect is that
   the hand pin is `pinLinePerp` at a material point while the *world* point
   rides a fixed offset from the hand — so the span between stripper and hand has
   its length set by one process and its endpoints by another, with nothing
   reconciling them.

3. **`mSlip` should be a wave-coupling length, not the whole column.** See 2.2.
   Would restore the default to 1.00 and make it adapt with tension.

4. **The GitHub `main` branch is stale.** It is ~700 lines behind the working
   build and lacks the audio settings, `lineTaper`, `obstHeight`, and the motion
   recorder. Push before anything else.

---

## 6. Build tags

`index.html` now carries a build tag in the `<title>` and on the 2D overlay under
the Flycast heading, visible before pressing **Enter VR**. Bump it on every
change so "am I running the newest file" is answerable at a glance.

This work is build `2026-08-08e`.

---

## 7. Blocks to paste into HANDOFF.md

### Into section 4, Controls — replace the Left trigger rows

```
| Left trigger  | under 15% free · 15–85% **routes** — DISABLED BY DEFAULT, see `Routing enabled` · over 85% **pinches** |
```

### Into section 5, Bugs that shipped — append

```
11. **Pooled line jumped whenever line moved through the guides** — the feed
    rule's effective mass was one node's, ~195x too small, so it saturated its
    own clamp and ran bang-bang at 432 Hz. Converting it to a velocity without
    fixing the mass does nothing: the saturation just moves to the velocity
    clamp. See `LINEFLOW.md`.

12. **The reel stopped giving line after a few pulls** — the geometric payout
    test ran under routing, where nothing grips the line, so its material span
    grew without bound until payout could never trigger.

13. **A visible gap opened between the line and the reel, and nothing more could
    leave the tiptop** — `MIN_SLACK`'s fixed 0.25 m is shorter than the real
    stripping-guide-to-reel distance, so the clamp held the belly at a length
    that cannot span the gap, and deadlocked against its own `lineOut` push-back.

14. **A pinch welded the line instead of holding it** — gripping blocked all
    feed, when it should only stop line being drawn from the reel side. Affected
    the cork clamp and the left hand independently; fixing one did not fix the
    other.
```

### Into section 6, Open problems — append

```
8. **Feed threshold collapses on a slack belly.** Measured 0.86 m of unbidden
   line feed in 2.8 s with no hand on the line. See `LINEFLOW.md` section 5.
9. **Routing is off by default** and still unsolved. See `LINEFLOW.md`.
```

### Into section 3, Calibration table — append

```
| Slip inertia | 0.06 of column mass | wave transit at 2.3 ms, ~7 cm; measured in headset |
| Drag when held | 1.00 N | hand-stripping is not a fish-fighting drag |
| Reel slack | 0.10 m above the straight run | enough for the soft reel pin to close |
```
