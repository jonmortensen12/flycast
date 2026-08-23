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

**Playing flex.** `fightFlex` multiplies the blank's compliance while a fish is on — XPBD
compliance up, legacy stiffness down, the same statement in each model's currency — eased
in over about a third of a second so the take does not snap the rod into a new shape, and
eased back out when he is off. The rod you want to throw a tight loop with is not always
the rod you want to play a fish on, and this is the one number that lets a build have
both. It ships at 1.6. It moves bend only: the tippet still parts at the same tension.

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

Four to six fish per venue, procedurally generated: swept-ellipse body with clean UVs, a
canvas texture, plus caudal, dorsal, adipose, anal, pectoral and pelvic fins. A travelling
sine wave runs down each body via a per-fish vertex shader, with the tail riding the same
wave.

**Fish size** (`fishSize`) multiplies the length of every fish in the reach, on top of the
length the venue gives each lie and the size the species runs to. It is live — the slider
moves and the fish in the water grow, rather than waiting for a rebuild that would put every
one of them back in its lie and drop a fish you had on. The mesh scale **is** the length,
and weight comes off `bodyMass()`, which is length **cubed**, so the card under a landed
fish and what the rod feels can never disagree with each other.

### 2.7c The presentation zone

The box drawn over each fish used to be **scenery**. `latTol` and `upMax` appeared
in exactly one place in the whole file — the four vertices of the quad
`buildZones()` drew — and in no test a fish ever applied. The take was a **circle**
of radius `takeRadius` in plan view, so a fly landing a foot *behind* a trout was
offered to him on the same terms as one that came down his lane from six feet
above. The picture of how a trout feeds and the rule the game applied were two
different things, and the picture was the one that was right.

Now the box **is** the rule, and it has two halves.

**How big it is** — not one number for the whole reach. The floor is what he can
physically see: a trout looks at the surface through **Snell's window**, a circle
whose radius is about **1.13 × his depth below the film**, so a fish hanging in two
feet of water first picks a floating fly up a long way further upstream than one
tucked under the bank in six inches. `upMax` is that length for the reference fish
(0.42 m down, a window of ~0.92 m) and the ratio scales it, clamped to 0.30–1.7×.
`latTol` widens on the same ratio, because a deeper fish sees a wider patch as well
as a longer one.

Then it is **extended to reach past whatever is upstream of him** — a rock, a sunk
log, the lip of a drop — by `zoneClear`. A fish lying behind a boulder or under a
fall is one whose drift has to survive the seam, not just the last two feet, and
that is the whole difficulty of pocket water. Two things about that extension are
load-bearing:

- **"Near" is a couple of rod lengths, not the whole reach.** `ZONE_SCAN` is
  `max(2.0, upMax·1.25)`. The first version scanned `upMax·3.2` — nineteen metres —
  and a fish standing eighteen metres below a lip had his window stretched to twenty
  by it. That is not a fish holding under a waterfall; it is a fish in a pool that
  happens to have one somewhere above it. `smoke.mjs` asserts both halves: a fish
  just below a lip is under it, a fish well below the same lip is not.
- **It is a `max`, not a sum.** A feature already inside a deep fish's window does
  not lengthen anything — but it still sets `zoneWhy`, so the refusal can name it
  (*"drag off the rock — refused"*). Whose seam you failed in is the useful half of
  the message.

`ZONE_SCAN` is shared with the harness on purpose. A test that writes out the rule
it is checking is a test that can quietly disagree with the code.

**And it stops at what the fly cannot come over.** Extending and stopping are not
the same feature, and treating them as one asked for casts the river cannot
receive. Water runs over a sunk log, over a boulder that is awash, over a
six-inch lip — the fly goes with it, so the drift really does have to survive
that seam. Nothing drifts over a rock standing a foot out of the water or over a
four-foot fall: below one of those the drift *starts*. So a feature in his own
line (`|Δz| < r`) that is proud of the film by more than `PROUD` = 0.15 m, or a
drop over 0.50 m, **clips** `zoneUp` to the near face of it instead of pushing it
past. Cedar Run's boulders crown 2 cm under the surface and still lengthen the
box; Boulder Garden's stand 40–100 cm clear and now end it.

