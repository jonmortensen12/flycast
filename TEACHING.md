# Fly fishing — teaching content and curriculum notes

Research gathered to support a training mode. Organised the way a lesson would be, not the
way a wiki would be: each module lists what the learner needs to *know*, what they need to
*do*, the faults that actually show up, and — in **Sim notes** — what this project can
genuinely teach versus what it can only gesture at.

The honest framing for the whole thing: a simulator cannot build muscle memory for a physical
stroke, and it should not pretend to. What it *can* do far better than a book or a video is
make invisible causation visible — show the line's belly forming, show drag starting before
the fish refuses, show why the fly under a rock never gets eaten. Teach the **why**; let the
river teach the **how**.

---

## Module 0 — The tackle, and why each piece is the size it is

### Rod
- **Length**: 9 ft is the trout default. Shorter for small brushy creeks, longer for reach and
  line control.
- **Weight (wt)**: not the rod's mass — the line weight it is built to cast. A 5-weight is the
  all-round trout rod.
- **Action**: how far down the blank it bends. Fast = stiff, bends near the tip, needs a crisp
  stop. Slow/full = bends toward the butt, more forgiving timing.
- **Parts**: butt, grip (cork), reel seat, stripping guide (the big one low down), snake
  guides, tiptop, ferrules.

### Reel
- On a trout rod the reel is mostly line storage and a **drag**. Drag is set well below the
  tippet's breaking strain — it protects the tippet by slipping before the line breaks.
- **Arbor** size affects retrieve rate. **Backing** sits under the fly line for long runs.

### Line
- **AFFTA standard**: a line's weight number is the mass in grains of its first 30 feet. A
  5-weight is 140 grains, which works out to about 1 gram per metre. This is the single most
  important number in the whole system — *the line is the casting weight*, not the fly.
- **Taper**: weight-forward (most common), double taper, level running line behind the head.
- **Density**: floating, intermediate, sink-tip, full sink.

### Leader and tippet
- Tapered monofilament from a thick butt (~0.021 in) down to a fine tippet. The taper is what
  transfers energy and turns the fly over.
- **X sizing** is inverse: bigger X number = thinner. 5X ≈ 0.006 in ≈ 4.75 lb.
- **Tippet** is the final level section, replaced as it shortens with fly changes.

### Flies
- **Dry** (floats), **nymph** (subsurface immature insect), **emerger** (transitional),
  **wet fly**, **streamer** (baitfish/leech), **terrestrial** (hopper, ant, beetle).
- **Hook size** is also inverse: bigger number = smaller fly.
- Anatomy: hook, bead, tail, body, rib, thorax, hackle, wing, post.

**Sim notes.** Nearly all of this is already parameterised in the physics — line weight,
leader taper, tippet strength, rod action. A tackle module could literally be a guided tour of
the settings panel: *change line weight to 3 and cast; now to 8; feel what the rod does.* That
is a lesson no book can give, and it costs almost nothing to build.

---

## Module 1 — Casting fundamentals

Fly Fishers International teaches casting through the **Five Essentials**, originally set out
by Bill and Jay Gammel. Every certified instructor works from these, and they are the right
spine for a training mode because they are diagnostic, not stylistic — FFI explicitly
distinguishes casting *essentials* from casting *style*.

1. **There must be a pause at the end of each stroke**, and its length varies with the amount
   of line beyond the rod tip. More line, longer pause.
2. **Slack must be eliminated**, both before and during the stroke.
3. **The rod tip must travel in a straight line path.** The path of the tip is mirrored by the
   top leg of the loop — a curved tip path makes a curved, inefficient loop.
4. **The casting arc must vary with the length of line** beyond the tip. Short line, narrow
   arc; long line, wider arc.
5. **Power must be applied in the proper amount and at the proper place** — smoothly and
   progressively to a crisp stop, not punched at the end.

A useful companion rule from instructors: **short line, short stroke; longer line, longer
stroke.**

### The named casts, roughly in teaching order
- **Pick-up and lay-down** — the basic single back cast and delivery.
- **False cast** — casts held in the air to extend line, dry a fly, or change direction. Every
  false cast is also a chance to spook a fish, so fewer is better.
