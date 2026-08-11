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

**Depth-averaged 2D, deliberately.** For nymphing, the right addition is a
log-law vertical profile plus a vertical velocity from the depth gradient —
near-zero at the bed, ~1.2x mean at the surface, lifting over a rising bed and
plunging behind a lip. That gives the slow bottom seam and the plunge-pool
recirculation a nymph actually rides. A true 3D solve buys detail you would
never see through the surface at roughly twenty times the cost.

**Cost.** `surfY` costs six smoothsteps and depends only on `x`; it is cached
per column in `gsurf`, rebuilt with `gslope` whenever the window moves. It was
previously being called per cell per substep inside the free-surface loop —
about a quarter of a million smoothsteps a solver step for a column of eighty
numbers, and removing it cut the step to roughly a fifth. The texture pack is
written longhand rather than as chains of `Math` calls, which cut it by more
than ten times; that matters now that it actually runs. The HUD's solver
milliseconds includes the upload.