Measured before that clip: every fish in Boulder Garden had about two metres of
clean water above him under a four-and-a-half metre box, so the best drift anybody
could make covered 45% of it and each of those fish sat near the floor of the
`0.25 + 0.75·cover` multiplier for a reason nothing in the headset could show you.
Now the box is the pocket: 1.8–2.1 m of zone over 1.9–2.4 m of water, and the
drawn box ends where the water does.

**`upMax` is a venue number.** It is in `VENUE_BASE`, so a reach can own the drift
it can actually give: 6 m in a run or a glide, `2.6` in Boulder Garden — whose own
subtitle says *short drifts* — and `4.2` under Stairstep Falls, where the pool
below the lip is the whole of the presentation.

**What it measures** — the drift is judged over the box and nothing else. Slip
accumulates only while the fly is inside it, so eight metres of clean water upstream
no longer forgives a foot of drag in front of his nose, and one bad instant at the
splashdown no longer poisons a drift that was fine by the time it arrived. And how
much of the box the fly actually came down is its own multiplier: `0.25 + 0.75·cover`,
so a fly that appears on his head is worth about a quarter of the chance and one that
came the whole way is worth all of it.

`Trout.judge()` is one function returning the whole verdict, called by the frame loop
and by `smoke.mjs`. The number the game rolls against and the number a test asks about
cannot be two different numbers.

Slack water has no upstream and no drift, so below 0.08 m/s the box says nothing and
the old whole-cast average is what is left. That is what keeps the pond sane; it earns
its takes on the chase path instead.

**It is drawn on all four sides**, and it is live: amber at rest, green while your fly
is inside it and drifting honestly, **red the moment it starts to drag**. That is the
piece of feedback that turns *"drag — refused"* from a verdict you get afterwards into
something you can see and fix on the water. The long sides are sampled at `ZSEG`
points rather than drawn corner to corner, because two corners cannot follow a surface
with a drop in it — which is exactly the water this feature exists for.

### 2.7b Landing one

Netting a fish is two stages, and the first one is the point of the whole game.

**He comes up to you.** Chest height (`chestDrop` below your eyes, 0.35 m by default), an
arm's length along the way you are actually looking, turned broadside so you get the flank
and the markings rather than a nose, with his length, weight and species on a card under him.
The point is fixed at the moment of landing rather than tracked every frame — a fish welded
to your head is the kind of thing that makes people take a headset off, and a fixed point is
one you can lean into and walk around.

For `lookSecs` (5 s by default) he is yours to take. The net is a held button, not a toggle,
so letting go of it and pinching puts him straight in your hand; **while you are holding him
the clock does not run**, and he only leaves when you let go. At `lookSecs` 0 he goes straight
to the bank, which is what this did before.

**Then he goes and rests**, at the nearest margin and at the same chest height, so he reads
from across the reach and can still be picked up without stooping into the shallows. Nothing
times out there — you can carry on fishing and come back to him. Past `MAX_TROPHY` the oldest
one kicks off and swims back to its lie, so the bank never becomes a graveyard.

This has now been round the houses three times and it is worth writing down why. The first
build floated him in front of your face for four seconds and then **vanished him back to his
lie**, which cut the moment off before you were done with it. The fix for that sent him
**straight to the margin** and left him finning in two inches of water — no vanishing, but
you never got a look at him at all, and you had to wade over and look down to find what you
had caught. The shape above is both halves: the look first, then the rest, and chest height
for both.

### 2.7a The five species

`SPECIES` in section 5 is the whole of the difference between them: the paint, the tail
shape, the body depth, and eleven behaviour multipliers. Add a sixth entry and the menu row,
the texture, the mesh, the phone panel, the trophy card and the asset slot all follow from
it — there is no second list to keep in step.

Which lie holds which fish comes from a **fixed draw taken from where the lie is**, so the
same lie holds the same fish across a rebuild, an asset load or a settings change. Turn a
species off and only the lies that held it change hands; the rest of the reach stays exactly
as you learned it. Turn every species off and rainbows come back — an empty river is never
what anybody meant. `syncSpecies()` swaps a fish's species **in place**: it keeps its lie,
its state and its stamina, so a fish you have on turns into a brown mid-fight rather than
coming off.

The UV runs **around** the body: v=0 and v=1 are the dorsal midline, v=0.5 is the belly, so
the two flanks sit at v=0.25 and v=0.75 and `dB=|v−0.5|` is how far up the flank a point is.
`dB>0.25` is above the lateral line. Every paint pass is written in those terms, which is
what lets one routine pepper a rainbow all over and keep a salmon's belly clean.

