# Flycast — design and physics handoff

A dry-fly fishing simulator running as a single-file WebXR page, targeting a Meta Quest 2
through the headset's browser. No engine, no build step: `index.html` is the whole program.

This document exists so a new conversation can pick the project up without the history.
Read it alongside `index.html`.

---

## 1. What it is

- One HTML file, ES module, Three.js from a CDN import map.
- Hosted on GitHub Pages (WebXR requires HTTPS). Open the URL in the Quest Browser, press
  **Enter VR**.
- Right hand holds the rod. Left hand handles line, or the net.
- Everything tunable lives in an in-VR settings panel; settings can be copied to the
  clipboard and to the page URL hash, and restoring that URL restores the configuration.

### Deployment
Repo → `index.html` at root → Settings → Pages → deploy from `main`, root folder.
Updating is: edit the file in GitHub's web editor, commit, hard-refresh in the headset.

---

## 2. Physics model

### 2.1 The line is one continuous chain

The single most important structural decision. There is **one** line, 34 m of it, running
spool → slack belly → cork → stripping guide → nine snakes → tiptop → out to the fly.

Node `i` permanently owns the piece of line at arc length `sArc(i)` from the fly. Nothing
is ever created or destroyed. What moves are two **material boundaries** that slide along
fixed material:

- `lineOut` — arc length from fly to tiptop
- `offSpool` — arc length from fly to the spool lip

Slack belly = `offSpool - lineOut - rodArc`. Nodes past `offSpool` are parked on the reel.

**Two-zone discretisation.** The leader uses `leadNode` spacing (default 0.06 m), the fly
line uses `nodeLen` (default 0.20 m), because the leader is ~50x lighter and turns over far
more sharply. `sArc(i)` and its inverse `idxAt(s)` are piecewise linear across the boundary.

Because node mass and drag area both scale with spacing, **drag-per-mass is independent of
node length** — changing resolution changes smoothness, not behaviour. That property is
worth preserving in any future edit.

### 2.2 Line flow is decided by tension against friction

No force is ever injected to make line move. Each substep:

1. Constraint impulses are accumulated at three probe segments — just outside the tiptop,
   just below the stripping guide, just inside the spool.
2. Tension = accumulated Lagrange multiplier / h². **Not** the pre-solve gap. That was a
   real bug: the gap under-reads true tension by ~30x because the solver has already
   removed most of it, which made the line feel welded to the rod tip.
3. Line slides out through the guides when `T_out > T_in · e^(μθ) + statFric`, and slides
   **in** when the inequality reverses. Stripping with the left hand is the same mechanism
   running backwards — one rule, both directions.
4. θ is the total wrap angle across the guide stack, so a deeply loaded rod grips harder.
   This is the capstan equation and it is why shooting is harder when the rod is bent.
5. You can only shoot the belly you have. Once slack hits `MIN_SLACK`, further line must
   come off the spool on the spool's own terms.

### 2.3 Line off the reel

Payout is an inextensibility statement, not a force. If the straight distance from spool to
your gripped point exceeds the material length between them, and tension beats drag, exactly
that surplus leaves the spool — **1:1 with hand travel**, past a distance deadband.
Stripping in slackens that span so it cannot trigger. A haptic tick fires every 8 cm.

Earlier versions accumulated the surplus across substeps, which double-counted and made the
deadband meaningless. Don't reintroduce that.

### 2.4 Water

- Depth-averaged **2D** flow. This is the shallow-water simplification and it is the correct
  one for dry-fly fishing; 3D would buy plunge-pool recirculation you would never see.
- Speed follows continuity: `discharge / depth`, so thin water is fast water.
- Surface elevation `surfY(x)` is a pool-drop profile: a base grade plus six discrete drops.
  Flow accelerates over each lip via a surface-slope term. The GLSL twin of `surfY` is
  **generated from the same JS array**, so the mesh and the physics cannot drift apart.
- Obstacles (three rocks, one sunk log) deflect flow around their shoulders and **genuinely
  reverse it** in the lee. Plus up to 16 shed vortices that advect downstream and decay.
- Drag on the line acts on velocity **relative to the water**, not toward world zero. That
  distinction matters: damping toward zero parks the line at ~34% of the true current.
- Surface film: a positional clamp the line cannot cross, plus adhesion below a break
  velocity, ramped in by contact depth so touchdown doesn't deflect the line sideways.

### 2.5 The rod — and the honest problem with it

Twelve nodes. Butt two are driven kinematically by the controller. Mass distributed
proportional to diameter (thin-wall tube), so it is butt-heavy like a real blank.

**Two selectable models**, `rodModel`:

- **0, legacy.** An empirical PBD bend stiffness curve with a `stiffMul` scalar. This is
  what the project used for most of its life.
