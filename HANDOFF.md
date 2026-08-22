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
- `remote.html` is the second page in the repo: a phone joins the headset over a data
  channel and drives that same settings panel from outside. See section 4b.

### Deployment
Repo → `index.html` at root → Settings → Pages → deploy from `main`, root folder.
Updating is: edit the file in GitHub's web editor, commit, hard-refresh in the headset.
`remote.html` sits beside it and is found by URL, so it deploys with everything else.

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
6. You can only shoot the belly you have. Once slack hits `MIN_SLACK`, further line must
   come off the spool on the spool's own terms.

### 2.3 Line off the reel

Payout is an inextensibility statement, not a force. If the straight distance from spool to
your gripped point exceeds the material length between them, and tension beats drag, exactly
that surplus leaves the spool — **1:1 with hand travel**, past a distance deadband.
Stripping in slackens that span so it cannot trigger. A haptic tick fires every 8 cm.

Earlier versions accumulated the surplus across substeps, which double-counted and made the
deadband meaningless. Don't reintroduce that.

### 2.4 Water

- **Two speck renderers**, toggled by `speckGPU`. The CPU path advects real particles in JS
  and is capped at 4000. The GPU path is stateless: each vertex knows a seed and a phase, and
  the vertex shader re-integrates that seed through the same analytic flow field every frame,
  20000 of them for no CPU cost. The GLSL flow function is generated from the same JS obstacle
  list so the two cannot drift apart. If a grid solve ever replaces the analytic field, the
  shader samples a texture instead — cheaper, not harder.
**Two water models**, toggled by `waterModel`.

**Model 1 (default): a solved shallow-water grid.** ~178x33 cells at 0.45 m over the fishable
reach, stepped at 12 Hz, unconditionally stable (semi-Lagrangian advection). Per step:

1. Body force — gravity down the *water surface slope*, so riffles run fast because they are
   steep, not because they are thin.
2. Bed friction — Manning, `g n^2 |u| u / h^(4/3)`, applied **implicitly** (`u /= 1 + fr dt`).
   Explicit friction flips sign and explodes wherever `fr dt` approaches 1, i.e. in thin water.
3. Semi-Lagrangian advection.
4. Pressure projection enforcing `div(h u) = 0`, Gauss-Seidel, ~20 sweeps.

Depth comes from `surfY - bedY`, with obstacles added as **bed elevation** — that is why flow
goes round a rock rather than being told to. Cells shallower than 5 cm are solid.

Two traps, both of which bit during the build:
- The Poisson right-hand side needs `dx` **squared**. With one power of `dx` the projection
  over-corrects and the field explodes to 11 m/s of noise.
- Obstacle heights must actually approach the surface. The original rocks sat half a metre
  under; the solver correctly flowed straight over them and produced no wake at all.

Verified in `diag2.mjs`: parabolic cross-channel profile (0 at the banks, 1.6 m/s mid), thin
riffles at 1.7 m/s against deep pools at 0.7 m/s, zero velocity inside the rock, **negative
velocity in its lee** — real recirculation — and flow deflecting outward on both shoulders.

Cost is CPU, not GPU: about 3% of a desktop core at defaults, so budget several times that on
a Quest. The HUD shows solver milliseconds. `gridCell`, `gridIter` and `gridRate` all trade
directly against it.

**Model 0: the original analytic field.** Kept for comparison and as a fallback. Speed follows
`discharge / depth` so thin water is fast, obstacle wakes are hand-written, and eddies are
faked with shed point vortices.

The grid field also feeds the GPU specks and the water surface colour through a byte texture
(velocity encoded at +/-6 m/s), so what you see is what the line feels.
- Depth-averaged **2D** flow. 3D would buy plunge-pool recirculation you would never see.
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
own effort, so a fish that fights hard tires fast. **The line pulls the fish as an axial spring, not via a measured node tension.** Reading the
tension off the segment next to the fly does not work, and the harness proved why: with a
kinematic fly node and a 1.5 microgram tippet neighbour, all the stretch piles up at the fish
(7x at node 0, 1.01x at the tiptop) and the tip probe reads nothing. So the fish feels
`lineStretch x (distance - lineOut)` newtons toward the rod tip, with the equal and opposite
applied to the rod tip node so a run bends the blank. Mass-ratio independent.

