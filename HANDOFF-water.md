# Replacement for HANDOFF.md § 2.4

Paste this over the existing "2.4 Water" section.

---

### 2.4 Water

**One shallow-water grid solve is the source of truth.** ~178x33 cells at 0.45 m
over the fishable reach, stepped at 20 Hz. Per step: gravity down the *water
surface slope*; Manning bed friction applied implicitly (`u /= 1 + fr dt`),
because explicit friction flips sign and explodes in thin water; semi-Lagrangian
advection; then an explicit free surface — continuity raises the depth where
flux converges, and the resulting surface gradient pushes back. That feedback
loop is what produces the pillow in front of a rock, the drawdown over a lip
and the standing wave below it. CFL-substepped on the gravity wave speed, up to
six substeps, so it stays stable when the grade is turned up.

Obstacles are **bed elevation**, which is why flow goes round them rather than
being told to. Cells shallower than 5 cm are solid.

Everything else reads that one field. The line and the CPU specks index `gu[]`
and `gh[]` directly; the GPU specks, the water surface and the bed read it
through two byte textures uploaded once per solver step.

**Traps that have bitten, in order of how long they went unnoticed:**

- The texture upload was gated on `guard > 1` after a `while(... guard++ < 3)`
  loop. One solver step leaves `guard` at 1, and at 72 Hz against a 20 Hz solver
  the loop runs *exactly once* whenever it runs at all. So the flow texture was
  uploaded once at startup and then never again: the GPU specks, the water
  colour, the foam and the surface relief were all showing the field as it
  stood after the settling loop, frozen, while the line and the CPU specks used
  the live arrays. Every "the GPU specks don't keep up when I raise the flow"
  report traces to this. **If the water ever stops responding to a setting,
  check that `gridTexUpdate()` is still being reached before anything else.**
- Velocity is packed with a **signed square-root** map over the solver's full
  ±8 m/s. It used to be linear over ±3, so every cell faster than 3 m/s
  saturated. The sqrt map keeps 0.023 m/s of resolution at a quarter of a metre
  per second while still representing 8.
- `uGMin` / `uGSize` must be refreshed **every frame** on every material that
  samples the flow texture. The window slides when it follows the angler and
  its span is a setting. Set once at construction, the specks sample one part
  of the river while you stand in another.
- The Poisson right-hand side needs `dx` **squared** (this was the old rigid-lid
  projection; kept here because the same mistake is easy to make in the
  continuity pass).
- Obstacle heights must approach the surface. Rocks half a metre under get
  flowed straight over and produce no wake at all.

**Specks.** Two paths, toggled by `speckGPU`, and they now agree by
construction because they integrate the same field with the same timestep.

- CPU: 4000 real particles advected in JS, half of them per frame.
- GPU: 12544 specks living in a 112x112 float texture, advanced by one
  fullscreen RK2 pass per frame at the real frame `dt`, drawn as three points
  each (a head plus two ghosts that back-integrate from where the head actually
  is). Requires `EXT_color_buffer_float`; `gsOK` is false without it and the
  HUD falls back to CPU.

  The previous GPU path was *stateless* — each vertex re-integrated a fixed
  seed forward for up to `travel` seconds using 24 forward-Euler steps. Euler
  samples velocity at the start of each step, and at seven seconds of travel a
  step is 0.29 s, which is 0.58 m at two metres a second — wider than a grid
  cell. In accelerating water every step moved the speck at the velocity it had
  already left, and raising the current raised the step length and the velocity
  gradient together. Stateless also meant a speck could never sit in an eddy and
  go round, and `speckSpread` did nothing at all on that path.

  The offscreen pass **must** disable `renderer.xr.enabled` around itself, or
  Three substitutes the stereo array camera and advects the field twice per
  frame in the headset and once on the phone. Restore XR *before* restoring the
  previous render target, and restore the previous target rather than `null` —
  in XR that target is the eye buffer.