- **Roll cast** — no back cast needed. Essential with trees or a bank behind you.
- **Single haul / double haul** — a sharp pull on the line with the line hand during the
  stroke, which spikes tension, loads the rod deeper and raises line speed. The double haul
  hauls on both back and forward strokes. This is the main distance and wind technique.
- **Reach cast, curve cast, pile/parachute cast, wiggle (S) cast** — see Module 3; these are
  aerial mends, i.e. presentation casts.
- **Steeple cast, side-arm cast, bow-and-arrow** — obstruction solutions.

### Common faults, and what actually causes them
- **Tailing loop / "wind knots".** The tip dips mid-stroke, so the top leg of the loop drops
  below the bottom leg and the legs cross. Causes: too narrow an arc for the rod's bend,
  **creep** (drifting the rod forward before the stroke starts, which shortens the arc),
  abrupt or uneven power ("punch"), or breaking the 180° rule with a high back cast *and* a
  high forward cast. Instructors differ on the dominant cause — some emphasise power
  application, others emphasise the elbow rising on the back cast and lowering on the forward.
- **Wide, lazy loops that pile up.** Stroke too long for the line out, or arc too wide.
  Remedy: shorten the stroke.
- **The "tomahawk"** — taking the rod too far back, slapping the water behind you.
- **Crashing casts** — insufficient power to turn the fly over, or running line overtaking a
  wind-resistant fly.
- **Slack at the start** — the cast begins with nothing to load against.

**Sim notes.** This is the module the project is genuinely best placed to teach, because every
essential is a *measurable* quantity we already compute: rod tip path, tip speed, arc angle,
pause duration, slack at the start of the stroke, loop shape. A training mode could show the
tip path as a ribbon in space and colour it where it deviates from straight; overlay the loop
and name the fault as it happens. That is real instruction, and it is close to what an FFI
instructor does by eye.

Two cautions. First, a VR controller weighs nothing and cannot push back, so the *feel* of rod
load has to come through haptics and visuals — the sim can teach the shape of a good stroke
but not its physical sensation. Second, tailing loops require the line model to reproduce a
crossed loop faithfully; worth verifying before claiming to diagnose them.

---

## Module 2 — Reading water

The base skill. A river decomposes into **levels** (depth changes), **lanes** (current
threads), and **seams** (where two lanes of different speed meet).

- **Seams** are the highest-value feature. Trout almost always lie in slow water and feed in
  the faster current beside it, so a seam gives them both. The visible **bubble line** usually
  sits on a good seam, because bubbles and bugs collect in the same place.
- **Every midstream rock creates five seams**, not three: the left and right fast seams, the
  slower pocket in the middle, and — the ones most anglers miss — the two *merger* seams where
  each fast seam meets the slow middle.
- **In front of a rock** there is a cushion or pillow where the current deflects; trout hold
  there comfortably.
- **Behind a rock**, the pocket collects food, but the reverse current directly behind can be
  too chaotic to hold in — fish often sit toward the *tail* of the pocket instead.
- **Riffles**: oxygenated and food-rich, but the fastest thread is inefficient to hold in, so
  fish the edges.
- **Pools**: head of the pool where fast water first slows is prime. **Tailouts** funnel and
  concentrate, and are also spawning water — avoid wading through redds.
- **Banks**: undercuts, overhanging vegetation, log jams, rocky banks with many small current
  breaks. Trout under a brush tunnel typically lie just outside it, using the dark interior
  only when frightened.
- Trout face upstream and hold where the energy cost of staying put is less than the food
  arriving.

**Sim notes.** With the shallow-water solver this stops being a diagram and becomes an
experiment: the specks *show* the seams, and the solver produces the five-seam structure behind
a rock without being told to. A "read this run" exercise — hide the fish, ask the player to
mark the lies, then reveal — is achievable now and is probably the highest-value training
feature available, because reading water is normally the hardest thing to teach remotely.

---

## Module 3 — Drag and the drag-free drift

**Drag** is the fly moving at a speed or direction different from the water immediately around
it. Trout refuse dragging flies, and pressured fish refuse *micro*-drag most anglers cannot see.

### Causes
- **Line belly**: the line forms a downstream curve which eventually pulls the fly faster than
  the surface current.
- **Cross-current casting**: the line lies across several current speeds at once.
- **Mending too late** (after drag has begun) or **too aggressively** (creating new problems).

