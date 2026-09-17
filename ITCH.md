# Flycast on itch.io

Written September 2026. Platform rules change; re-verify before acting.
Companion to `STRATEGY.md`, which covers platform, money and legal at the level
of the whole project. This one covers only what is specific to publishing on
itch.io.

## What itch is good for here, and what it is not

`index.html` is the product and itch will host it, for free, in minutes, on a
page you can share. As a way to **put the cast in front of fly fishers and find
out whether anyone cares**, before committing to Horizon Store review and a
signing keystore you must never lose, it is close to ideal.

**It is not a way to sell the browser build** — though that is not an itch
failing. No storefront sells hosted browser play; the web has no purchase
primitive and every store sells an *install*. On itch specifically, HTML5
projects take donations only, and charging money means setting the project kind
to **Downloadable**, where what the buyer receives is a file.

For this game that is less of a problem than it sounds, because the file already
has a name: the **Bubblewrap-packaged APK** from `STRATEGY.md` §1. Quest users
sideload APKs routinely and itch is a normal place to get them. So the sellable
shape on itch is:

| | |
|---|---|
| Free WebXR build, plays in the Quest browser | the demo and the discovery |
| Paid `.apk` download, sideloaded | the thing money buys |

That is a real product page, and it costs you nothing you were not already going
to build. The Horizon Store remains the actual destination; itch is the place to
learn whether the casting lands before you get there.

## The APK is not as close as `STRATEGY.md` implies

§1 says "it ships as a WebXR PWA. No port required" and that `index.html`
already is the shippable artifact. The second half is very nearly true and the
first half has a gap: **this is not a PWA yet.**

Bubblewrap wraps a *Progressive Web App*, and that means, concretely:

| Requirement | Status |
|---|---|
| Served over HTTPS | yes |
| A web app manifest | **missing** — there is no `manifest.webmanifest` and `index.html` links none |
| A registered service worker | **missing** — nothing calls `serviceWorker.register` |
| `/.well-known/assetlinks.json` on the domain | **missing** |

None of that is a port. It is a twenty-line manifest, a minimal service worker,
one JSON file on the host, and the signing keystore §1 already warns you to keep
safe. Call it half a day. But it is the real next step toward the Horizon Store,
and it is worth knowing that the artifact is not currently sitting there ready
to package.

Worth updating §1 on one more point: **Meta maintains its own fork of
Bubblewrap**, published as `@meta-quest/bubblewrap-cli`, which adds the Quest
and Horizon Store support. Use that rather than Google's upstream.

One consequence of the TWA model that matters for planning: **the packaged app
loads from your hosted URL.** It is a downloadable that still needs the
internet. That is fine for flycast — nothing here is a second device on the LAN
— but it means the APK is a shortcut to the headset, not an offline build. A
genuinely offline copy would use Capacitor, which bundles the assets into the
app instead of pointing at a URL, at the cost of its own WebView and a fatter
binary.

## Does WebXR work in an itch embed?

**Yes.** itch serves the extracted zip from `html-classic.itch.zone` inside an
iframe on the game page, and an iframe cannot reach the WebXR Device API unless
the parent grants `allow="xr-spatial-tracking"`. It did not, WebXR games on itch
were broken because of it, this was filed as itchio/itch.io#1117 in 2020, and
the permission was subsequently added. Present-day WebXR games on itch work.

Two things to verify with your own headset rather than take on trust:

- **Enter VR from the embed.** The path is: open the itch page in the Quest
  browser → press the run button → press the game's own Enter VR. If the button
  is inert inside the embed, the direct `html-classic.itch.zone/html/<id>/`
  link bypasses the iframe entirely and is the standard workaround.
- **Fullscreen.** Set the embed to fullscreen-capable and give it a sane
  viewport; the default small frame is a poor first impression on a flat screen
  and irrelevant once in VR.

## The unpkg dependency, and why it collides with the SharedArrayBuffer plan

`index.html` imports three.js from a CDN in two places:

```
line  170  {"imports":{"three":"https://unpkg.com/three@0.169.0/build/three.module.js"}}
line 4015  await import('https://unpkg.com/three@0.169.0/examples/jsm/loaders/GLTFLoader.js')
```

On itch this works today. Two reasons to vendor it anyway — that is, commit
`three.module.js` and `GLTFLoader.js` into `assets/` and point the import map at
the local copies:

1. **An unpkg outage is a dead game**, on every host, not just itch. A 700 KB
   file is cheap insurance and stays far inside itch's limits.
2. **It is incompatible with the plan in `STRATEGY.md` §2.** The WASM solver plus
   a physics worker needs `SharedArrayBuffer`, which needs COOP/COEP headers.
   itch has an *experimental SharedArrayBuffer toggle* in the embed options that
   sets exactly those headers — and §2 already notes GitHub Pages cannot set
   them, so itch having a switch is genuinely useful. But those headers put
   strict restrictions on cross-origin resources: **the moment the toggle is on,
   the unpkg imports fail.** The toggle is also Chrome-leaning and itch flags it
   as able to break the page.

So: vendor three.js now, and the day the worker lands the toggle is a checkbox
rather than a debugging session.

## Will the rest work as-is?

Yes. The build is small and self-contained:

| | |
|---|---|
| `index.html` | 724 KB |
| `assets/tree1.glb` | 1.6 MB |
| `assets/trout.glb` | 777 KB |
| total | ~3 MB, 4 files |

itch's HTML limits are 1000 files/directories and no single extracted file over
100 MB. Nothing here is close. `assets/` is referenced by relative path, which
survives the move intact. Google Fonts loads fine (until the SharedArrayBuffer
toggle, at which point it is one more thing to vendor).

One caveat shared with every itch web game: the game runs in a cross-origin
iframe, so any `localStorage` it uses is third-party storage — partitioned in
Chrome, and blocked outright by Safari's defaults. Flycast keeps its settings
in `P`; check whether anything is expected to persist between sessions before
promising it will.

## Before you upload anything

**`STRATEGY.md` §6 names the actual gate, and it is not itch's.** Publishing on
itch is publishing under your own name, in public, with a date stamp. The
employer invention-assignment and outside-work question is the thing to resolve
*first* — it costs nothing now and is expensive to unwind after a public page
exists. Read the employment agreement, use whatever approval process exists,
then upload.

The order in §6 stands: confirm you are clear at work → ship free and see if
anyone cares → LLC and store listings only if the answer is yes.

## Everything else

Account setup, visibility modes for private testing, butler + GitHub Actions for
one-command updates, pricing and name-your-price behaviour, download keys,
whether players need an account, how payouts work, pseudonymity, and what an LLC
does and does not protect you from — all of it is platform-general and written
up in detail in the family-smash repo's `ITCH.md`. The facts transfer unchanged.
The flycast-specific deltas are the five sections above.

Two worth repeating because they change scheduling:

- **New accounts and first paid projects wait for a manual indexing review**
  before appearing in browse and search — often around two weeks. The page is
  live and linkable immediately; only the listing waits. Publish early even if
  you are still iterating.
- **A price on itch is a minimum, not a price.** Buyers see "$X or more" and pay
  roughly 30% above it on average. Given §5's honest read on VR revenue, a
  name-your-price minimum costs nothing and measurably raises the average take.