**The analytic field (`waterModel 0`, and the fallback outside the solved
window)** is Manning's normal velocity from the same slope, the same roughness
and the same current multiplier the solver uses. It used to be discharge over
depth with a hard 2.2 m/s ceiling, which made thin water fast and deep water
slow — the opposite of the solver — and refused to exceed 2.2 however far you
pushed anything. The slope is read over a **five-metre** baseline: Manning's is
a statement about uniform flow, and measured tightly a drop lip reads as a 20%
grade and returns eight metres a second.

`computeFlow()` **blends** the two across two metres at the window edge rather
than switching. A pool the solver has backed up runs at half the speed the
analytic reach thinks it should, so switching put a hard step in the current
exactly where the window ends — invisible at the default 80 m span and glaring
the moment you shrink the span.

**`filmY()` returns the solved free surface**, not the still-water line. The
film the line rides on, the height the specks are drawn at and the surface fish
rise through are all the same water the mesh draws. `surfWave 0` restores the
old flat behaviour everywhere at once.

**What a speck looks like.** Not a fleck of foam. Froude number,
`sp/sqrt(g*d)`, chooses the shape: a bar drawn ACROSS the current where the
water is fast and shallow (a standing crest, which is what a riffle is), a thin
line ALONG it where it is slow and deep (a slick). Size follows Froude too, not
raw speed — fast water over two metres of pool is a slick, the same speed over
eight inches of cobble is a riffle, and only one of those should stand up. On
the GPU path the head plus its two ghosts form a short wave train whose spacing
is however far the water carried the speck in `speckTrail` seconds, so the
spacing reads as speed on its own.

Both paths share `GLSL_RIFFLE` and `GLSL_RIFFLE_FRAG`; the CPU path carries
flow direction and Froude per particle in an `aFlow` attribute so that toggling
the model does not change the look. Screen-space flow direction is recovered
per-eye from `projectionMatrix[1][1]/projectionMatrix[0][0]` rather than a
resolution uniform, which XR would get wrong. Measured spread at defaults: 12%
of specks fully slick, 24% fully crest, the rest in the transition band — if a
future change makes everything one shape, that ratio is what to check.

**The surface pattern must travel at `tsp` metres per second, and the offset
has to be applied in metres BEFORE the UV scale.** It used to read
`sAlong*0.42/st - tsp*ph*1.5`: the coordinate was scaled by `0.42/st` and the
offset by a flat `1.5`, so the pattern moved at `1.96*st` times the water speed
— and `st` grows with speed, so the error grew with the current, and the two
noise scales travelled at different speeds from each other as well. Subtract
the distance travelled from the world coordinate and let one scale apply to
both. This is why the surface and the specks disagreed even after the specks
were correct.

**Depth-averaged 2D, deliberately.** For nymphing, the right addition is a
log-law vertical profile plus a vertical velocity from the depth gradient —
near-zero at the bed, ~1.2x mean at the surface, lifting over a rising bed and
plunging behind a lip. That gives the slow bottom seam and the plunge-pool
recirculation a nymph actually rides. A true 3D solve buys detail you would
never see through the surface at roughly twenty times the cost.

**Colour.** The control is the colour itself, and the physics is derived from
it. You pick what deep water should be (`watHue` / `watSat` / `watLight`); the
absorption spectrum is that colour's complement, floored so no channel is
perfectly transparent and renormalised to a constant mean so `clarity` keeps
meaning the same thing in metres wherever the hue goes. That is not a fudge —
deep ocean is blue *because* water absorbs red, and a peat burn is amber
because it absorbs blue. Appearance and physics cannot drift apart when one is
computed from the other.

This replaced a single `tint` axis that lerped two hand-picked palettes AND two
absorption spectra at once. Sweeping it walked diagonally through a colour
space and produced hues nobody chose — cyan, then green, then red — and there
was no route to a dark blue, a brown, or black.