| | paint that identifies it | size | how it behaves |
|---|---|---|---|
| **rainbow** | heavy fine spotting right down over the flank and onto the tail, pink lateral band, hot red gill plate | 1.00 | the reference fish — every FISH constant was tuned against it, and all the multipliers below are relative to it |
| **brown** | buttery gold, big black spots in pale halos, red spots in blue halos along the lateral line, square unspotted tail | 1.20 | takes 0.62 — refuses most of what a rainbow eats. Wary 1.45: put down from half again the distance, and sulks that much longer. Holds 1.35 deeper. Bores **down** rather than jumping |
| **brook** | dark olive back with cream vermiculation, red spots in strong blue halos, orange belly, white-edged lower fins | 0.68 | takes 1.55, feeds 1.30, rises 1.45 — the gullible one. Tires 1.55: a short scrappy fight |
| **cutthroat** | brassy gold, large spots crowding the rear third, the red-orange slash under the jaw | 0.95 | takes 1.30, but rise style 0.55 — willing, and the rise is a slow deliberate sip rather than a slash |
| **salmon** | chrome over a blue-green back, sparse X-shaped spots above the lateral line and almost none below, forked tail | 1.65 | takes 0.35 — he is not feeding in fresh water, so a take is temper. Power 1.75, tires 0.55, and the fight weights are run and jump. **He will break a trout tippet**; raise `tippet` or lower `fishPower` to land one |

**Species traits** (`spTraits`) at 0 makes every fish read a rainbow's numbers, so the
species go purely cosmetic. That is the setting to use when tuning the FISH rows — one
variable at a time.

Each species has a **model slot of its own**, all normalised to a metre nose-to-tail along X
with the nose at −X and the back at +Y, which is the frame the procedural body uses and the
reason a loaded model inherits the swim shader untouched. Drop any of these into `assets/`
and it is used; leave it out and that species stays procedural.

**A species uses its own file or it stays procedural — it never borrows another species'
model.** This shipped the other way round for one build, with the generic `trout` slot
standing in for anything missing, and the effect was that with `assets/trout.glb` in place —
the normal case — a brown, a brookie, a cutthroat and a salmon all rendered as that one
rainbow mesh. The species were indistinguishable until you turned **Use model assets** off:
the whole feature erased by its own fallback. The procedural body is the better stand-in by a
long way, because it already carries that species' paint, tail shape and body depth, so a
reach with only `trout.glb` in it shows a modelled rainbow swimming alongside generated
browns and brookies that still look like browns and brookies. `smoke.mjs` installs a rainbow
model and asserts the other four stay procedural.

| species | file, `.glb` tried before `.gltf` |
|---|---|
| rainbow | `trout` · `rainbow` · `rainbow-trout` · `fish` |
| brown | `brown-trout` · `browntrout` · `brown` |
| brook | `brook-trout` · `brooktrout` · `brook` · `brookie` |
| cutthroat | `cutthroat-trout` · `cutthroat` · `cutty` |
| salmon | `salmon` · `atlantic-salmon` |

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
down. **Where** the fly has to have drifted, and how the drift is scored, is the
presentation zone — section 2.7c. Fights: tension against tippet; the net lands
anything inside the hoop.

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
| Left stick click | **open / close the menu** |
| Left X | reset cast |
| Left Y | send the fish home and start over |
| Right trigger | reel in, analog · **drives the menu pointer while the menu is open** |
| Right grip | clamp line at the cork |
| Right stick | **walks the menu** while it is open — up/down picks a row, left/right moves it |
| Right stick click | **next tab** |
| Right A | menu open: **push** an action row, or step a slider's range · menu shut: **show/hide the stats window** |
| Right B | **open / close the menu** |

**The left hand puts the world back and gets the panel up; the right hand drives
the panel.** That is the whole of the map. It moved from A-resets / B-reseats /
Y-menu, which had the two resets on the hand holding the rod and the menu button
on the hand doing the line.

**About the Quest's own menu button.** It is the obvious place to hang "open the
menu" and it is not available: Meta reserves the left controller's ☰ for the
system, the browser consumes it, and it has no index in the WebXR `xr-standard`
mapping — a page cannot bind it however much it would like to. Clicking the left
stick is the nearest thing that is actually ours: left hand, not a face button,
and nothing else wanted it.

