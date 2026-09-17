# Venues

Nine places to fish, selected from the **PLACES** tab. All nine live in one
`SCENES` object near the top of `index.html`, just after the settings table.

## How a venue is defined

The river used to be four constants and two functions. It is now the same four
constants and two functions read out of a descriptor:

| field | meaning |
|---|---|
| `dz(x)` | centreline offset from the river axis (`CZ = -9`) |
| `hw(x)` | half width at that station |
| `dep(x, zr)` | still-water depth, `zr` measured from the **axis**, not the centreline |
| `slope`, `drops[]` | the long profile, fed to `surfY()` |
| `obst[]` | bed elevation the solver flows around, in axis-relative z |
| `lies[]` | fish, in axis-relative z. A `cr:[rx,rz,rad/s]` entry makes that fish a cruiser |
| `canopy[]` | branches above the water — solid to the line, invisible to everything else |
| `weeds[]` | soft cover, decoration only |
| `hwMax`, `dzMax`, `dMax` | bounds. `hwMax`/`dzMax` size the solver window, so they must actually bound the geometry |
| `loop` | period in metres. Set it and the reach repeats over that distance — see *The boat drift* |
| `boat` | `{free, row, swing, len, beam}`. Set it and you ride the reach instead of wading it |
| `wall` | `{ax(x), out, h(x), slope}`. Canyon walls: dry bed only, so no GLSL twin and no solver cost. `out` must clear `amp + hwMax − dzAmp` or the cliff stands in the river |
| `par{}` | the venue's own water and fish defaults |
| `glsl` | the GLSL twin of `dz`/`hw`/`dep` |

The channel exists twice — once in JS for the solver, the bed mesh, the fish and
the line, and once in GLSL for the water surface, the bed shading and the GPU
specks. **Both have to be edited together.** The JS and GLSL for each venue are
written line for line against each other for exactly this reason. If the water
looks like it is in a different river from the one you are wading in, that pair
has drifted apart.

`holesJS`/`holesGL` emit gaussian scour pockets into both languages from one
data list — that is how the plunge pools and the pocket water get their depth.

### Where the fish are, and how long a drift the reach can give

A lie has to be two things at once: water a trout would actually hold in, and water
a fly can be presented to. Boulder Garden shipped failing both. Two of its six lies
were typed in by hand against **procedurally placed** boulders and had ended up
welded to the upstream face of one — a metre of stone directly over the fish's lane,
0.2 m of clean water above his nose against a 6 m presentation box — and three more
stood in eight inches of open water between pockets, which is water a trout crosses,
not water he lives in. Its lies now come **off the rocks**, the same way its scour
holes do: one fish per chosen boulder, placed 0.62 of the way down that boulder's
own pocket and a little off the centre line, which is where a pocket-water trout
lies and the only place in a pocket a drift can reach him from.

`upMax` is in `VENUE_BASE`, so **the drift length is the reach's own number**. Six
metres is a run or a glide, where a fly can be dropped a long way above a fish and
tracked the whole way in. Boulder Garden — whose subtitle has always said *short
drifts* — runs 2.6, and Stairstep Falls runs 4.2, because the pool below a lip is
the whole of the presentation. The zone rule itself also now **stops** at anything
the fly cannot come over; see HANDOFF 2.7c.

### What each reach's water looks like

`WATER_LOOKS` used to be reachable only by cycling the **Water looks** row by hand, which
meant nine venues that all shipped as the same mountain freestone. Each descriptor's `par`
now spreads a named look, so a venue arrives looking like itself:

| venue | water |
|---|---|
| Cedar Run | mountain freestone — the calibration reach, left as it was |
| Boulder Garden, Alder Tunnel | overcast steel |
| Stairstep Falls, Boat Drift | deep blue |
| Meadow Glide, The Long Run | chalk stream |
| Undercut Bend, Beaver Pond | tannic |

The table is declared above `SCENES` for this reason, and a venue names a look rather than
carrying a copy of five colour channels that would drift from it the first time anybody
tuned one. A `par` entry of its own still wins, and the **Water looks** row still cycles.

### How much of the bed you can see

The named looks each carry their own `clarity` AND `waterOpaque`, so spreading one into a
venue's `par` silently replaced whatever that reach had — every venue went soupy at once
and the Beaver Pond became opaque. Reported from the water, and this round's own doing.

