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
bar stays a shareable link and a manual refresh puts you back where you were.
Old `sw=1` links keep working; nothing produces them now.

## The pond

`SCENES.pond` sets `cruise`, `chase` and `holdDeep`, which turn on three things
no river uses:

- **Cruising fish.** A lie with a `cr` entry becomes a beat rather than a
  holding spot. The fish never stops, so the cast goes where he is going.
- **A sinking fly.** `flySink` gives the fly node a terminal sink rate and
  releases the tippet from the film, so the leader is pulled under *by* the fly
  instead of holding it up. At `flySink = 0` — every river — the dry-fly
  behaviour is byte-for-byte what it was.
- **The chase.** A submerged fly moving through the water between `chaseMin`
  and `chaseMax` reads as alive. A fish inside `chaseRadius` commits, swims at
  where the fly *will be*, and eats it if he catches up. Too slow or stopped and
  he loses interest after `chaseGiveUp`; too fast and he gives up because he
  cannot get in front of it. All eight numbers are in the **STILLWATER** tab.

The starting numbers are guesses. `Chase min 0.28` and `Chase max 1.60` are the
two to play with first — they are the whole feel of the retrieve.

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

Three rules make it hold together, and all three are checked in `smoke.mjs`:

1. **Every function of x has period `loop`.** The meander is one cosine at exactly
   `2π/96`, the width and the pool-riffle rhythm are two, and the GLSL twin interpolates
   the same constant to eight decimals. Get the wavelength wrong and the join becomes a
   step in the river.
2. **Everything solid is periodic.** `applyVenue()` gives each rock, log and branch an
   image one lap up and one lap down, so the world across the join is the same world.
3. **Nothing alive stands near the join.** The fish are deliberately *not* copied — six
   is the whole reach — so no lie sits within eighteen metres of the seam in either
   direction, and the join itself is at the apex of a bend where the outside bank is in
   the way of the only long sightline.

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