Nobody should have to be told any of that. **PLAYER → Control labels** draws a ghost
of each controller over your hands with a callout on every button that does something
— see *The control guide* below.

### Moving: teleport or slide

**PLAYER → Teleport move.** 0, **the default**, slides the rig around on the stick; 1 is
the hop. It is a live toggle — nothing
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

### Two ways round the menu, and why neither wins

Pointing is still the fast way in and nothing about it changed. But the ray comes
off the hand that is also holding a fly rod, and at arm's length a degree of wrist
is most of a row — so a setting you want to move by one step is a setting you fight
the pointer for. The right stick was doing nothing at all, and a stick is exactly
the input that is good at *one step, precisely, without moving my hand*.

- **Up and down walk the rows**, wrapping within the tab.
- **Up off the top row goes INTO THE TAB BAR**, where left and right walk the tabs
  and down (or **A**) drops back into the rows of whichever one you stopped on.
  `menuFocus` is `'rows'` or `'tabs'`, and the bar draws its selection differently
  when it has the stick — a bright frame and a ◀ ▶ either side — because a
  selection you cannot see is one you cannot steer.
- **Left and right move the value by its own step** — the same step the phone and
  the keyboard use, so a 0/1 toggle flips and a 0.05 slider moves 0.05. Held, it
  repeats after a beat, so a flick is exactly one step. In the bar, sideways is
  what it looks like: the next tab along, and it never touches a setting.
- **Click the stick** for the next tab, when you would rather not go up first.
- **A** pushes an action row, and on a row that is not an action it steps that row's
  range multiplier — the only other thing a row has a button for.

The first version ran straight on into the next tab at either end. It sounds tidy
and it is not: you cannot see the bar you are moving through, so changing section
felt like the panel had been swapped under you, and getting from PRESETS to FISH
meant walking every row of six sections on the way.

**The two never argue.** While the ray is ON the panel the pointer owns the
selection: it sets `menuSel` from the row under it every frame, and a stick pulling
the other way would be unusable. Take the ray off the panel and the stick has it.
That is `pointerOnMenu`, set once a frame by `menuPointer()`. **PLAYER → Stick
menu** turns the stick half off entirely.

Arrow keys, Tab and Enter do the same on the flat page, which is also how the walk
is driven in `smoke.mjs` — the Raycaster stub returns no hits, so `pointerOnMenu`
is false in there and the harness is testing exactly the state that matters.

### The control guide

**PLAYER → Controller labels**, shipped ON. A ghost of each controller drawn where the
real one is, with a callout on every button that does something. There is no tutorial
in this game and no button prompt anywhere else, and *"now squeeze the left trigger"*
is a sentence you should not have to say out loud while somebody is holding a fly rod.

Three things about it are deliberate:

- **The ghost is schematic**, not a model of a Quest controller. It shares space with
  the rod, the cork and the reel, and a shape that is plainly a diagram reads as an
  instruction rather than as a second object in the world. It is also the only version
  that stays correct if the hardware changes.
- **The handle runs along Z**, because the rod does. Both are drawn in grip space and
  the blank is built butt-at-`+BUTT_Z` running out toward −Z; the hand is holding that
  rod, so the controller in it lies along the same axis. The first version laid the
  handle down −Y, a quarter turn out, and looked exactly like that in the headset.
  `smoke.mjs` now measures the handle's axis against the rod's — *"it looks rotated"*
  should not need a headset to establish.
- **The labels billboard; their anchors do not.** The leader stays pinned to the part
  it names while the text is square-on from wherever you are looking. The leaders are
  thin cylinders, not GL lines — same reason the teleport arc is beads.
- **The words track the settings.** With teleport off the stick says WALK; with a fish
  on it says WADE. A label that lies is worse than no label, so `guideWords()` is read
  every frame and `guideDraw()` skips the canvas unless the text actually changed.

Turn it off and **Save as my default** if you would rather fish without them. It is on
the phone remote too, so you can switch it on for a guest and off for yourself without
taking the headset back.

### 4a. The stats window is off, and the words are in the world