**The drag must give line, or every run snaps the tippet.** When a hooked fish out-pulls the
drag setting, the spool releases exactly the length that relieves the excess. Without this the
tippet popped within a fifth of a second of any run. Blocked while reeling, which is what lets
the reel win — and lets you break yourself off by holding the trigger.

**`MIN_OUT` must relax during a fight.** The 4 m floor exists so stripping cannot strand you on
bare leader while casting, but it made a fish further out than 4 m literally unreelable. Floor
drops to 0.7 m while hooked.

**A hooked fish is its own rigid body, not a heavy node on the line.** Hanging 0.7 kg off a
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

### Sound

Everything is synthesised at runtime — one shared noise buffer, no assets. The context is
created on the **Enter VR** gesture, because browsers will not start audio without one.

- **River**: looping noise through a bandpass, level driven by the flow speed *where you are
  standing*, so a riffle is louder than a pool. Reads straight off `computeFlow`.
- **Line**: a second noise voice whose loudness and brightness both follow rod tip speed.
- **Reel**: a click per 5.5 cm of line off the spool, plus a ratchet while cranking.
- **Splash**: filtered noise burst with a downward sweep, size from impact speed. Fires on the
  fly landing, on a rise, and when a hooked fish breaks the surface.

Five levels in the menu: master, river, reel, line, splash.

### Line vs obstacles

Line nodes are pushed out of each obstacle cylinder — over the crown if they are near the top,
radially off the flank otherwise, with the inward velocity component removed. `obstHeight`
scales how far obstacles rise off the bed and therefore how hard the water is pushed around
them; it rebuilds the solver bed live.

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
| Left stick | move — teleport by default, sliding walk with **Teleport move** off. See *Moving* below |
| Left trigger | under 15% free · 15–85% **routes** (a PULLEY: the material point at your fingers is set by the straight run from the stripping guide, so the span is never over-taut and never blocks line feeding out) · 15-85% old behaviour was to pin one node, which was what stopped casting past the hand · over 85% **pinches** |
| ~~old~~ | under 15% free · 15–85% **routes** (line slides through the hand, held point re-chosen every frame) · over 85% **pinches** (one material point held fast) |
| Left grip | net |
| Right trigger | reel in, analog · **drives the menu pointer while the menu is open** |
| Right grip | clamp line at the cork |
| A | reset cast · B | reseat fish · Y | toggle menu |

Nobody should have to be told any of that. **PLAYER → Control labels** draws a ghost
of each controller over your hands with a callout on every button that does something
— see *The control guide* below.

### Moving: teleport or slide

**PLAYER → Teleport move.** 1 (the default) is the hop; 0 goes back to sliding the rig
around on the stick, unchanged from before teleport existed. It is a live toggle — nothing
is rebuilt — and it is reachable from the phone remote as well.

With it on, pushing the stick forward throws a real ballistic arc off the **left** hand
with a ring where it lands; let go and you blink to it. Green ring means you can stand
there, red means the water is over your chest or there is a boulder in the way. **Teleport
range** is the arc's launch speed, not a leash: aim past it and the arc simply falls short,
the way a thrown line does. A hard push left or right is a **Snap turn** instead, so a
sloppy diagonal picks a spot rather than spinning you. With it off, the stick is the walk
code and none of the above is drawn or armed.