### Mending
- **Upstream mend** — the common one. Used when the current between you and the fly is faster
  than the current at the fly. Creates slack so the belly cannot form.
- **Downstream mend** — used when the fly is in *faster* water than the line between you and
  it, to keep up.
- Mend **immediately after the cast, before drag develops**. A weak mend moves only the line
  nearest the rod tip; a strong one shifts the whole system.
- **High-sticking** — hold the rod high to keep line off the water; the less line on the water,
  the less mending is needed.
- Track the drift by following downstream with the rod tip, keeping light contact.

### Aerial mends (presentation casts) — slack built into the cast itself
- **Reach cast**: after the stop, reach the rod out to one side so the line lands angled
  upstream or downstream of the fly. Buys several extra feet of drift before a mend is needed.
- **Wiggle / S cast**: wave the rod tip side to side as the loop extends, laying S-curves.
- **Pile / parachute cast**: aim high and let the line pile on itself near the target.
- **Stack mend / shock mend**: overpower slightly and pull back with the line hand before
  landing, so the fly kicks back and lands in coils. Good for getting behind a rock.

### Positioning
Where you stand is a presentation choice. In conflicting currents, moving upstream and fishing
straight *downstream* to a fish — so line and leader lie in slow bankside water — can succeed
where no amount of mending will. In slow, shallow water a big mend disturbs the surface and
spooks fish; build the slack into the cast instead.

**Sim notes.** This is the second module the project is unusually good at, because drag is
already computed: the fly's velocity relative to the local flow. It can be *shown* — colour the
fly or the leader as slip rises, draw the belly forming, replay the moment drag started. A
learner who has watched drag begin fifty times in slow motion will recognise it on a real river.
An exercise generator — random lie, random current structure, score the drag-free seconds — is
a strong game mode and a strong training tool at the same time.

---

## Module 4 — Insects and matching the hatch

Four orders matter for trout, plus terrestrials.

| Group | Metamorphosis | Stages that matter | Adult recognition |
|---|---|---|---|
| **Mayfly** | Incomplete | nymph, emerger, **dun**, **spinner** | upright sail wings, 2–3 tails |
| **Caddis** | Complete | larva, **pupa**, adult | tent-shaped wings, long antennae |
| **Stonefly** | Incomplete | nymph (1–3 years), adult | flat wings held flat, two tails, large |
| **Midge** | Complete | larva, pupa/emerger, adult | tiny, narrow wings laid back |
| **Terrestrial** | — | adult | hoppers, ants, beetles — summer, wind-blown |

Points that change how you fish:
- Mayflies are unique in having a sub-adult **dun** which later moults to the **spinner**.
  Spinner falls can be the best fishing of the day.
- Stoneflies **crawl out onto rocks and banks to hatch** rather than emerging in the film,
  which is why the nymph is the consistent producer and the adult is an event.
- Caddis adults skitter and flutter, so a little drag can actually *help* when imitating them —
  the one common exception to the drag-free rule. Splashy violent rises during a caddis hatch
  usually mean fish are on the **pupa**, not the adult.
- Midges are the year-round food, dominant in winter and on tailwaters, and usually need to be
  fished smaller than feels reasonable.
- Match in the order **size → profile → colour**. Size matters most; exact colour least.

### Reading the rise
- **Splashy, aggressive** — chasing something moving, often caddis.
- **Quiet sip, minimal disturbance** — mayfly duns or spent spinners.
- **Bulge or hump with no break** — taking emergers just under the film.
- **Head-and-tail porpoising** — usually emergers or spinners in slow water.

**Sim notes.** This maps directly onto the hatch feature already sketched in the roadmap. The
rise-form taxonomy is especially valuable: it is a *visual* skill, hard to learn from text, and
trivially teachable in VR because we already animate rises. Teaching a player to read four rise
forms and choose accordingly would be a genuinely novel training feature — nothing else does it.

---

## Module 5 — The take and the hook set

Different rigs need opposite instincts, which is why anglers who are good at one are often bad
at the other.

- **Dry fly** — the fish rises, takes, and *turns down* with the fly. Setting during the rise
  pulls the fly away. The classic timing device is to say **"God save the Queen"** between
  seeing the rise and lifting. Match the phrase to the fish's pace: a lazy sip in slow water
  earns a longer pause; a fast slash at a caddis earns an immediate set. Use a smooth lift, not
  a yank — a violent set on light tippet breaks off or pulls a small hook free.
