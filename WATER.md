# Flycast — water: how it is solved, how it is drawn, and how it went wrong

Companion to `HANDOFF.md` and `LINEFLOW.md`. That last one covers the line;
this one covers **the river** — the flow solver, the surface, the bed, the
foam, and the several years' worth of bugs found in them in a single session.

The short version, and the thing to remember before touching any of it:

> **Almost every water bug here was a rendering bug, not a solver bug — and the
> two that were solver bugs were invisible because the rendering of them was
> also broken.** A field can be correct and drawn wrong, drawn correctly and be
> zero, or be right and clipped on the way to the GPU. Establish which of the
> three you are looking at before changing anything.

---

## 1. Architecture

Two models, chosen by `waterModel`:

- **0 — analytic.** A closed-form velocity field: parabolic cross-section,
  channel slope, plus a hand-written deflection term per obstacle and a vortex
  list. Cheap, always available, and used as the fallback outside the solved
  window. `analyticFlow()`.
- **1 — solved grid (default).** A 2-D free-surface solver on a regular grid.

### The grid

| | default | notes |
|---|---|---|
| span along X | `gridSpan` 80 m | window centred on origin, or on you if `gridFollow` |
| across Z | river width + 0.6 m | never moves; the grid always spans the full channel |
| cell | `gridCell` 0.45 m | 178 × 32 ≈ **5,700 cells** |
| rate | `gridRate` 20 Hz | decoupled from frame rate by an accumulator, max 3 steps a frame |

Fields, all `Float32Array` of `GNX*GNZ`: `gu`, `gv` velocity · `gh` **depth** ·
`gbed` bed elevation · `gsolid` · `ginv43` friction term · `gslope` per-column
channel slope · `gfoam`/`gfoam0` · `gdivs` signed divergence · `gshear`.

### A solver step

1. **Body force** — gravity down the channel slope, minus Manning bed friction.
   Friction is applied implicitly (`1/(1+fr*dt)`) because explicit friction
   flips sign and explodes in thin water.
2. **Semi-Lagrangian advection** of `gu`, `gv`.
3. **Boundaries** — inflow at Manning's normal velocity for the local depth and
   slope, outflow copied, walls no-flow.
4. **Free surface** — continuity, then the pressure gradient continuity implies,
   then smoothing. CFL-substepped internally, up to 6 substeps. See §3.

### What reaches the GPU

Two `DataTexture`s, both `GNX × GNZ` RGBA8, uploaded whenever a step ran:

| texture | R | G | B | A |
|---|---|---|---|---|
| `gridTex` | velocity X | velocity Z | depth ×80 | transported foam |
| `gridTexH` | surface deviation | signed divergence | shear | unused |

Velocity uses a **signed square-root encoding** over ±8 m/s — see §7.

### Consumers

- **Water surface** — vertex shader displaces by `gridTexH.r`; fragment shader
  reads flow, depth, foam, divergence, shear.
- **Riverbed** — `onBeforeCompile` on a `MeshStandardMaterial`, reads `gridTex`
  for speed and depth to blend four surfaces.
- **GPU specks** — vertex shader re-integrates a streamline through `gridTex`.
- **CPU physics** — the fly, the line, the fish, CPU specks, all through
  `computeFlow()` → `gridSampleField()`, reading the arrays **directly**.

That last split matters: the CPU path never touches the texture. Any bug in the
encoding shows up in three consumers and not in the fourth, which is a very
useful diagnostic (§8).

---

## 2. The solver had no free surface

**The single largest defect found.** `gh` — the depth field, and therefore the
water surface — was written once in `gridBuildBed()` and **never updated by the
solver**. Step 4 was a pressure projection enforcing `div(h·u) = 0`: a rigid
lid. The lid could not move, so:

- Obstacles influenced the flow only through the depth weighting inside the
  Poisson solve. Indirect and weak. Specks appeared to sail straight through
  rocks and **Obstacle height** did almost nothing — both symptoms reported
  from the headset before the cause was known.