**The tackle comes with you.** A hop is not travel — nothing accelerated, nothing was
thrown, the angler is simply somewhere else on the next frame. But the rod is in their
hands, and PBD reads velocity out of consecutive positions, so a rig that jumps eight
metres between frames hands the rod butt about 3500 m/s. `carryTackle()` shifts the rod,
the line and whatever is on the end of it by that same offset on that same frame, while
the screen is black. The configuration is preserved, so no constraint is violated and no
energy is created; the cost is one pass over ~120 nodes on a frame nobody sees. Two
corrections ride along with it, because the river is not flat: the free line also takes its
local change in **surface** height (the water can sit 28 cm higher eight metres upstream),
feathered to nothing over the last 1.2 m before the tiptop so the guided end stays welded
to a rod that did not move vertically at all; and every node is lifted clear of the new
**bed**, which moves further than the surface does. A played fish is carried too, and put
back in the channel if the reach has bent away under the hop rather than beached.

**A fish on takes the stick back.** While one is hooked the stick is the walk code
whatever Teleport move says, and the arc and the ring go away. Netting him means
closing the distance while watching what the line is doing, and a hop that puts you
somewhere a rod length away with the fish still coming is not that — you want to wade
in and be able to stop. Turning the toggle off is still how you fish a whole session
on the stick.

A **snap turn** was measured the same way and does not need any of this — 30° about the
head sweeps the tiptop far less than a hop moves it, and it costs ×1.17 stretch and 0.5 N,
inside what ordinary rod movement produces. Do not "fix" it on a hunch; measure it first.

Menu: point with the rod hand, hold the trigger to drag a slider. The panel is movable —
grab the handle at its top left and it follows the ray; the +/- buttons at top right resize it.
If the ray is not on the panel the right trigger still reels, so you can fish with the menu open. The left hand keeps full
line control while the menu is open, deliberately, so changes can be felt live. Each row has
a range button cycling **0.01x / 0.1x / 1x / 10x / 100x**, so no setting is ever out of reach in
either direction. Below 1x the range zooms in around the value at the moment you pressed it,
and that window is frozen so the slider does not slide out from under you mid-drag.

### The control guide

**PLAYER → Control labels**, shipped ON. A ghost of each controller drawn where the
real one is, with a callout on every button that does something. There is no tutorial
in this game and no button prompt anywhere else, and *"now squeeze the left trigger"*
is a sentence you should not have to say out loud while somebody is holding a fly rod.

Three things about it are deliberate:

- **The ghost is schematic**, not a model of a Quest controller. It shares space with
  the rod, the cork and the reel, and a shape that is plainly a diagram reads as an
  instruction rather than as a second object in the world. It is also the only version
  that stays correct if the hardware changes.
- **The labels billboard; their anchors do not.** The leader stays pinned to the part
  it names while the text is square-on from wherever you are looking. The leaders are
  thin cylinders, not GL lines — same reason the teleport arc is beads.
- **The words track the settings.** With teleport off the stick says WALK; with a fish
  on it says WADE. A label that lies is worse than no label, so `guideWords()` is read
  every frame and `guideDraw()` skips the canvas unless the text actually changed.

Turn it off and **Save as my default** if you would rather fish without them. It is on
the phone remote too, so you can switch it on for a guest and off for yourself without
taking the headset back.

---

## 4b. The phone remote

Somebody who has never held a fly rod has the headset on and both hands full. Whoever is
running the demo has a phone, cannot see what the angler sees, and does not want to talk
anyone through a menu they cannot reach. `remote.html` is that phone: **every row of
`MENU`, and none of the river.** No Three.js on it, no solver, nothing to render — it
draws sliders over numbers.

### Opening it
Two doors, same room. On the flat front page, **Phone remote** — which is where a
four-letter code is easiest to read off a big screen, before the headset is handed over.
In VR, **Phone remote** under PRESETS, and the code then shows along the top of the menu
panel and in its description strip. Either way the room outlives the overlay and survives
a venue swap, because venues no longer reload the page.

### Transport
PeerJS to introduce the two devices, then a WebRTC data channel over the local wifi —
the same arrangement family-smash uses for its phone controller, and the reason that
project's `controller.html` is worth reading next to this one. The broker sees a room id
of `flycast-XXXX` and nothing else. Both ends load the library from unpkg with jsdelivr
behind it; a demo that dies because one CDN blinked is still a demo that died.