- **Nymph** — the opposite. Set **immediately** on anything unusual: a dip, a pause, a twitch,
  a hesitation, the indicator moving upstream. A trout inhales and rejects a nymph in under a
  second.
- **Direction matters.** Trout face upstream, so set **downstream** — that drives the hook into
  the corner of the jaw. Setting upstream tends to pull the fly back out of the mouth. A low,
  sideways sweep downstream is better than a vertical lift.
- **Streamer** — **strip set**: keep the rod low and pointed at the fly and pull hard with the
  line hand; lift only once you feel solid weight.
- **Set fast, but not far.** Move the fly only as far as needed to bury the hook. Where you set
  is also where your next back cast goes — a habit that keeps you out of the trees.

**Sim notes.** A strike-timing window is cheap to add and adds more skill per line of code than
almost anything else on the roadmap. It also gives training mode a crisp, measurable exercise
with an obvious score: reaction time against the ideal window, separately for dry and nymph, so
the player learns that the two are genuinely opposite.

---

## Module 6 — Playing the fish

The single most common piece of bad advice in fishing is "keep your rod tip up."

- **Side pressure** is the core technique: rod low and off to one side, nearly parallel to the
  water, pulling *against* the direction the fish is swimming. It keeps the fish down in the
  water column where it has less leverage, keeps more line in the water for a tighter
  connection, and lets you lead the fish out of heavy current toward soft water.
- **A high rod fights with the tip only** — the softest part of the rod — so it applies far
  less pressure than it feels like, and it pulls the fish toward the surface where it can roll
  and shake. Dropping the rod brings the butt section into play.
- **Pick a side and stay there.** See-sawing the rod from side to side works the hook loose.
  Instructors call the goal a "quiet rod."
- **During a jump**, drop the rod tip — or point it at the fish — to keep the hook from being
  thrown as the fish shakes in the air.
- **On the first run**, keep the angle shallow and let the drag work; add pressure once the run
  slows.
- **Finish high.** Once the fish is tired and close, lifting the rod brings its head up and
  slides it into the net. The high rod is a *landing* position, not a *fighting* one.
- Under-pressuring is the more common error. A long fight exhausts the fish and lowers its
  survival odds, so playing a fish hard and quickly is both more effective and kinder.
- Keep a finger on the line against the cork so you can strip in if the fish runs at you.

**Sim notes.** The fight model already has behaviours, stamina, drag and tippet limits. What it
does **not** yet model is the thing this module is about: **rod angle should change the
effective pressure and where the fish is pulled.** Right now direction of pull is not
differentiated. Making side pressure genuinely more effective than a high rod — and making
see-sawing loosen the hook — would turn the fight from a reeling contest into the skill it
actually is. That is the highest-value physics addition on this list.

---

## Module 7 — Landing, handling and release

Backed by the **Keep Fish Wet** principles, which are evidence-based and widely adopted:

1. **Minimise air exposure.** Fish take oxygen from water. Keep them in it.
2. **Eliminate contact with dry surfaces** — dry hands, rocks, gravel, boat decks. A fish's
   slime coat is its barrier against infection; dry hands and even wet gloves strip it.
3. **Reduce handling time** overall.

Practical points:
- **Wet your hands** before touching a fish. Never handle trout with gloves.
- Use a **soft rubber or knotless mesh net**; keep the net in the water.
- **Barbless hooks** — easier removal, less damage.
- **Never squeeze**, and keep fingers out of and away from the gills.
- **Limit fight time** — a longer fight means more physiological stress.
- **Revive** by holding the fish head-into-current; gills work in one direction only, so do
  not move a fish back and forth.
- **Water temperature is the big one.** Recommended caution thresholds are around 61 °F / 16 °C
  for rainbow, steelhead, cutthroat and brook trout, 66 °F / 19 °C for brown trout, and
  54 °F / 12 °C for bull trout. A fish that swims away strongly has not necessarily recovered.
- **Return the fish to the lie you hooked it in.**