- No pillow upstream of a rock, no drawdown over it, no standing wave below.
  Those *are* free-surface features; a rigid lid cannot express them.
- **Surface relief** and **Wave shading**, built two sessions earlier to display
  the solved free surface, were reading a deviation field that was identically
  zero everywhere, forever. Both settings did nothing at any value.

Worse, the old model had the response **backwards**. Measured on a 1-D channel
with a 1.0 m rock, flow at the crest:

| | over the crest | surface |
|---|---|---|
| old rigid lid | 2.50 → **0.76 m/s** | 0.00 everywhere |
| new free surface | 1.32 → **4.53 m/s** | +0.14 upstream, −0.26 below |

Water *accelerates* over a shallow crest — that is continuity — and it was
slowing down instead.

---

## 3. What replaced it

```
4a. continuity          h -= dt * div(h·u)
4b. surface gradient    u -= dt * g * grad(eta - stillWater)
4c. smoothing           small Laplacian on h, u, v
```

Three things worth understanding before editing this:

**The gradient is taken on the departure from still water, not on the absolute
surface.** The mean channel slope is already driving the flow in step 1; using
the absolute surface would count it twice and double the current.

**It is cheaper than what it replaced.** The Poisson solve was `gridIter`
sweeps of the whole grid, four minimum. This is two passes plus smoothing.

**The smoothing is not optional.** Velocity and depth live at the same points,
which lets odd and even cells decouple into a checkerboard — a compact
divergence against a wide gradient. Without it the reach rings at **±0.3 m of
surface on a dead flat bed**. At `waterSmooth` 0.08 a flat bed solves flat.
Staggering the grid would be the textbook fix; smoothing is cheaper and was
enough.

Stability is set by the gravity wave speed `sqrt(g·h) + |u|`, about 4.9 m/s in
1.2 m of water. `gridStep` measures this and substeps internally rather than
trusting the frame rate.

---

## 4. Transport speed is not wave speed

A disturbance crosses shallow water at `sqrt(g·d)`. The water itself moves at
`u`. These are **completely different numbers** and confusing them produced a
bug worth recording, because the reasoning that caused it sounded correct.

The surface ripple was, briefly, scrolled at `v ± sqrt(g·d)` — the two wave
families, which is genuinely how disturbances propagate. In a 1 m pool with a
1.3 m/s current that is **4.4 m/s downstream and 1.8 m/s upstream**, while the
fly drifts at 1.3. One layer was moving the wrong way entirely.

Physically correct, and exactly wrong for this game. **The one thing an angler
reads off the water is where a drifting fly will end up.** The surface must
show transport.

Now the dominant layer is **flow-map advected**: the pattern is carried in two
half-cycle-offset phases and cross-faded, resetting each cycle before the shear
becomes visible. It travels at the local water speed — the same field advecting
the specks and carrying the line. `drift` controls the balance; the celerity
layer survives underneath as a minority contribution, because a real surface
does carry both.

**Rule for this subsystem:** if a visual choice makes the water prettier but
less informative about drift, it is the wrong choice.

---

## 5. The bed is a record of the flow that made it

The riverbed had **no texture at all** — vertex colours on points a metre
apart, which is why it read as smooth plastic under clear water.

It now blends four generated surfaces, and the blend is keyed on **speed from
the solved grid**:

| water | surface |
|---|---|
| fast | cobble, scoured bare |
| moderate | gravel |
| slack | sand |
| above the line | soil with grass and leaf litter |

Boundaries are perturbed by the macro noise so the bands are ragged like a real
bar rather than three neat stripes.

Two mistakes are recorded here because both are easy to repeat:

- **Keyed on depth first.** That put silt straight down the middle of the
  channel — the fastest water in the river and the one place a real bed is
  scoured clean. Silt settles where flow is *slow*, not where it is deep.