### The rule that keeps it honest
**The phone is a view of `P`, never a second owner of it.** Everything it sends lands
through the same `P[key]` / `onSettingChanged(key)` pair the in-headset menu and the flat
preview panel already use, so a setting has exactly one place it is applied. And the panel
is built from the `MENU` and `TABS` the headset sends — labels, ranges, steps, help text
and grouping all still have one definition, in the game. **Add a row to `MENU` and it
appears on the phone with nothing to update.** That is the same rule the flat preview panel
was rewritten to follow after its hand-kept key list had drifted twice.

| Message | Direction | Purpose |
|---|---|---|
| `{t:'hello'}` | phone → headset | joined; send me everything |
| `{t:'set', k, v}` | phone → headset | one setting moved |
| `{t:'act', k}` | phone → headset | an action row, e.g. `!hookfish`, `!venue:pond` |
| `{t:'get'}` | phone → headset | resend the lot (the Resync button) |
| `{t:'part', id, i, n, s}` | headset → phone | one piece of a big message |
| `{t:'schema', menu, tabs, vals, venue}` | headset → phone | the whole panel, chunked |
| `{t:'vals', v}` | headset → phone | **only what changed** since the last push |
| `{t:'hud', …}` | headset → phone | the stats window, four times a second |

Three things in there are load-bearing:

- **The schema is chunked.** It is ~40 kB of labels and help text, and pushing it in one
  loop fills the channel's send buffer and drops the connection. It goes out in 7 kB
  pieces paced against `dataChannel.bufferedAmount`, and there is one reassembler at the
  other end. Family Beatdown learned this with an 888 kB roster; the number is smaller
  here and the failure is identical.
- **What comes back is a diff.** A settled game sends stats and nothing else. It also
  means a preset load, a venue swap or a slider dragged in VR reaches the phone without
  either end having to know it happened — which is why an action forces `REMOTE.last={}`
  and a full resend rather than trusting the next diff.
- **A value the phone just sent must not be echoed onto the slider under the thumb.**
  That echo is what makes a control fight the finger holding it. The headset writes its
  own `REMOTE.last[k]` when it applies a `set`, so the diff never contains it; the phone
  additionally goes deaf on a key for 700 ms after touching it, and for as long as it is
  held. The release that clears the hold is listened for on the slider, on the window in
  the capture phase, and on `visibilitychange` — a touch can end without the element it
  started on ever hearing, and a row left held stays deaf forever.

`runAction` is reachable from the phone, so it is checked: the key has to start with `!`
**and** be a row of `MENU`. The phone cannot invent an action.

### Stats
The person holding the phone cannot see the stats window, or anything else. So the same
numbers go to them: fps, whether a fish is on and what it is doing, tension against
tippet, line out, slack, drift, what the left hand is doing, and whatever `say()` last
put on screen. This is what makes remote tuning possible at all — otherwise you are
adjusting a river you cannot see.

### Testing it
`node remotecheck.mjs` runs `remote.html`'s script blocks against a small real DOM, feeds
it the **actual** `MENU` out of `index.html`, and drives the whole thing: tags balance, no
global shadows a window property, the schema reassembles, a slider for every setting, a
drag sends one value, the echo does not move it, a lost touch still releases it, an action
sends its action, search reaches rows in tabs that are shut. The headset half is covered
in `smoke.mjs` under *phone remote*, including that every non-action row of `MENU` names a
real setting and every row lives in a tab.

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

9. **Routing blocked line feeding past the hand** — pinning a material point made the belly
   taut, and that back-tension exceeded the guide-slip threshold. Fixed by treating the hand as
   a pulley rather than an anchor.
10. **Frozen the moment the left hand grabbed line** — a variable referenced in the stripping
   code that was never declared. Same class as (8): fine until that branch executes.
