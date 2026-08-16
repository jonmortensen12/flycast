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

**Colour.** The controls are the RGB channels of deep water (`watR`/`watG`/
`watB`) and the physics is derived from them. The absorption spectrum is that
colour's complement, floored so no channel is perfectly transparent and
renormalised to a constant mean so `clarity` keeps meaning the same thing in
metres wherever the colour goes. That is not a fudge — deep ocean is blue
*because* water absorbs red, and a peat burn is amber because it absorbs blue.
Appearance and physics cannot drift apart when one is computed from the other.

Shallow water, the aeration tint and the sediment tint are all the same colour
lifted toward white by different amounts (0.42, 0.72, 0.58), not independent
colours. Thin water carries less of everything including its own colour, and
deriving them means they cannot end up fighting each other.

This went through an HSV version first, which was worse: hue/saturation/
lightness cannot reach an arbitrary colour without the user reasoning about a
colour space, and there was no obvious route to "dark blue" or "black". Before
that it was a single `tint` axis lerping two hand-picked palettes AND two
spectra at once, which swept diagonally through colour space and produced hues
nobody chose.

**A renamed setting once left a dead uniform behind and cost a whole round of
debugging.** `waterSat` became `watSat`, but a `uSat:{value:P.waterSat}` line
survived; the key no longer existed, so it uploaded `undefined` as 0 and forced
the water to full greyscale every frame. Hue and saturation were computed
correctly and flattened one line later. **When renaming anything in `P`, grep
for the old key across the whole file, uniforms included.**

**Foam** has its own RGB (`foamR`/`foamG`/`foamB`), a brightness and a stain.
`foamBright` scales the *coverage* rather than the colour, so at 0 the foam
pattern still roughens the surface and still drives opacity — the water goes
flat and opaque where it churns without being painted white. `foamDirt` mixes
the foam toward a lifted version of the water colour, so a tannic river gets
tea-coloured foam automatically instead of needing to be set twice.

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

**If the river goes invisible and every water setting goes dead at once, that
is a shader compile failure, not a logic bug.** A GLSL program that fails to
link means the mesh is simply not drawn — you see the bed through where the
water should be, which reads as perfect clarity, and nothing responds to any
slider because there is nothing being shaded. Check the browser console for the
GLSL error before touching any JS. `node glslcheck.mjs` catches the two that
have shipped: a duplicate declaration in one scope (`float fr` twice), and a
**backtick inside a GLSL comment** — shaders live in JS template literals, so a
backtick in prose ends the string and truncates the shader mid-function. Both
are invisible in a diff and neither is a JS error, so the smoke harness passes
straight through them.

**Ripples from specks** (`ripple`) is the surface detail that is actually
caused by the river. The specks are drawn a second time, top down, into a
512x512 half-float world-space map that follows the angler; each splats the
GRADIENT of a Gabor wavelet — a gaussian envelope times a wave, which is what a
small ripple is: a crest with a trough either side, not a bump — and the water
shader adds that map straight into its surface normal with one fetch.

Why gradient and not height: a height map would cost the water shader four taps
and a difference to recover the same thing. Why additive blending: overlapping
wavelets sum into a continuous field, which is the difference between water and
a scatter of discrete blobs. If the surface looks blobby, there are too few
specks for `rippleScale` — raise the budget or shrink the wavelet.

The map's blue channel carries **coverage** — how much wavelet is stacked on a
bit of water — which is a different question from the gradient in red and
green. The gradient says which way the surface is tilted and cancels where a
crest meets a trough; coverage never cancels, so it is the channel that can be
tinted (`ripR`/`ripG`/`ripB`) or made opaque (`ripOpacity`). Without a separate
coverage channel, "more visible ripples" could only ever mean "steeper ones".

At `ripOpacity` 0 a ripple is pure surface tilt — visible only because it
catches the sky at a different angle, which is how real water works and why
ripples can vanish under a flat grey sky. The tint is painted **after** the sky
reflection (a deliberately tinted ripple should not then be half-replaced by
sky) and **before** the foam (foam is a physical thing floating on top).
`ripStain` bleeds the water colour in on the same rule as `foamDirt`.

The map is snapped to whole texels as it follows you, or walking upstream
shimmers it. Its state pass runs whenever the map is wanted even if the specks
are invisible — that is the whole point of being able to set Speck brightness
to zero and still read the water — and `ripStep` opens the draw range to every
speck, so the visible draw range must be set *after* it in the frame loop.

This replaced the approach of trying to make a scrolled noise texture imitate
the flow. That could be given the right direction and speed but its *shapes*
were whatever the noise contained; they were not caused by the river, so they
never belonged to it, and no amount of tuning was going to fix that because the
information was not in the texture.