The stats window now **ships off** (`showStats`, or **A** on the right hand with the
menu shut). It is a tuning instrument, and shipping it on had a second cost that was
not obvious: it was the only place the game ever spoke to you, and it sat in the
corner of your eye at best. *"drag — refused"*, *"you lined him"*, *"he came for it
and missed"* — that is the half of the game that has to be readable if any of it is
to be learnable, and it was going past unread over the angler's shoulder.

So every `say()` now also puts the words up in the world, on a plate cut to their own
width. **MESSAGES** owns where and how:

| | |
|---|---|
| `msgMode` 0 | **follows your gaze.** A set distance in front and below the centre, so you never hunt for it |
| `msgMode` 1 | **at the fish it is about.** A refusal over the fish that refused, a spook over the one you put down |
| `msgMode` 2 | the stats window and nothing else, which is what this did before |
| `msgSize` · `msgDist` · `msgDrop` | apparent size, how far in front, how far below the eye line |
| `msgSecs` · `msgLag` · `msgOpacity` | how long it holds, how fast it catches up, how solid the plate is |
| `msgR/G/B` | the colour of the words |
| `msgChatter` | whether a hooked fish's change of behaviour floats. **Off** — see below |

Three things in there are load-bearing:

- **The gaze follow LAGS.** `msgLag` is a rate, not a switch. A panel welded to your
  head is one you cannot look away from, and that is the specific thing that makes
  people take a headset off; a lazy follow lets you glance past it and drift it back
  after you. The default catches up over about a fifth of a second.
- **`say()` takes an ANCHOR, and most calls give one.** `say(msg, fish)` is what lets
  mode 1 exist at all — the fish is who the message is about, and the words go over
  him. A message about nothing in particular (*settings copied*, a venue change) has
  no anchor and **falls back to the gaze whatever the mode says**, because there is
  nowhere honest to put it. `Trout.spook()` passes `this`, so every spook, every
  refusal, every take and every netted fish is anchored.
- **The plate is sized to the words, and the panel is scaled by the distance it
  actually ended up at.** So a message hanging over a fish twenty metres off reads
  exactly as large as one in front of your face, and `msgSize` is apparent size
  rather than metres.

**Not everything the game says is an event.** A hooked fish picks a new behaviour
every second or two, and floating each one puts a panel in front of your face for
the entire fight. `say()` takes a third argument, `quiet`, and `pickBehaviour()` is
the only caller that passes it: chatter still reaches the stats window and the phone
(`FISH DOING`), it just does not take the sky. `msgChatter` turns it back on for
anyone tuning the fight weights.

A hidden stats window also stops answering the pointer ray — `Raycaster` does not
check visibility for you, and a window nobody switched on would otherwise still
swallow the trigger the reel needs. `smoke.mjs` checks both states.

### 4c. The post over a hooked fish is a tension gauge

`tensionMark`, shipped on. While a fish is on, the marker above him is coloured by
`M.tension / P.tippet`: green at slack, through amber, to red as it closes on the
tippet, and it **blinks inside the last fifth**, faster the closer it gets. You can
fight a fish by eye instead of by instrument, which is the whole point — the number
was previously only on a window that is now off by default.

Two decisions worth keeping:

- **It is fed `M.tension`, the SMOOTHED tension** — the same number the break-off is
  tested against and the same one the stats window reads, so the post cannot disagree
  with either. The raw pull spikes on every rod movement and would strobe red at a
  fish that was never in danger.
- **`tensionRamp()` and the blink are separate functions.** A colour that is also a
  function of the clock cannot be asserted about, and the ramp is the half worth
  asserting about. The blink only ever **darkens** the ramp — never lighter, never a
  different hue — so the colour still reads as *how loaded is it* at every instant
  and the blink is a separate word meaning *now*.

It draws the hooked fish's post **even with Show markers off**, because a tension
gauge is worth having without a forest of posts standing over every fish in the reach.

Worth recording about the harness: this is the feature that finally forced the
`THREE.Color` stub to be real. It answered `setHex()` with itself and `getHex()` with
`0` — the exact stub shape section 5 warns about, plausibly wrong rather than
obviously incomplete, and it made every colour the game computes untestable.

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