11. **Rod folded at the cork, again, but only in Boulder Garden and Alder Tunnel** — and this
   time the damping reference was fine. `pushOutObstacles()`/`pushOutCanopy()` ran over
   *every* active line node, including the ~17 threaded through the guides. Line inside the
   rod is captive in eleven rings; what a rock or a branch touches there is the blank, not
   the line, and the blank is not a colliding body. So the push-out modelled a contact that
   does not exist — and `solveGuide()` couples each guide to the line **both ways**, so a
   node shoved a branch-radius sideways dragged the rod node after it and buckled the blank
   at the first free joint. Measured with the rod inside an alder: a persistent 25° kink at
   the cork, 7° after `guidedNodes()` exempted the guided span. Free line outside the tiptop
   and the pool between the stripping guide and the reel still catch on everything — that is
   real, and in a brush creek it is most of the difficulty. Two venues, because they are the
   two with scenery at rod height in the water you stand in.
12. **Nothing recovered a bad rod except resetting it by hand** — `sanity()` watched the line
   and only the line, so `blewUp` (which triggers the automatic `resetCast`) could never fire
   on the blank. Everything that can diverge the line reaches the rod through the guides. It
   is eleven free nodes; they are checked now.
13. **A GPU budget four times too high, invisible outside the headset** — `speckBudget` shipped
   at 560, i.e. 313600 specks, tuned by eye on a flat screen. A standalone headset that misses
   72 fps does not render slower, it **reprojects**, and that reads as jittery head tracking,
   not as a soft picture. Now 80 (6400 specks). Check device budgets on the device.
14. **Every hop while playing a fish broke you off** — and the general case was worse than
   it looked. The rig jumping is a discontinuity, and the solver reads velocity out of
   consecutive positions, so the rod butt arrived at the far end of the hop at about
   3500 m/s and dragged the line after it through eleven guides. Measured with 7.4 m of
   line on the water and an 8 m hop: a segment stretched to **6.6x** its material length,
   line nodes hit **134 m/s** against `sanity()`'s 140 clamp, and **3.4 m of line was
   ripped back in through the guides**. With a fish on it was **108 N against a 21 N
   tippet** — not a near miss, a guaranteed break-off on every hop. Fixed by
   `carryTackle()`; the same measurements now read ×1.76, 61 m/s, no line lost, and a
   peak with a fish on that is *below* the tension the fight was already applying.

   The tell was in the numbers all along: **the fly was dragged the whole way to the new
   position anyway.** The tackle came with you regardless — it just arrived through the
   solver as violence. The fix is to bring it deliberately.

   Why it survived a build with two harnesses: `smoke.mjs` stubbed `getWorldPosition()` to
   return the LOCAL position, so every hand, panel and reel was pinned to the world origin
   however far the rig had walked. Moving the rig reached nothing the simulation can feel,
   and a teleport under load looked completely free in here. The stub walks parents now.
   **A harness that cannot see the rig move cannot see anything that moving it breaks.**