- **1, XPBD.** Compliance derived from real geometry, nothing tuned:

  Three points spaced `L` with curvature `κ` have sagitta `C = κL²/2`, so bending energy is
  `½·EI·κ²·L = 2·EI·C²/L³`. XPBD's energy is `½·C²/α`. Therefore

  ```
  α = L³ / (4·EI)
  ```

  `I` comes from the blank's real taper (9.5 mm → 1.6 mm OD, 0.55 mm wall) and `E` is a
  setting in GPa.

**The unresolved tension.** Static stiffness and natural frequency cannot both be matched:

| | frequency | load for L/3 tip deflection |
|---|---|---|
| XPBD, E = 200 GPa | ~2.4 Hz | ~1.6 N (matches a real rod) |
| Legacy, stiffMul 0.85 | ~3.5 Hz | much stiffer than real |

A real rod is believed to be ~1.5–2 N for L/3, and the analytic uniform-beam estimate with
butt stiffness throughout gives 2.47 Hz — an upper bound, since a real rod is far softer
over most of its length. So the **physically derived rod is around 2–2.5 Hz**, and the rod
the user liked was ~3.5 Hz, i.e. stiffer than physics predicts. This is unresolved and is
the most interesting open question in the project. Likely suspects: 12 nodes is too coarse
for a 500:1 stiffness taper; effective modal mass may be too high; the wall-thickness
assumption is a guess.

Rod damping targets the **deformation** velocity — each node against the velocity it would
have if the rod were rigid with the hand, with ω recovered from the two driven nodes as
`(r × Δv)/|r|²`. Damping toward world zero drags the rod backwards and folds it at the first
free node. That bug shipped once; the symptom was "limp noodle folded at the end of the cork".

### 2.6 Line bending

Same XPBD form, `EI` from nylon at 3 GPa (leader) and PVC at 20 MPa (fly line), `I = πd⁴/64`.
At these diameters the physical value is nearly nothing at 20 cm spacing, so the multiplier
exists to push past reality. Separately, `lineSmooth` is a **numerical viscosity** along the
chain — explicitly not a physical force, present only to kill discretisation jitter.

### 2.7 Fish

Four rainbow trout, procedurally generated: swept-ellipse body with clean UVs, a canvas
texture with olive back, silver flanks, the pink lateral stripe and depth-graded spots, plus
forked caudal, dorsal, adipose, anal and pectoral fins. A travelling sine wave runs down each
body via a per-fish vertex shader, with the tail riding the same wave.

**Fighting a hooked fish.** Pull scales with length: roughly `12·len·power` newtons steady,
with a run multiplying that by 2.6 and a jump by 3.2. A 40 cm rainbow therefore pulls ~5 N
steady and ~12 N in a first run, against a 21 N 5X tippet — so a green fish can break you off
and can out-pull the reel. **The reel is stronger than the fish.** It gathers line at full rate until tension reaches
`reelPower` (default 60 N, well above a 21 N tippet), and while you are cranking the spool
cannot pay line back out. So holding the trigger against a running fish shortens the line
until something gives — normally the tippet. Setting `reelPower` below tippet strength makes
the reel stall first and saves the line instead. Five behaviours cycle on a timer weighted
by stamina: **run, sound, jump, cruise, easy**. Stamina drains from both tension and the fish's
own effort, so a fish that fights hard tires fast. **A hooked fish is its own rigid body, not a heavy node on the line.** Hanging 0.7 kg off a
1.5 microgram tippet node is a 60,000:1 mass ratio, and Gauss-Seidel cannot transmit force
across that — the line could neither drag the fish in nor build tension to break. So while
hooked, `invM[0] = 0` and the fly node is pinned to the fish each substep; the line tension
measured at the rod tip is fed back to the fish as a real force along the line. The fish
integrates its own swim force, water drag and gravity, and is free to leave the water. A **Hook a test fish** action in
the menu puts one on immediately for testing.

Behaviour when not hooked: fish hold facing **upstream** (nose is local −X, flow runs toward +X, so heading
zero). They cycle in and out of feeding; feeding fish sit higher and nose the film with real
rise rings. The take is evaluated **continuously as the fly drifts through** the take radius,
once per pass — not by where the fly lands. Landing only decides whether you spook them
(splash, or line dropped within the lining radius). Non-feeders' take chance is multiplied
down. Fights: tension against tippet; the net lands anything inside the hoop.

---

## 3. Calibration table — every number and where it came from