**Sim notes.** This is the module where a game can do something rare: build an *ethic* rather
than a skill. A landing sequence that scores air exposure seconds, checks whether hands were
wet, and refuses the trophy photo if the fish was out too long would teach the right reflexes
before someone's first real fish. Water temperature could gate a session — a hot afternoon
where the correct decision is to stop fishing is a genuinely interesting mechanic and something
no other fishing game does.

---

## Module 8 — Wading, safety and etiquette

- Read the crossing before entering; commit to a route; move one foot at a time.
- Face upstream and shuffle; use a staff; unbuckle or loosen the wading belt at your peril —
  a belt is what keeps waders from filling.
- Do not wade water you could have fished from the bank, and do not wade through the run you
  are about to fish.
- Avoid walking on spawning redds — pale, cleaned gravel patches, mostly in tailouts.
- Give other anglers space; enter below and work up, or ask.
- Clean, drain, dry — invasive species and whirling disease travel on wet gear.

**Sim notes.** Wading is already simulated, including depth slowing you. Adding a
"you waded through the run you were about to fish and put down three fish" consequence is a
cheap, memorable lesson.

---

## Module 9 — Knots and rigging

The short list that covers almost everything:
- **Improved clinch** or **Davy knot** — tippet to fly.
- **Surgeon's knot** or **blood knot** — tippet to leader.
- **Loop-to-loop** — leader to fly line.
- **Nail knot** — fly line to leader butt or backing.
- **Arbor knot** — backing to spool.
- **Non-slip loop knot** — for streamers, lets the fly swing freely.

The point instructors emphasise is not *which* knot but **how well it is tied**: lubricate,
seat it smoothly, and test it. A badly tied strong knot is weaker than a well-tied simple one.

**Sim notes.** Knot tying in VR is a known hard problem and probably not worth attempting with
controllers. A better fit: teach *when* each knot is used, and simulate the consequence —
a poorly seated knot that fails under load at a random moment during a fight, with the break
occurring at the knot rather than mid-tippet.

---

## Suggested training-mode structure

Ordered so each stage uses only what came before.

1. **Tackle tour** — the settings panel as a lesson. Change line weight and feel it.
2. **Casting range** — no fish, no current. Targets, tip-path ribbon, loop overlay, live fault
   naming against the Five Essentials. Pick-up-and-lay-down → false cast → roll cast → haul.
3. **Read the run** — fish hidden, player marks the lies, reveal and score. Uses the solver.
4. **The drift** — one visible fish, scored on drag-free seconds in the feeding lane. Introduce
   mends, then reach and wiggle casts.
5. **The take** — strike timing, dry versus nymph, downstream set direction.
6. **The fight** — side pressure, drag management, jumps, netting.
7. **Release** — air exposure timer, wet hands, revival, temperature judgement.
8. **Free fishing** with a hatch running, all systems live.

Each stage wants three things: a **demonstration** (watch it done correctly), a **guided
attempt** (with the overlay on), and an **unaided attempt** (scored, overlay off).

---

## What this research changes about the feature roadmap

- **Rod angle must matter in the fight.** Module 6 is unteachable without it, and it is the
  largest gap between the current model and real technique.
- **Strike timing** moves up — it is the backbone of Module 5 and cheap.
- **The five-seam structure behind a rock** is a testable claim about the solver. If it
  reproduces it, "read the water" becomes a flagship feature.
- **Rise forms** are worth animating distinctly — splash, sip, bulge, head-and-tail. Four
  animations unlock a whole teaching module.
- **Water temperature** is one number that unlocks the ethics module and a real decision.
- **Aerial mends** (reach, wiggle, pile) are presentation *casts*, not separate systems — they
  fall out of rod motion during the stroke, which the line model already simulates. Likely
  cheaper to support than expected.
- **Fewer false casts should be rewarded.** Every false cast is a chance to spook a fish;
  making that consequential teaches efficiency.

---

## Sources consulted

Fly Fishers International casting instructor materials and the Gammel Five Essentials; Orvis,
MidCurrent, Troutbitten, Scientific Anglers and Hatch Magazine on casting faults, mending, water
reading and fighting technique; Keep Fish Wet for handling principles and temperature
thresholds; several entomology primers for hatch and life-stage material. Specific figures —
AFFTA line weights, tippet X sizes, temperature thresholds — should be re-checked before they
are surfaced to a learner as fact.
