# Venues

Eight places to fish, selected from the **PLACES** tab. All eight live in one
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

## Why switching reloads the page

The channel functions are baked into the shaders as source at load, so venues
cannot hot-swap. The switch writes `#v=<id>&sw=1&s=<settings>` and reloads.

`sw=1` tells the boot block to put `VENUE_BASE` and then `SC.par` back on top of
the settings that came in on the URL. The effect is: **your tackle travels with
you, the river does not.** Anything a venue is allowed to own is listed in
`VENUE_BASE` and gets reset on every switch — that is what stops you leaving the
pond and arriving at Cedar Run with a sinking dry fly. Rod, line, leader,
friction and reel are deliberately not in that list.

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

## Adding a ninth venue

1. Add an entry to `SCENES` with both the JS and the GLSL.
2. Add its id to `SCENE_IDS`.
3. Add a `['Name','!venue:id',0,0,0,'...']` row under `— PLACES —`.

Check the bounds: `hwMax` and `dzMax` size the solver window, and a lie outside
the wetted channel is a fish standing on the bank.