15. **A tippet transmitting six times what it can hold.** Reported as *"sometimes while
   fighting a fish it can jump, or get launched by the pole, and go 20-30 feet in the
   air"*. The line pulls the fish as an axial spring, and `fishTension` was clamped at
   **600 N** — fifteen 5X tippets — while the break-off fires off `M.tension`, which is
   smoothed with a ~1/12 s time constant. So a spike could pour its full force into a
   1 kg fish for the several frames it took the average to climb past `P.tippet`.
   Measured with a hard rod movement: **144 N arriving at a fish on a 21 N tippet.**
   `fishTension` stays raw, because the rod reaction and the break-off test both want
   it raw; `fishCarried` is what reaches the fish's body, and it is
   `min(fishTension, P.tippet)`. Two variables on purpose — a test that recomputes the
   cap for itself proves nothing about the cap the game applied.

   **This is a hardening, not a demonstrated cure, and the difference matters.** The
   reported symptom was never reproduced: across every tippet, rod sweep, reel setting
   and forced jump the harness could manage, the highest a hooked fish ever got was
   **0.73 m**. So there is a path in that is not understood. The second guard is the one
   that does not depend on understanding it: a hooked fish's speed is capped at 8 m/s,
   which every measured scenario is already far below (peak 5.0), and which bounds any
   ballistic apex at 3.3 m. **If a fish is still seen leaving the reach, that cap is the
   proof the cause is somewhere else entirely** — and the next place to look is anything
   that writes `Trout.p` or `Trout.v` outside `step()`.

   Worth recording about the harness, too: `Vector3.applyQuaternion()` was a no-op stub
   and `Quaternion.multiply()` returned `this`, so **the rod could never be rotated** —
   `_off.set(0,0,NEXT_Z).applyQuaternion(_q)` came back unchanged and the blank pointed
   down -Z whatever the wrist did. A casting game whose harness has never seen a cast.
   Both are real now, and with identity quaternions they are exact no-ops, so nothing
   that was passing changed.

**`diag.mjs` reproduces a fight headlessly** — hooks a fish, drives the reel trigger, and
traces lineOut, tension, distance and behaviour, plus a geometry report showing where stretch
actually sits. Every fight bug above was found with it rather than by guessing. Note its Clock
stub: the proxy's `set` trap silently discards assignments, so `THREE.Clock` has to be handled
in the `construct` trap. It wasn't, `dt` was NaN, and the harness reported healthy nonsense for
a while.

**Two harnesses, and they catch different things.** `smoke.mjs` runs the module in a **plain**
vm context — an earlier version wrapped the global in a Proxy whose `has` trap returned true,
which made every undeclared read resolve to `undefined` instead of throwing, hiding exactly the
bug class the test exists for. `diag.mjs` and `diag2.mjs` drive real scenarios and were what
actually caught the last undeclared variable.

**And `remotecheck.mjs` for the phone page**, which has no simulation to fall over and so
never appears in `smoke.mjs` — see section 4b.

**A stub that answers wrongly is worse than one that throws.** Every one of the
harness's worst misses has been this shape: the Proxy `has` trap that made every
undeclared read resolve to `undefined`; `getWorldPosition()` returning a local position,
so the rig could never move; `applyQuaternion()` returning its input, so the rod could
never turn. None of them failed; all of them quietly reported health. When adding a stub, prefer
one that is obviously incomplete to one that is plausibly wrong.

**Therefore: run `smoke.mjs` before shipping.** It stubs Three.js and the DOM with real
Vector3/Quaternion maths, executes the module, **connects a left and right controller with
triggers held**, and ticks six frames. Connecting the controllers matters — bugs 8 and 9 both
lived in branches that never run without a hand on the line, and an earlier version of the
harness missed bug 9 because its fake gamepad had every button pressed, which raised the net
and skipped the line-hand path entirely. The context's global object is also a Proxy that
reports undeclared identifier reads. `node --check` catches none of this.

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
7. **Performance.** ~116 active nodes at default spacing, ~265 at both minimums. On the CPU
   speck path, specks cost a flow evaluation each and dominate at high density; the GPU path
   removes that entirely. See `STRATEGY.md` for the full headroom analysis.

---

## 7. Strategy, roadmap and business

See `STRATEGY.md` — platform choice, performance headroom, feature cost estimates, suggested
build order, market and monetisation analysis, and the legal/employment considerations.

## 8. If this moves off WebXR

Meta's Horizon Store accepts immersive WebXR PWAs, packaged with Bubblewrap into an Android
App Bundle, with in-app payments via the Digital Goods API. So the current file is already
the shippable artifact — no port required unless the solver outgrows the browser. Keep the
signing keystore; every update must use the same certificate.

If a port becomes necessary, Godot is the recommendation over Unity: MIT licensed with no
revenue threshold, and Meta has been funding its OpenXR support since 2024.