- **All four surfaces shared the cobble normal map.** The colour maps were
  genuinely distinct — lumas 146/147/189/82 — but every surface was *shaped*
  like cobble, so they read as one material. Relief matters more than colour
  for identifying a substrate. All four normals now blend by the same weights,
  perturbing the world normal directly since the bed is near-horizontal, which
  also avoids depending on how three spells its tangent-frame helper.

Also here: macro variation at ~40 m over the 2 m tile (tiling is invisible when
the eye has something larger to lock onto), caustics scrolled along the solved
flow, and a wet band above the waterline.

---

## 6. Foam is transported, not observed

Foam used to be computed fresh each frame from the magnitude of divergence, so
it existed only where turbulence was happening at that instant — a symmetric
halo around every rock.

It is now a **transported scalar**: generated where the flow tears, then carried
by the solved velocity, semi-Lagrangian, decaying over `foamLife`. Measured on
a 1-D slice, foam from a single rock cell is still visible **17 m downstream**.

The other half of the fix was **taking the sign of divergence**. Convergence and
divergence were being drawn identically, and they look nothing alike:

- **divergence > 0** — water rising. The surface goes smooth and glassy and
  mirrors the sky. This is a boil.
- **divergence < 0** — converging. Dimples, darkens, and collects the foam.

Shear magnitude draws a faint line down seams where two speeds meet.

---

## 7. The flow texture was clipping at 3 m/s

Velocity was packed linearly as `(v/GRID_VSCALE + 0.5)*255` with
`GRID_VSCALE = 6.0` — a range of **±3.00 m/s**. The solver clamps at **8 m/s**.
Every cell faster than 3 saturated the byte and read back as exactly 3.00.

CPU specks index `gu[]` directly and never saw it. GPU specks, the water
surface and the bed all read the texture. Reported from the headset as *"GPU
specks don't keep up, and it gets worse when I raise the flow or the grade"* —
which is exactly right, because raising either pushes more of the field past 3.

Now a **signed square-root encoding over ±8 m/s**, which removes the clipping
without paying the low-speed precision a linear ±8 map would cost:

| solver | linear ±3 | linear ±8 step | sqrt ±8 |
|---|---|---|---|
| 0.25 m/s | 0.25 | 0.063 | 0.25, step 0.023 |
| 3.00 m/s | 3.00 | | 3.03 |
| 6.00 m/s | **3.00 clipped** | | 6.01 |
| 8.00 m/s | **3.00 clipped** | | 8.00 |

The decode is one shared GLSL helper (`GLSL_VDEC`) injected into all three
shaders, so the encoding cannot drift out of step with its readers again.

**If you change `GRID_VSCALE`, check it against the solver's velocity clamp.**
That mismatch is what caused this.

---

## 8. How to diagnose water problems

**Compare CPU and GPU specks.** They read the same field by completely
different routes — arrays versus texture. If they disagree, the bug is in the
encoding, the upload, or the shader. If they agree and both look wrong, the bug
is in the solver. This one comparison found §7 immediately.

**Set a feature to zero. If nothing changes, it was already doing nothing.**
That is how §2 surfaced: Surface relief at 0 and at 2.5 looked identical,
because the field behind it was zero.

**Test the solver headless.** `solvertest.mjs` runs a 1-D channel with a rock
on the bed and prints speed and surface departure with and without the free
surface. No GPU, no headset, runs in a second, and it caught both the sign
error and the checkerboard ringing before either shipped.

**Watch `gridMs` in the preview HUD.** The solver is not your performance
problem — 5,700 cells at 20 Hz is well under a millisecond against a line
solver doing 5.5 million constraint solves a second. Measure before optimising
the water; the answer is usually that it is free.

**Run `initcheck.mjs` before committing.** Two builds in a row shipped a
module-init crash that `node --check` waves through and that kills the entire
page, buttons included, because a throw during init stops every later listener
from being attached.

---

## 9. Settings

**Solver**