Both keys are now set per venue **after** the spread, which is the half that matters: an
object literal resolves later keys last, and the first attempt put them BEFORE the spread
where the look simply overwrote them again. If you add a venue, put its water values after
its `...LOOK[...]`, or they will not take.

| venue | opacity | clarity |
|---|---|---|
| Cedar Run | 0.35 | 1.0 |
| Boulder Garden | 0.30 | 2.0 |
| Stairstep Falls | 0.20 | 2.6 |
| Meadow Glide | 0.40 | 1.5 |
| The Long Run | 0.20 | 4.2 |
| Undercut Bend | 0.30 | 1.5 |
| Beaver Pond | 0.10 | 1.25 |
| Alder Tunnel | 0.30 | 1.8 |
| Boat Drift | 0.25 | 2.4 |

**Clarity** is the physical control — how fast light dies with depth, which is why it
drives colour saturation as well as opacity, and it stays the look's business because it
is what gives a reach its character. **Water opacity** is a plain multiplier on top, and
it is the one that decides how much gravel you get to count.

### Two reaches that were wrong in the water

**The Beaver Pond had five boulders in it and now has none.** They were meant to be drowned
timber — small radius, tall, nothing to the solver and everything to a line stripped past
one. Drawn with the rock mesh, which is a squashed *sphere*, a 0.26 m radius stood at 2.2 m
above the bed is not a snag: it is a smooth post standing out of a still pond with nothing
holding it up. A pond does not need obstacles to be interesting — the fish cruise and the
whole difficulty is the strip. If drowned timber comes back it needs a mesh that reaches
the bed.

**Stairstep Falls was a rapid, not a fall into a pool.** The tongue off each lip carried
straight down over the fish and the fly was gone before it could be presented. Three
changes together: the plunge pools are deeper (2.25 m, and a deeper pool passes the same
water more slowly), the channel now *opens out* into each pool instead of staying pinched
from the lip, and `current` drops from 1.05 to 0.62. `hwMax` and `dMax` rose to match,
because the pool now runs wider than the width the lip pinches from — and `smoke.mjs` grew
a check that every venue's geometry actually stays inside its own declared bounds, which
is a rule this file has stated from the beginning and nothing had ever tested.

That was three rounds ago and it was not enough, because all three treated the
tongue as water to be slowed down rather than momentum that should never have
existed. Measured, every lip still pinned the solver's 8 m/s ceiling and the
water was doing 5.3 m/s eighteen metres below it, against 1.1 in the run above.
**A plunge is a boundary.** `gridBuildPlunge` now gives every fall over
`h*grade = 0.60` — Stairstep and nothing else here — a band from the foot of the
fall out to the approach of the next one, carrying the speed of the run that
feeds it, and inside that band the solver may not carry water downstream faster
than that. The fall's energy goes into the white water; the pool passes what the
run delivers. The band lets go before the next lip so the fall still forms.
Measured: 8 m/s at the lip, 1.28 at its foot, 0.77 through the pool — 5.5 seconds
of drift against Zone length 4.2 — and 5.08 m/s at the next lip.

**But one pool is left wild, and that is the point of the reach.** Taming all
six made Stairstep fishable and took the life out of the only water here worth
fishing for: the recirculation behind the boulder in the second pool was driven
by the tongue, and with the tongue gone it fell from 0.57 m/s to 0.14 and read
as slack rather than as an eddy. So `wild: 1` on a drop exempts it from the
plunge cap, and the -27 fall carries it. Measured now: 8 m/s at that lip, 7.8 at
its foot, 6.2 through the pool — against 1.3 and 0.8 in every tamed pool, where
a drift lasts 5.3 seconds.

That pool's mid-tongue lie is **gone** — it measured 6.5 m/s and no drift could
be got over him — and its eddy fish sits at the **top** of the recirculation, at
x -23.2, between the stone and the fall.

Mapping it with the tongue restored corrected the mental model as well. The eddy
is not a pocket behind the boulder: it is one cell filling the whole flank of the
pool, reversed at about a metre a second continuously from the boulder's lee up
to the foot of the fall, entering at the downstream end and turning back into the
tongue at the top. He is at 4.6 off the centreline rather than 4.2 on purpose —
at 4.2 the boulder stands proud directly in his lane and `fitZone` correctly cuts
his window to nothing; 40 cm further out it is beside his lane instead, so it
LENGTHENS the box and becomes the thing the fly has to come round.