**Standing waves** (`standWave`) are the one surface cue a scrolled normal map
cannot produce. Everything else on the surface is a texture dragged downstream,
so its *shapes* are whatever the noise contains — it can follow direction and
speed but can never form the shape the specks draw, because nothing in a
scrolled texture knows about Froude number. That is the structural reason the
surface could not stand in for the specks, and no combination of the existing
settings was going to fix it.

The defining property is that a standing wave does not move: the crest sits
over the bit of bed that makes it while water pours through. **The phase is a
function of world position only, with no time term at all** — that is the whole
trick, and adding any time term destroys it. Wavelength comes from
`L = 2*pi*u^2/g`, clamped to 0.28–2.40 m (the raw relation gives 7 m at Fr 1.5
and 20 m at Fr 2.5, which across a 14 m channel is a slow tilt, not texture).
Amplitude is a band around Fr 1, the same band the speck fragment shader uses
for crestness, so the two cues agree by construction. A second harmonic sharpens
the crest and flattens the trough; without it the train reads as corrugation.

**Speck budget.** `speckBudget` is the side of the square state texture, so the
count is its square: **80 -> 6400 (the shipped default)**, 160 -> 25600,
256 -> 65536, 512 -> 262144. `gSpeckResize()`
reallocates the render targets and rebuilds the point geometry together — they
are both sized from `GS_W` and must never disagree. Two rules it enforces and
that any rewrite must keep: **dispose the old render targets** (otherwise every
change leaks a pair of float targets until the context dies), and **guard on an
actual change of `GS_W`**, because it is reached from `afterSettingsChange()`,
which fires on every slider tick — reallocating 60 times as a thumb slides is
how you destroy the frame rate the setting exists to protect — so
`onSettingChanged` only sets `gsResizeWanted` and the frame loop applies it once
the trigger is released.

Attribute types carry the count: `position` is never read (the vertex shader
derives world position from the state texture) but three needs it to know the
vertex count, so it is `Int8Array`; `aRef` is 16-bit normalised, exact to a
texel centre up to 2048. That is 9 bytes a vertex against 36 for float32, which
is most of what makes a million specks affordable.

**A test can pass against the wrong entry point.** The budget resize was
verified through `afterSettingsChange()` and passed, while the slider path —
`onSettingChanged()` — had no case for it at all. When a control has two ways
in, test the one the user's thumb actually touches. What made the last doubling free was removing waste
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

**The shipped defaults are a tuned look, not neutral starting values**, taken
from a share link. Several are deliberately far from where a fresh reading of
this document would put them, so don't "correct" them:

- `waterOpaque 0` and `watR/G/B` all 0 — the water column contributes no colour
  or opacity of its own. What you see is sky reflection, foam, ripples and the
  bed. `clarity 1.0` still shapes the falloff.
- `waterDetail 0` — the scrolled noise is off entirely. All surface shape comes
  from `ripple 0.95` (speck-splatted wavelets) and `standWave 1.15`.
- `ripR/G/B` all 0 with `ripOpacity 0.26` and `ripStain 1.0` — ripples are
  painted dark and fully stained toward the water colour.
- `specks 0.16` with `speckBright 2.0` and `speckBudget 80` (6400 specks): few
  visible specks, bright, but a field dense enough to feed the ripple map. That
  combination is the point of the split between the state pass and the visible
  draw — the map wants every speck, the eye wants a handful.

  **The budget was 560 (313600 specks) and that was a phone number, not a
  headset number.** It was tuned by looking at the picture on a flat screen,
  where an over-budget speck field costs you nothing you can see. On a Quest it
  costs 72 fps, and a standalone headset that misses frame rate does not show
  you a slower picture — the compositor reprojects, and it reads as **jittery
  head tracking**. That failure mode is invisible everywhere except in the
  headset, which is the whole reason the number drifted four times too high.
  Check GPU budgets on the device they are for.
- `skyGlint 2.9`, `foam 0.15`, `streak 0.4`, `froth 0.4`, `surfWave 0.65`.

**Cost.** `surfY` costs six smoothsteps and depends only on `x`; it is cached
per column in `gsurf`, rebuilt with `gslope` whenever the window moves. It was
previously being called per cell per substep inside the free-surface loop —
about a quarter of a million smoothsteps a solver step for a column of eighty
numbers, and removing it cut the step to roughly a fifth. The texture pack is
written longhand rather than as chains of `Math` calls, which cut it by more
than ten times; that matters now that it actually runs. The HUD's solver
milliseconds includes the upload.
