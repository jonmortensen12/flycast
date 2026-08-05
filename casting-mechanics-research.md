# Casting mechanics — what the literature actually pins down

## The short answer to your question

You were right. The hand translates, and the sequencing between translation and
rotation is the core of the stroke. My v1 caster had zero translation, and it was
also moving about 2.3× faster than an expert. Both are now fixed, and the fix
changed the rod's verdict completely.

## 1. Sequence — the finding that matters most

**Röijezon, Løvoll, Henriksson, Tonkonogi & Lehto (2017)**, *Annals of Applied
Sport Science* 5(2):61–72. 3D motion capture of elite casters, four rod/line
setups, single-handed distance casting with double haul.

Their result: peak speed occurs **first for rod translation, then rod rotation,
then the line haul** — consistent across back cast, forward false cast and
delivery cast, and across all four setups.

**Løvoll & Borger**, *The Rod & The Cast* (500 fps video, two Norwegian casters)
see the same order from a completely different method: rod hand reaches maximum
speed, then the butt reaches maximum angular velocity, then the rod reaches
minimum chord length.

Two independent techniques, same ordering. This is the most solid thing in the
literature and it is now the backbone of `caster2.mjs`.

Coaches surveyed in the fly-distance literature nominate translation over
rotation, and rate javelin as the most similar sport — a proximal-to-distal
kinetic chain, not a wrist flick.

## 2. Magnitude — the number that indicted my caster

**Perkins & Richards' Casting Analyzer** (rate gyro on the reel seat, Univ. of
Michigan / Scientific Anglers) measures peak butt angular velocity of:

- **300 deg/s** on the back cast
- **355 deg/s** on the forward cast
- roughly 15% asymmetry between them

My v1 caster peaked at **785 deg/s**. That single number explains the 96–100° of
rod bend I flagged last session and asked you to eyeball.

## 3. Rod deflection — an independent check on the blank

High-speed video (Perkins at Michigan, Løvoll in Norway, 1000–5000 fps):

- peak deflection occurs about **70–80% through the stroke**
- a 9 ft 5wt deflects **45–75 cm** from straight at that point
- the rod returns to straight roughly 10–15 ms after the stop

This is a direct, falsifiable test of rod stiffness that needs no preference
experiment: drive the sim at expert butt speed and see whether the tip deflects
into that band.

## 4. Geometry — arc and stroke length

From instructional canon (Gammel's five essentials, FFI, Gulf Coast school,
sexyloops):

- The rod tip must track a **straight line path**. Convex tip path → wide loop.
  Concave → tailing loop.
- **Arc must match the rod's bend.** Too wide for the bend opens the loop, too
  narrow tails it.
- **Both arc and stroke length scale with line length.** Short line: narrow arc,
  short stroke, short pause. Long line: wider arc, longer stroke, longer pause.
- Acceleration is smooth to a **hard stop**; the stop is what throws the loop.
- Pause must let the line straighten without letting it fall.

## 5. What is NOT available

The raw kinematic traces are not downloadable. Röijezon's data and Ekander,
Perkins & Richards (*Sports Engineering* 28:2, 2025) are both "available from the
corresponding author on reasonable request." Neither publishes the time series.

So rather than fitting to a trace we cannot obtain, `caster2.mjs` is
parameterised on the quantities that ARE pinned down — sequence, peak butt
angular velocity, arc, stroke length — and `exp-validate.mjs` checks the
simulation output against the published deflection band. That turns out to be
enough, and it has the advantage of being reproducible by anyone.

If you want real traces later, two routes: email Röijezon or Ekander (academics
usually say yes to a specific, polite request), or extract from 500 fps casting
video with marker tracking — which is what Løvoll did with ImageJ and MATLAB.

---

# Results after rebuilding the caster

## Validation against the published band

| stroke | butt deg/s | tip defl cm | total bend | tip m/s | tip path RMS |
|---|---|---|---|---|---|
| **target (published)** | **300–355** | **45–75** | — | — | near straight |
| v1 (rotation only) | 785 | 178 | 97° | 29.2 | 2.5 cm |
| **v2 (translate + rotate)** | **343** | **65** | **36°** | 14.9 | 10.8 cm |

**Your rod is fine.** Driven at expert butt speed it deflects 65 cm, squarely
inside the published 45–75 cm band for a 9 ft 5wt. The 96–100° of bend I flagged
last session was entirely my caster, not your blank. I was wrong to raise it as a
possible rod problem.

Note v1's tip-path RMS looks *better* — that is an artifact. A rod folded double
traces a smooth arc; smoothness is not straightness toward the target.

## Arc behaves the way the books say

| arc | tip path RMS |
|---|---|
| 40° | 6.3 cm |
| 55° | 9.4 cm |
| 70° | 14.4 cm |
| 90° | 21.7 cm |

Wider arc, more curved tip path, and per the canon that means a more open loop.
The model reproduces a qualitative rule it was never fitted to — a genuine
independent check on the rod physics.

## Stroke tuning at 9.5 m of line

| arc | stroke | tip RMS | defl |
|---|---|---|---|
| **25°** | **25 cm** | **2.5 cm** | 54 cm |
| 25° | 45 cm | 3.8 cm | 55 cm |
| 32° | 25 cm | 3.0 cm | 56 cm |
| 40° | 45 cm | 5.8 cm | 47 cm |
| 48° | 65 cm | 7.4 cm | 44 cm |

## Two things I do not yet trust

1. **Longer stroke makes the tip path worse in my model**, which contradicts the
   instructional rule that longer line wants a longer stroke. Either my hand path
   direction is wrong (it currently runs at a fixed 8° above horizontal) or the
   translation timing is off. Worth resolving before trusting stroke length.
2. **The optimum sits at the edge of the grid** (narrowest arc, shortest stroke
   tested). The true minimum may lie outside it, and 25° is narrow for 9.5 m of
   line by conventional guidance.

Both are caster problems, not rod problems.