`smoke.mjs falls` asserts both pools, the eddy frames, and that no lie is left in
water faster than 3 m/s.

## Switching venues

Venues hot-swap. `runAction('!venue:<id>')` calls `requestVenue()`, which queues
the change; the frame loop fades to black, calls `applyVenue()` on the frame the
screen is fully covered, holds black while the new river settles, and fades back
up. About 1.4 s end to end and **the page never reloads**.

It used to reload — `#v=<id>&sw=1&s=<settings>` and `location.reload()`. That is
fine on a desktop and close to unusable in a headset, because **a reload ends the
WebXR session**: you are dumped to the 2D overlay and have to press Enter VR
again, having rebuilt the entire world on the far side. That is not a level
change, it is a restart that happens to land somewhere else.

What actually blocked the swap was the shaders. Each venue's channel is compiled
into five programs, so `applyVenue()`:

1. repoints `SC` and everything derived from it — `HALFW`, `DROPS`, `GZ0/GZ1`,
   `OBST`, `CANOPY`, `LIES` — which is why all of those are `let`;
2. regenerates the three venue GLSL blocks (`buildSceneGLSL`, `buildSurfGLSL`,
   `buildFlowGLSL`) and calls `reskinVenueShaders()`;
3. reallocates the grid, rebuilds bed, scenery, trees, fish and zone markers,
   restarts both speck paths, stands you on the new bank, and resets the cast.

`reskinVenueShaders()` does not rebuild the shader literals. At load, each
material's source is recorded once with the three venue blocks punched out and
replaced by tokens; the blocks are interpolated verbatim so the match is exact,
and it is **checked at load** against the venue we know we booted on, which makes
a silent miss later impossible. Re-expanding is then a string join. Punch order
matters: `GLSL_SURF` contains `GLSL_SCENE`, so the longer block comes out first.

Two cache traps, both load-bearing:

- **ShaderMaterial** keys its program off the shader source, so new source is a
  new program — but you still have to set `needsUpdate`, or three never looks.
- **The bed is not a ShaderMaterial.** It is a `MeshStandardMaterial` with
  `onBeforeCompile`, and three keys those off the *built-in* shader id, so the
  injected venue GLSL is invisible to the cache. `customProgramCacheKey` returns
  `'flycast-bed-1:'+SCENE_ID` for exactly this reason. Drop the `SCENE_ID` and
  the bed silently keeps the previous river's shape while everything else moves.

**Settling is budgeted, not blocking.** The boot block runs 120 solver steps
before it lets you play; doing that inline here would be a multi-hundred-
millisecond freeze in a live XR session. `applyVenue` sets `venueSettle=120` and
the fade step spends 6 a frame while the screen is black — about 20 frames.

**Your tackle travels with you, the river does not.** `applyVenue` re-applies
`VENUE_BASE` and then `SC.par`, the same pair the reload used to apply from the
boot block. Anything a venue is allowed to own is listed in `VENUE_BASE` and is
reset on every switch — that is what stops you leaving the pond and arriving at
Cedar Run with a sinking dry fly. Rod, line, leader, friction, reel and the GPU
speck budget are deliberately not in that list, so they simply persist: there is
no URL round trip carrying them any more, because nothing reloads.

`syncUrl()` still writes `#v=<id>&s=<settings>` after every swap, so the address
bar stays a shareable link and a manual refresh puts you back where you were —
but it no longer writes the river's own numbers into it. It used to write the
whole of `P`, and the boot block applied the whole of `P` back on top of whatever
reach loaded, guarded by `sw=1` — which nothing in the file has ever written. So
the venue-owned numbers leaked: clarity, current, `upMax`, feeding and sink came
back out of the address bar and sat on the next reach, and the venue's own
defaults were never restored. `encodeSettings(all)` now makes the same split
`applyVenue` does — a key in `VENUE_BASE` or in the venue's `par` is the river's
business and is left out — and the boot block re-applies venue defaults unless
the URL carries `all=1`, which repairs the links already in circulation.
`Copy settings` is the one path that passes `all=1` and the complete tuning,
because that is the button for handing someone the river you set up.

## The pond

`SCENES.pond` sets `cruise`, `chase` and `holdDeep`, which turn on three things
no river uses:

- **Cruising fish.** A lie with a `cr` entry becomes a beat rather than a
  holding spot. The fish never stops, so the cast goes where he is going.