16. **The frozen twin, and the fish in the air.** Both the same line.
   `Trout.rebuildMesh()` — which runs when the model finishes loading and on
   every toggle of **Use model assets** — did `scene.remove(this.mesh)` on a
   mesh the constructor had built into `fishGroup`. `Object3D.remove()` only
   removes a child of the object you call it on, so **it removed nothing**: the
   old mesh stayed in `fishGroup`, visible, frozen at whatever position it held
   at that instant, while the replacement was added to the scene. That is the
   procedural trout standing in the water beside the asset one and never
   swimming. And because `buildFish()` empties `fishGroup` on a venue change
   while the live meshes were no longer in it, they were never cleared either —
   so they stayed at their old coordinates over a reach with a different bed.
   That is the fish hanging in the air. Every asset toggle added one more of
   each. Now: removed from whatever parent it actually has, disposed, and the
   replacement goes back into `fishGroup`.

17. **The Oreo.** The procedural trout's mouth was two fixed-radius ellipsoids:
   the gape a sphere of 0.054 scaled 0.92 in z, so **0.0497 of half-width on a
   snout whose half-width at that station is 0.0179**. Two point eight times
   the width of the head it was mounted on, standing 32 mm proud on each side,
   with a paler disc of the same kind beneath it — a dark biscuit held
   crosswise in the mouth, which is precisely what it looked like. Both pieces
   are now sized from `prof()`, the same profile the hull is swept from, at
   their own station. The width factors (0.80, 0.74) are not taste: an
   ellipsoid tapers as a circle and a snout tapers faster, so matching the
   width at the centre still left the front third poking through the skin at
   +1.7 mm. They are the largest factors that keep both pieces inside the hull
   over their whole length. `smoke.mjs` sweeps them and checks it.

18. **One eye, and nothing wrong with the eyes.** `trout.glb` has two eyes,
   correctly mirrored, both double-sided, both with a positive determinant. The
   **head** is what is lopsided: at the eye station the hull runs z −0.0411 to
   +0.0622, so its midline sits at +0.0105 while the eyes are symmetric about
   zero. That left the +z eye **18 mm under the skin** and the −z one standing
   2.4 mm proud. Fixed by mirroring the buried eye about the head's own
   midline — **one node translation in the GLB, BIN chunk byte-identical, not a
   single vertex rewritten.** Both now stand 2.4 mm proud. `assetcheck.mjs` is
   the guard, and it fails on the file as it shipped.

19. **A pull at the tiptop went into one 1.85 g node.** Reported as the rod folding in
   half on hookup. The line's reaction on the blank was applied as
   `rvel[tip] -= dir * fishTension * rinvM[RN-1] * h` — the RAW pull, into the single
   lightest node of the rod. 26 N on 1.85 g is **32 m/s of velocity change per substep**,
   195 m/s across a frame, and at the old 600 N ceiling it was 750 m/s. The bend and
   distance constraints then argue it back down on each of six iterations, which is why
   a clean harness shows only 3.6° of bend and a tip at 0.8 m/s — but what is happening
   there is a force and a constraint fighting to a draw every substep, and a fight is
   not a rod.

   A line pulling on a tiptop loads the **tip section**. The same impulse is now shared
   over the last four nodes by mass — 12.4 g instead of 1.85 g — and it uses
   `fishCarried` rather than the raw pull, so the worst case is about a hundredfold
   gentler. Measured over a fight: total bend 7.0° → 4.1°, worst single joint 1.5° → 0.5°.

   **Not reproduced, and that matters.** No combination of fish behaviour, tippet, reel
   or rod movement made the blank fold in the harness; the worst seen was 29° at one
   joint, and that was the rod sweep, not the fish. So this is the same shape as bug 15:
   a genuinely indefensible number, fixed, without a demonstration that it was *the*
   number. If the fold is still there, it is not the tip reaction — look next at
   `solveGuide()`, which couples every guide to the line **both ways** while a hooked
   fish holds `invM[0] = 0`, i.e. an infinitely heavy end on a chain of 1.5 µg nodes.