`sediment` scatters light back out instead of absorbing it, so unlike
everything else it makes deep water *brighter*: the difference between a
channel that goes dark and one that goes pale and milky. `waterOpaque`
multiplies opacity without touching colour.

Extinction is applied **per channel** (`vec3 T=exp(-uExt*d)`). A single scalar
can only darken water as it deepens; three rotate its hue, which is why a river
reads gravel-brown at your boots and green at your knees. Opacity is on the
same law: it used to be `0.20+d*0.36`, linear with a floor that made a
millimetre of water a fifth opaque and put a hard edge along every waterline.

`WATER_LOOKS` holds seven named settings behind the `!waterlook` action row.
Regression check: `meanExt x clarity` must come out **identical for every look**
(2.16 at present). If it doesn't, the renormalisation has been broken and
Clarity has stopped being absolute.

**Surface pattern advection.** Two things had to be fixed and they are
independent.

1. The offset must be applied **in metres before the UV scale**, or the pattern
   does not travel at the speed you asked for. `sAlong*0.42/st - tsp*ph*1.5`
   scaled the coordinate by `0.42/st` and the offset by a flat `1.5`, so the
   pattern moved at `1.96*st` times the water speed — and `st` grows with
   speed, so the error grew with the current.
2. The crossfade rate must come from **each scale's own wavelength**. A flat
   0.55 Hz for both put the two half-offset copies `tsp*0.909` metres apart:
   about a quarter of a wavelength for the coarse scale, tolerable, and *more
   than a full wavelength* for the fine one — total decorrelation. The fine
   layer, which is the one carrying the detail you read the current off, was
   blurred to mush at any real speed while the coarse layer moved correctly.

(1) is fixed by subtracting the distance travelled from the world coordinate
before the UV scale. (2) is fixed with **two constants, one per scale**
(`cycA 1.60`, `cycB 5.50`) rather than the old flat 0.55 for both. Because the
streak stretch grows the wavelength with speed, one constant per scale holds
the separation-to-wavelength ratio roughly steady across the speed range.

**The rate must be a compile-time constant, not derived from the local speed.**
Deriving it per pixel is tempting — it makes the separation exactly constant —
and it is wrong: `fract(uTime*rate)` diverges between neighbouring pixels, so
after a minute two pixels a hand's width apart with a 1% speed difference are a
whole cycle out of step. The pattern stops being a continuous field being
carried along and becomes noise that differs per pixel. This has been tried and
reverted once; don't try it again.

**Speck budget.** 25600 specks, three vertices each. There is no fixed ceiling
— it is `GS_W`, and raising it costs one more row and column of the update pass
plus three more points. What made the last doubling free was removing waste
from the draw, not spending more: `fieldAt()` returns velocity *and* depth from
one texel instead of `flowAt()` and `depthHere()` fetching the same texel
twice, and trail vertices take one RK2 back-step instead of four. Vertex
texture fetches went 326k at 12544 specks to 333k at 25600. **If the budget is
raised again, that is the number to check** — fill rate becomes the next limit,
not fetches, and `speckSize` drives fill quadratically.

The CPU path's 4000 is a real ceiling: each particle costs a `computeFlow()`
call in JavaScript.

**Speck colour** is `uSpeckC` / `uSpeckB`, shared by both speck materials and
set from `speckHue`/`speckSat`/`speckBright` in `updateWaterColour()`. The tint
multiplies the cool-white slick / warm-white crest base rather than replacing
it, so saturation 0 is exactly the old look.

**Cost.** `surfY` costs six smoothsteps and depends only on `x`; it is cached
per column in `gsurf`, rebuilt with `gslope` whenever the window moves. It was
previously being called per cell per substep inside the free-surface loop —
about a quarter of a million smoothsteps a solver step for a column of eighty
numbers, and removing it cut the step to roughly a fifth. The texture pack is
written longhand rather than as chains of `Math` calls, which cut it by more
than ten times; that matters now that it actually runs. The HUD's solver
milliseconds includes the upload.