- **A sinking line.** Three numbers, one per part of the rig, at the top of the
  **STILLWATER** tab. They are **seeded by the venue and then yours** (see
  `SEEDED`) — arriving here hands you a sinking leader, and after that nobody
  else touches it, including whoever you are fishing with: `flySink` for the fly (and the tippet it drags down with
  it, easing off along the tippet's length so there is no hinge at the fly),
  `tipSink` for the leader and tippet, `lineSink` for the belly. The pond ships
  `tipSink 0.32, lineSink 0.21`; every river ships zeros, where the dry-fly
  behaviour is byte-for-byte what it was. This was one number driving all three,
  which meant a floating line with a weighted fly — the commonest nymph rig
  there is — could not be expressed. `flySink` is also set for you by the fly
  box: the pheasant tail arrives at 0.16 and the woolly bugger at 0.22.
  A node in the water sits at a **terminal velocity** — the number on the dial,
  at any depth, measured to within 1.5% — because the water drag is referenced
  to that rate rather than to a standstill, and the gravity the integrator
  applied is handed back so it is not counted twice. There is no threshold
  anywhere in it: 0.03 is an intermediate that sinks slowly and 0.20 is a
  fast sinker, and everything between behaves like everything between.
  The ranges are real tackle now (0–0.25 for the line, 0–0.12 for nylon), and
  0 means BUOYANT rather than neutral — a floating line rises, which is what
  the coating is for. Nylon is all but neutral, so a weighted fly takes the
  tippet down with it through the constraint chain.
- **The chase.** This is no longer the pond's — see below. A submerged fly
  moving through the water between `chaseMin` and `chaseMax` reads as alive. A fish inside `chaseRadius` commits, swims at
  where the fly *will be*, and eats it if he catches up. Too slow or stopped and
  he loses interest after `chaseGiveUp`; too fast and he gives up because he
  cannot get in front of it. The seven chase numbers are in the **STILLWATER** tab.

The starting numbers are guesses. `Chase min 0.28` and `Chase max 1.60` are the
two to play with first — they are the whole feel of the retrieve.

## Fishing under the surface, on any reach

Two ways to fish a sunk fly, and both work on moving water now. They arrived
together, because the weighted patterns in the fly box only started really
sinking in the round before this one and until then neither was reachable.

**A dead-drifted nymph.** The take test used to be flat — distance to the fish
in x and z only — so a dry fly riding the film thirty centimetres from a trout
two metres down counted as being on his nose. For a floating fly that is right:
he looks up through Snell's window and comes to the surface, and the rise is the
point. For a fly *under* the water it was wrong twice over. It offered him flies
he could not reach, and it meant nothing about getting a nymph down to his level
changed the outcome, so a nymph was never worth fishing.

A submerged fly is now measured in three dimensions, and **depth is the whole
skill**: cast far enough above him that the fly is at his level by the time it
arrives. Too shallow and it goes by over him; too deep and you are on the bottom.
He tells you which, because otherwise a nymph fished at the wrong depth is
indistinguishable from one he refused. The drift rule is unchanged — a nymph
still has to come down his window without dragging.

What this changes: **deep fish become catchable.** Browns hold deepest, their
window is the biggest, and a clean drift over all of it is hard. A nymph at their
depth is the real answer and now it is the answer the game gives.

**A swung or stripped fly.** The chase used to be gated on `SC.chase`, which is
the pond and nothing else — a venue flag standing in for a fact about the fly.
The gate is on the fly now: submerged, and moving relative to the **current**.
A dead-drifted nymph on a river has almost no relative speed and goes to the
drift rule; a fly swung across the current or stripped back has plenty and reads
as alive. The venue distinction falls out instead of being declared, and all
seven chase numbers apply everywhere.

A streamer also **moves a fish that is not feeding**, which no drifted dry fly
ever will — that is most of the reason to fish one. So the non-feeder penalty is
eased on a chase rather than applied at full strength: about three times more
willing at the shipped `Non-feeder mult` of 0.15, still scaled by the same
setting.

Neither of these is a free win. You now have to get depth and speed right
instead of only drift.

## The alder tunnel

`canopy[]` blobs are solid to the line and to nothing else. `pushOutCanopy()`
runs beside `pushOutObstacles()` each substep; `Branch grip` is how much speed
the line loses where it touches. This is the groundwork for snagging generally —
once branches can catch a line, so can everything else.

## The boat drift

`SCENES.drift` is the ninth reach and the only one you do not wade. It is built on one
idea: **`loop` is a period in metres and every function of x repeats over it**, so the
water at x and the water at x+96 is the same water. When the boat passes the end of the
lap it is translated back by one period — along with the rig, the rod, the line, a fish
you are playing, the vortices, both speck fields and the rings — and by one lap's *fall*
as well, because the reach still runs downhill and the same water upstream sits 4.3 cm
higher. Ninety-six metres of geometry drifts for as long as you want to fish it.

Six rules make it hold together:

1. **Every function of x has period `loop`.** The meander is one cosine at exactly
   `2π/96`, the width and the pool-riffle rhythm are two, and the GLSL twin interpolates
   the same constant to eight decimals. Get the wavelength wrong and the join becomes a
   step in the river.
2. **Everything solid is periodic.** `applyVenue()` gives each rock, log and branch an
   image one lap up and one lap down, so the world across the join is the same world.
   Everything scattered — trees, stones, grass — is folded through `loopX()` to whichever
   image of itself is nearest you, and `loopWrap()` re-lays all three at the join rather
   than waiting for the six-metre scatter threshold to notice.
3. **The ground itself never moves.** The bed and the surface are each one mesh pinned at
   the origin, and it is tempting to translate them a lap along with everything else — the
   bed a lap upstream really is this bed lifted by one lap's fall. Do that and you learn
   what "finite mesh" means: a 170 m bed moved one lap per lap covers [−181, −11] after a
   single circuit while the boat still runs [−48, +48], so from the second lap on the river
   ends in front of the bow. That shipped once. Because `loopWrap()` confines the boat to
   [−loop/2, +loop/2] for ever, the answer is length, not motion — `BED_LEN` is 300 m,
   a 96 m lap plus 102 m of sightline at the worst place you can stand. The solver window
   *does* move with you, and keeps its velocities, depths and foam when it does.
4. **You cannot see far enough to check.** An open reach that runs to a hazy horizon shows
   you the same rock twice and lets you watch the join coming, and no amount of care at the
   seam fixes that. `SC.wall` stands the banks up into a canyon: an axis swinging 12 m where
   the water swings 3.8, its foot 17 m out from that, 13 m of rock at three to one, and a rim
   run up and down by three harmonics of the lap so it is a skyline and not a table. It
   closes the view about 28 m from each apex. It is dry bed and nothing else — outside the
   waterline, so the solver never sees it, the water shader never draws it, and `dz`, `hw`
   and `dep` are untouched. `out` must clear `amp + hwMax − dzAmp` or the cliff stands in
   the river; `onWall()` keeps trees, stones and grass off anything past a metre of climb.
5. **The sky does not slide.** A 200 m sphere left at the origin parallaxes against a boat
   96 m from it; `skyMesh` is re-centred on the camera every frame instead.
6. **The fish migrate rather than being copied.** Two images of a trout is two trout to
   rise and to hook, so `loopFish()` moves each one a whole lap when his lie falls half a
   lap behind you — lie, circuit, strike memory and all, lifted by that lap's fall. The
   switch happens 48 m fore and aft, where his marker post has already dissolved (posts
   fade over the ten metres before the migration distance on any looping reach) and his
   body is a one-pixel smudge under a reflective surface. Without this the six lies sit in
   a fixed 54 m of a 96 m lap: the last quarter of every lap is dead water with nothing
   rising ahead of the bow, and at the join the whole population changes ends at once.

Rules 1 and 2 are checked in `smoke.mjs`. Rules 3–6 are geometry you have to look at:
pin the boat at x=+47.95, cross the join, pin it at x=−47.95 — the same physical station
one period on — and the two frames should differ by no more than two frames of the same
water differ from each other.

The **oars** are the left stick: push it away to row downstream, pull it back to hold
against the current when you want another drift down a seam. That is the whole of your
say in where you are, and it is the point of the venue — one pass at each fish, and the
only way to buy a second one is to row for it.

## Adding a tenth venue

1. Add an entry to `SCENES` with both the JS and the GLSL.
2. Add its id to `SCENE_IDS`.
3. Add a `['Name','!venue:id',0,0,0,'...']` row under `— PLACES —`.

Check the bounds: `hwMax` and `dzMax` size the solver window, and a lie outside
the wetted channel is a fish standing on the bank.