20. **And then none of it reached the rod at all.** Reported as *the rod does not bend
   when I am fighting a fish*, and it was exactly that. The reaction from (19) was
   written into `rvel` — and `Trout.step()` is called from inside the substep **after**
   the rod's positions have already been integrated, in a loop that ends with
   `rvel[i] = (rpos[i] - rprd[i]) / h` for every free node. So the impulse was
   overwritten a few lines later, every substep, and never moved anything. The blank
   hung at its own dead weight with a fish on: measured under a steady 3.5 N at the tip,
   **7° of total bend against 3° for the rod hanging in still air**.

   Note what this does to the measurement in (19). "Total bend 7.0° → 4.1°" was read as
   the fix working. It was the fish's pull being thrown away more thoroughly.

   The impulse now lands on the position as well — `dv*h`, the displacement it would have
   produced had it arrived before the integration — which puts it in front of the
   constraint solve, the only place a PBD rod can feel anything. Measured across the same
   static rig, rod held **across** the pull: 10 N → 15° and 0.34 m of tip deflection,
   20 N → 39° and 0.44 m. Pointed straight down the line at him it is still almost
   nothing, which is not a bug — a rod pointed at a fish is out of the fight.

   `smoke.mjs` asserts the crude version of this: a pinned fish pulling across the blank
   bends it further than its own weight does, and `Playing flex` moves that number.

**`diag.mjs` reproduces a fight headlessly** — hooks a fish, drives the reel trigger, and
traces lineOut, tension, distance and behaviour, plus a geometry report showing where stretch
actually sits. Every fight bug above was found with it rather than by guessing. Note its Clock
stub: the proxy's `set` trap silently discards assignments, so `THREE.Clock` has to be handled
in the `construct` trap. It wasn't, `dt` was NaN, and the harness reported healthy nonsense for
a while.

**The sandbox has to hand over the language's own globals.** `smoke.mjs` answers `has`
with true for everything, which is what lets it *report* an undeclared read instead of
throwing — and that same trap swallows `Infinity`, `NaN` and the rest, because those live
on the vm context's intrinsics rather than on the sandbox object. An ordinary
`let stop = Infinity` in `fitZone` came back `undefined`, turned the zone length into
`NaN`, and took six presentation-zone assertions down with it while the harness printed
`UNDECLARED READ: Infinity` and nobody read it. They are now on the table explicitly.

**Two harnesses, and they catch different things.** `smoke.mjs` runs the module in a **plain**
vm context — an earlier version wrapped the global in a Proxy whose `has` trap returned true,
which made every undeclared read resolve to `undefined` instead of throwing, hiding exactly the
bug class the test exists for. `diag.mjs` and `diag2.mjs` drive real scenarios and were what
actually caught the last undeclared variable.

**And `remotecheck.mjs` for the phone page**, which has no simulation to fall over and so
never appears in `smoke.mjs` — see section 4b.

**And `assetcheck.mjs` for the models.** It parses the GLBs directly — no GPU, no
loader, no headset — walks the node hierarchy, bakes the transforms and measures the
result. Today it checks that both of the trout's eyes stand proud of a head that is not
symmetric; the point is that a model fault is a measurable fact, not a matter of
squinting at it in the headset.

**A test that reconstructs a value is a test that will lie to you.** The teleport
check worked out where the head had landed from `camera.position` — which is LOCAL to
the rig — plus the rig's delta. That identity holds only while the rig is at the origin,
which it was, until an earlier test left it somewhere else and a perfectly good hop
started failing. Both that and the snap-turn check now ask the camera where it is.
**Measure the thing; do not rebuild it from parts.**

**A stub that answers wrongly is worse than one that throws.** Every one of the
harness's worst misses has been this shape: the Proxy `has` trap that made every
undeclared read resolve to `undefined`; `getWorldPosition()` returning a local position,
so the rig could never move; `applyQuaternion()` returning its input, so the rod could
never turn; `remove()` returning `this` and removing nothing, so no code that moves a
mesh between parents could be checked at all. None of them failed; all of them quietly
reported health. Three of the four were found while chasing a bug the harness should
have caught years earlier. **When you add a stub, make it obviously incomplete rather
than plausibly wrong.** When adding a stub, prefer
one that is obviously incomplete to one that is plausibly wrong.

**A new check must not be able to fail an old one by standing in front of it.**
The menu-navigation, control-guide and marker/message checks press buttons, hook a
fish, spook one and move another — all of which consume RNG and leave the reach in a
different state. Dropped in the middle of the file they changed what a fight was
doing at the instant a later test hopped the rig, and that test measures the tension
it finds there: a green build went red on a feature that touches none of it. They run
last for that reason, and they put the fish back when they are done.

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
   (The lane and the drift window were both on this list and are now section 2.7c.)
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