| setting | default | |
|---|---|---|
| `waterModel` | 1 | 0 analytic, 1 solved grid |
| `current` | 0.55 | discharge, drives the body force |
| `grade` | 1.00 | channel slope multiplier |
| `gridCell` | 0.45 m | resolution |
| `gridSpan` | 80 m | length of solved window |
| `gridFollow` | 0 | window slides with you, whole cells only |
| `gridRate` | 20 Hz | solver steps a second |
| `waterSmooth` | 0.08 | checkerboard damping — do not set to 0 |
| `manningN` | 0.055 | bed friction |
| `obstHeight` | 0.80 | scales rocks; now genuinely affects the flow |
| `vortex` | 0.60 | analytic vortex strength |

**Surface**

| setting | default | |
|---|---|---|
| `surfWave` | 1.00 | displace by the solved free surface |
| `waveShade` | 1.00 | shade by its slope — see §2 |
| `drift` | 1.00 | transport versus celerity — see §4 |
| `streak` | 1.00 | flow-aligned anisotropy |
| `boil` | 1.00 | signed divergence response |
| `froth` | 1.00 | whitewater where Froude > 1 |
| `foam` / `foamLife` | 1.00 / 6.0 s | foam amount and persistence |
| `waterDetail` | 1.00 | ripple normal strength |

**Bed**

| setting | default | |
|---|---|---|
| `bedDetail` | 1.00 | cobble relief |
| `bedVary` | 1.00 | macro patchiness |
| `caustics` | 1.00 | light net on the bed |

---

## 10. Still open

1. **`gridIter` is now dead.** It sized the Poisson solve, which no longer
   exists. Remove it or repurpose it for the substep cap.
2. **Mass is not rigorously conserved.** The free surface has a weak relaxation
   back to still water to stop numerical drift accumulating over a long
   session. It works, but it is a fudge, and it will slowly flatten a genuine
   long-lived feature.
3. **Boundaries are not reflection-free.** Inflow is Manning normal velocity,
   outflow is a copy. A wave reaching either end may bounce rather than leave.
   Not observed yet, but the free surface is new and it is the obvious place
   for it to show.
4. **`gridFollow` transients.** Wading downstream is smooth; wading hard
   upstream pushes a settling transient down behind you.
5. **The analytic model has drifted further from the grid.** They were close
   when both were essentially kinematic. Now one has a free surface and one
   does not. `waterModel` 0 is still useful as a cheap fallback but no longer
   looks like the same river.
6. **None of the shader work has been verified on hardware by the author of
   it.** There is no GPU in the environment these changes were written in. Every
   shader-side claim in this document is reasoned or tested in a headless
   reimplementation, not observed. Treat the settings as the safety net: each
   one goes to zero, and zero is the previous behaviour.
7. **The specks were meant to become optional.** The goal of the streaking,
   boils and flow-map work was a surface legible enough to read the current
   without particles. Not yet confirmed in the headset.

---

## 11. Blocks for HANDOFF.md

### Section 5, bugs that shipped — append

```
15. **The flow solver had no free surface.** The depth field was written once
    when the bed was built and never updated; step 4 was a rigid-lid pressure
    projection. Obstacles barely deflected anything, no pillow or standing wave
    was possible, and two settings built to display the free surface were
    reading zeros. See `WATER.md` §2.

16. **The flow texture clipped velocity at 3 m/s** while the solver clamped at
    8. CPU specks read the arrays and were fine; GPU specks, the surface and
    the bed read the texture and fell behind as soon as the current rose.

17. **The surface showed wave speed instead of water speed** — physically
    correct, and exactly wrong for a game whose whole subject is where a
    drifting fly goes.

18. **The riverbed had no texture**, and once it had four, all four shared one
    normal map and so read as a single material.
```

### Section 6, open problems — append

```
10. Water: mass conservation, boundary reflection, and a dead `gridIter`
    setting. See `WATER.md` §10.
```