| Quantity | Value | Source |
|---|---|---|
| Fly line density | 0.99 g/m at 5wt | AFFTA: 140 grains over the first 30 ft |
| Line diameter | ~1.02 mm at 5wt | typical published spec |
| Leader | 0.021 g/m tippet → 0.255 g/m butt | nylon at 1140 kg/m³, 0.152 → 0.533 mm |
| Tippet strength | 21 N | 5X = 4.75 lb |
| Fly mass | 20 mg | size 14 dry |
| Rod mass | 77 g | blank of a 9 ft 5wt |
| Rod taper | 9.5 → 1.6 mm OD, 0.55 mm wall | typical blank; wall is an assumption |
| Guide spacing | stripper 27" from butt, first snake 4" below tip, 10 guides + tiptop | Dale Clemens progression |
| Air drag | Cd 1.1, ρ 1.2 | cylinder in crossflow |
| Guide friction μ | 0.15 | fly line on chrome snakes |
| Legacy rod stiffness | 0.85 | the value the user liked; ~3.5 Hz |
| Classic line mass | 6.17x real | measured back out of that same build |

**Solver:** 6 substeps × 6 iterations at 72 Hz. PBD stiffness is iteration- and
timestep-dependent, so **any calibration must be redone if those change.** XPBD is not.

---

## 4. Controls

| Input | Action |
|---|---|
| Left stick | walk, including wading; deep water slows you |
| Left trigger | under 15% free · 15–85% routes line through the hand · over 85% pinches |
| Left grip | net |
| Right trigger | reel in, analog · **drives the menu pointer while the menu is open** |
| Right grip | clamp line at the cork |
| A | reset cast · B | reseat fish · Y | toggle menu |

Menu: point with the rod hand, hold the trigger to drag a slider. The panel is movable —
grab the handle at its top left and it follows the ray; the +/- buttons at top right resize it.
If the ray is not on the panel the right trigger still reels, so you can fish with the menu open. The left hand keeps full
line control while the menu is open, deliberately, so changes can be felt live. Each row has
a range button cycling **0.01x / 0.1x / 1x / 10x / 100x**, so no setting is ever out of reach in
either direction. Below 1x the range zooms in around the value at the moment you pressed it,
and that window is frozen so the slider does not slide out from under you mid-drag.

---

## 5. Bugs that shipped, and their root causes

Recorded because each one was mis-diagnosed at least once.

1. **Line stuck in mid-air** — stowed nodes kept rendering at their last deployed position.
   Stale geometry, not physics.
2. **Line wouldn't shoot** — tension read from the post-solve residual instead of the
   accumulated constraint impulse. Under-read by ~30x.
3. **Line drifted at a third of current speed** — drag damped toward world zero while a
   separate term pulled toward the flow. The two fought.
4. **Specks vanished** — seeded at the world edge, so they took five minutes to arrive and
   one minute to leave. Now seeded relative to the player.
5. **Specks piled up on the far bank** — obstacle interiors scale flow to 4%, making them
   absorbing sinks. Lifetime now drains 9x faster in slack water.
6. **Rod and fish disappeared on hookup** — 500:1 mass ratio on the fly node diverged the
   solver into NaN. Capped, plus a non-finite guard.
7. **Rod folded at the cork** — damping reference velocity was identically zero.
8. **Nothing loaded at all** — a variable read every frame but never declared. `node --check`
   passes such files happily.

**Therefore: run `smoke.mjs` before shipping.** It stubs Three.js and the DOM, executes the
module, and ticks the animation loop. Syntax checking does not catch a ReferenceError in the
render loop, and that has broken a build.

---

## 6. Open problems

1. **Rod frequency vs static stiffness.** See 2.5. The most substantive unknown.
2. **Line inside the guides has real mass now** (guide constraints are two-way and load the
   blank), but the guide positions come from interpolating rod nodes — jitter is possible
   when a line node sits exactly on a guide.
3. **Re-discretising mid-cast pops.** Acceptable for a tuning knob, not for gameplay.
4. **The slack belly is simulated but cannot tangle** on boots, rocks or the reel.
5. **No haul mechanic.** Single and double hauls are the obvious next casting feature.
6. **One reach of river, four fish, one fly pattern.** No fly selection, no hatch, no
   fish memory of being pricked.
7. **Performance.** ~116 active nodes at default spacing, ~265 at both minimums. Specks cost
   a flow evaluation each and are the dominant cost at high density.

---

## 7. If this moves off WebXR

Meta's Horizon Store accepts immersive WebXR PWAs, packaged with Bubblewrap into an Android
App Bundle, with in-app payments via the Digital Goods API. So the current file is already
the shippable artifact — no port required unless the solver outgrows the browser. Keep the
signing keystore; every update must use the same certificate.

If a port becomes necessary, Godot is the recommendation over Unity: MIT licensed with no
revenue threshold, and Meta has been funding its OpenXR support since 2024.
