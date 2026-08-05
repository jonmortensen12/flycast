# Flycast — patch notes

Edits are keyed to the file you pasted. Each block shows the existing line(s)
and the replacement.

---

## 1. Obstacle collision — the actual bug

**`top` is the rock's centre, not its top.**

`placeObstacles()` puts the mesh at:

```js
obstMeshes[i].position.set(o.x, bedY(o.x,o.z)+o.h*P.obstHeight, o.z);
```

That's the **centre** of a sphere of radius `r` (scaled 0.72 in y). So the mesh
actually spans from `centre − 0.72r` to `centre + 0.72r`.

But the collider in `waterAndGround` computes:

```js
const top=bedY(ob.x,ob.z)+ob.h*P.obstHeight;
if(pos[p+1]>top+0.02) continue;
```

`top` here equals the centre height. Every node above the rock's midpoint bails
out of the test. **The entire upper hemisphere of every rock has no collision** —
which is exactly the part sticking out of the water that you're casting over.

Second problem: the collision runs inside the integration loop, *before*
`pos += vel*h`, and long before the constraint iterations. Anything the solver
does afterwards can drag the node straight back through.

### Fix A — correct the geometry and make the radius height-dependent

Replace the obstacle loop at the top of `waterAndGround` with nothing (delete it),
and add this function above `physics()`:

```js
/* Rocks are spheres of radius r, squashed to 0.72 in y, centred at
   bedY + h*obstHeight. The old test used the centre height as the top, so the
   whole upper hemisphere was transparent. Radius must also shrink with height
   or the line rides an invisible cylinder well outside the visible rock. */
function pushOutObstacles(bounceFly){
  for(let o=0;o<OBST.length;o++){
    const ob=OBST[o];
    const cy=bedY(ob.x,ob.z)+ob.h*P.obstHeight;
    const hy=ob.r*(ob.kind==='log'?0.55:0.72);      /* vertical semi-axis */
    const top=cy+hy;
    for(let i=0;i<nAct;i++){
      const p=i*3;
      const y=pos[p+1];
      if(y>top) continue;
      /* cross-section radius at this height */
      let rr=ob.r;
      if(y>cy){
        const u=(y-cy)/hy;
        rr=ob.r*Math.sqrt(Math.max(0,1-u*u));
      }
      if(rr<1e-3) continue;
      const dx=pos[p]-ob.x, dz=pos[p+2]-ob.z;
      const d2=dx*dx+dz*dz;
      if(d2>=rr*rr) continue;
      const d=Math.sqrt(d2)||1e-4;
      /* over the crown, or against the flank? */
      if(y>top-0.06){
        pos[p+1]=top+0.01;
        if(vel[p+1]<0) vel[p+1]=(i===0&&bounceFly)?-vel[p+1]*0.35:0;
      } else {
        const nx=dx/d, nz=dz/d, push=rr-d;
        pos[p]+=nx*push; pos[p+2]+=nz*push;
        const vn=vel[p]*nx+vel[p+2]*nz;
        if(vn<0){
          const k=(i===0&&bounceFly)?1.35:1.0;      /* fly bounces, line doesn't */
          vel[p]-=nx*vn*k; vel[p+2]-=nz*vn*k;
        }
        vel[p]*=0.90; vel[p+2]*=0.90;
      }
    }
  }
}
```

### Fix B — call it where it survives the solver

In `physics()`, immediately **after** the `for(let it=0;it<ITER;it++){...}` block
closes and **before** the `/* ---- material flow ---- */` comment:

```js
    pushOutObstacles(true);
```

Once per substep is six times per frame — enough, and far cheaper than putting it
inside the iteration loop.

---

## 2. Left hand — why it grabs the middle of the pool

This one is a genuine interaction bug, not a search bug. `nearestLineNode` is
correct.

The trigger is analogue. To reach `handMode===2` (`trigL>0.85`) your squeeze
**must pass through** `handMode===1` (`trigL>0.15`) for at least one frame. During
those frames the routing branch runs and sets:

```js
handArc=Math.min(offSpool-0.15,(lineOut+rodArc)+Dg+0.14);
```

…and then `pinLine(handArc, hand, 0.35)` drags that material point to your hand,
six iterations × six substeps. By the time you close to a full pinch, the nearest
point to your hand genuinely *is* mid-pool — because routing put it there a few
frames earlier. You then grab exactly what you're complaining about grabbing.

This is also why light grip can shoot line, which you flagged separately. Same
root cause, and the second symptom confirms the diagnosis.

### Fix A — routing must not transmit tension along the line

Line draped over your fingers can slide freely; only a pinch stops it. Right now
routing pins in all three axes, so pulling your hand back builds tension at the
tiptop probe and feeds line out.

Add this beside `pinLine`:

```js
/* Routing is a pulley, not a cleat. Pin only the component perpendicular to the
   line's own tangent, so the line rests on your fingers but slides freely along
   itself. Pinning all three axes let a light grip shoot line, and dragged the
   material point along the belly toward your hand. */
function pinLinePerp(sVal,x,y,z,k){
  const f=idxAt(sVal), a=Math.floor(f);
  if(a<1||a+2>=nAct) return;
  const t=f-a,b=a+1,A=a*3,B=b*3;
  const px=pos[A]+(pos[B]-pos[A])*t, py=pos[A+1]+(pos[B+1]-pos[A+1])*t, pz=pos[A+2]+(pos[B+2]-pos[A+2])*t;
  let tx=pos[B]-pos[A],ty=pos[B+1]-pos[A+1],tz=pos[B+2]-pos[A+2];
  const tl=Math.hypot(tx,ty,tz)||1; tx/=tl;ty/=tl;tz/=tl;
  let ex=x-px, ey=y-py, ez=z-pz;
  const et=ex*tx+ey*ty+ez*tz;
  ex-=et*tx; ey-=et*ty; ez-=et*tz;          /* drop the along-line component */
  const wa=(1-t)*(1-t)*invM[a], wb=t*t*invM[b], w=wa+wb;
  if(w<=0) return;
  const lx=ex*k/w, ly=ey*k/w, lz=ez*k/w;
  pos[A]+=lx*(1-t)*invM[a];pos[A+1]+=ly*(1-t)*invM[a];pos[A+2]+=lz*(1-t)*invM[a];
  pos[B]+=lx*t*invM[b];    pos[B+1]+=ly*t*invM[b];    pos[B+2]+=lz*t*invM[b];
}
```

Then in the iteration loop, replace:

```js
      if(handHeld&&handIdx>0)
        pinLine(handArc,_handW.x,_handW.y,_handW.z,handMode===2?0.9*grabEase:0.35);
```

with:

```js
      if(handHeld&&handIdx>0){
        if(handMode===2) pinLine(grabArc,_grabW.x,_grabW.y,_grabW.z,0.9);
        else             pinLinePerp(handArc,_handW.x,_handW.y,_handW.z,0.30);
      }
```

### Fix B — ease the target, not the stiffness

`grabEase` currently ramps the pin *stiffness* from zero. That doesn't remove the
jump, it just makes the yank build over 0.17 s — the target is the hand from frame
one, so the line still travels the whole distance, only slightly less violently.

Ease the **target position** instead: hold where the line actually was at the
moment of grab, and lerp that point to your hand.

Replace the `grabEase` declaration:

```js
let handHeld=false, corkHeld=false, handPinched=false, grabEase=1;
```

with:

```js
let handHeld=false, corkHeld=false, handPinched=false, grabEase=1;
let grabArc=0;
const _grabW=new THREE.Vector3(), _grabFrom=new THREE.Vector3();
```

In the grab branch in the main loop, replace:

```js
    if(n.i>0&&n.d<0.22){
      handArc=sArc(n.i)+(sArc(n.i+1)-sArc(n.i))*n.t;
      handIdx=Math.max(1,Math.round(idxAt(handArc)));
      grabEase=0;
    } else { handIdx=-1; say('no line within reach'); }
```

with:

```js
    if(n.i>0&&n.d<0.22){
      handArc=sArc(n.i)+(sArc(n.i+1)-sArc(n.i))*n.t;
      grabArc=handArc;
      handIdx=Math.max(1,Math.round(idxAt(handArc)));
      /* remember where the line actually was, and walk the pin target from
         there to the hand instead of teleporting it */
      const a=n.i*3,b=a+3;
      _grabFrom.set(pos[a]+(pos[b]-pos[a])*n.t,
                    pos[a+1]+(pos[b+1]-pos[a+1])*n.t,
                    pos[a+2]+(pos[b+2]-pos[a+2])*n.t);
      grabEase=0;
    } else { handIdx=-1; say('no line within reach'); }
```

And replace the easing line:

```js
  grabEase=handPinched?Math.min(1,grabEase+dt*6):1;
  _handW.copy(_lh);
```

with:

```js
  grabEase=handPinched?Math.min(1,grabEase+dt*4):1;
  _handW.copy(_lh);
  /* smoothstep the pin target from where the line was to where the hand is */
  {
    const e=grabEase*grabEase*(3-2*grabEase);
    _grabW.lerpVectors(_grabFrom,_lh,e);
  }
```

`dt*4` gives a 0.25 s draw-in. Raise to 6 if it feels sluggish.

### Fix C — the stripping test should use the grabbed arc

In the stripping block, `sArc(handIdx)` uses the *rounded* node while the pin uses
the interpolated arc. At `leadNode 0.03` that's up to 1.5 cm of disagreement fed
straight into a threshold comparison. Change both occurrences:

```js
        const Lt=sArc(handIdx)-(lineOut+rodArc);
```
→
```js
        const Lt=grabArc-(lineOut+rodArc);
```

and in the spool block:

```js
          const Lr=offSpool-sArc(handIdx);
```
→
```js
          const Lr=offSpool-(handMode===2?grabArc:handArc);
```

---

## 3. Fish

### Jump height

`case 'jump': fy=F*3.2;` sustained over `behT=0.60` s. For a 40 cm fish:
`F ≈ 4.8 N`, `m ≈ 0.71 kg`, so `a ≈ 21.6 m/s²` **held for 0.6 s** — about 13 m/s
at release, an apex near 8 m. A real trout clears maybe 0.5–1 m.

Make it a ballistic impulse rather than a sustained thrust. In `pickBehaviour`:

```js
  else if(r<0.58&&s>0.5){ this.beh='jump'; this.behT=0.60; this.newRunDir(); }
```
→
```js
  else if(r<0.58&&s>0.5){
    this.beh='jump'; this.behT=0.45; this.newRunDir();
    /* one impulse, then ballistic. 3.0-4.2 m/s tops out around 45-90 cm. */
    this.v.y=3.0+Math.random()*1.2;
    this.v.x+=this.run.x*1.1; this.v.z+=this.run.z*1.1;
  }
```

and in `step`:

```js
      case 'jump':  fy=F*3.2;  fx=this.run.x*F*0.9; fz=this.run.z*F*0.9; this.effort=1.4; break;
```
→
```js
      case 'jump':  fx=this.run.x*F*0.35; fz=this.run.z*F*0.35; this.effort=1.4; break;
```

### Nose-first orientation

The body's long axis is X with the nose at −X, and nothing currently pitches it.
Add a rotation order so yaw and pitch compose cleanly — in `makeTrout`, just before
`g.scale.setScalar(len)`:

```js
  g.rotation.order='YZX';
```

Then in `update`, replace:

```js
    m.rotation.z=this.state==='hooked'?Math.sin(t*9)*0.22:Math.sin(t*1.6+this.lie.x)*0.04;
```

with:

```js
    /* nose leads the velocity vector: pitch about Z, since the nose is local -X */
    let pitch=0;
    if(this.state==='hooked'){
      const sp=Math.hypot(this.v.x,this.v.y,this.v.z);
      if(sp>0.25) pitch=Math.asin(Math.max(-1,Math.min(1,this.v.y/sp)));
    }
    const roll=this.state==='hooked'?Math.sin(t*9)*0.12:Math.sin(t*1.6+this.lie.x)*0.04;
    m.rotation.z+=((-pitch+roll)-m.rotation.z)*Math.min(1,dt*8);
```

The `-pitch` is because rotating +Z swings the −X nose downward.

### Tippet strength

In `P`: `tippet:21.0` → `tippet:40.0`
In `PHYSICAL`: `tippet:21.0,` → `tippet:40.0,`

40 N is roughly 9 lb — 2X/3X territory. Forgiving while you tune everything else.
The menu note still describes 5X, so update it or leave it as a reminder to put it
back later.

### Line entering the water vertically

`waterAndGround` hard-clamps **every** node to the film:

```js
  if(above<0){pos[p+1]=target;if(vel[p+1]<0)vel[p+1]=0;}
```

Only node 0 is exempt when hooked. So the leader is nailed to the surface, the fly
is at the fish, and the transition happens across a single segment — a vertical
drop. Compounding it, hookup sets `lineOut` to the straight distance plus 10 cm, so
the whole run is nearly taut.

Two changes. First, let the tippet cut through the film. Replace the clamp line with:

```js
  /* tippet is 0.15 mm nylon and denser than water — it should slice through the
     film, not sit on it. Only the fly line proper gets the hard clamp. */
  const sHere=sArc(i);
  if(above<0){
    if(sHere<P.tippetLen*1.15&&hooked){
      vel[p+1]-=1.2*h;                       /* sinks gently instead of clamping */
    } else {
      pos[p+1]=target;if(vel[p+1]<0)vel[p+1]=0;
    }
  }
```

Second, give the hookup some slack so it can form a curve. Both places that read:

```js
         lineOut=Math.max(lineOut,Math.hypot(pos[0]-rpos[T],pos[1]-rpos[T+1],pos[2]-rpos[T+2])+0.1);
```
→
```js
         lineOut=Math.max(lineOut,Math.hypot(pos[0]-rpos[T],pos[1]-rpos[T+1],pos[2]-rpos[T+2])+0.6);
```

(one in `runAction('!hookfish')`, one in the take block).

---

## 4. Sound

### Swish saturates almost immediately

```js
    const sw=Math.max(0,tipSp-1.6)*0.035*P.volLine;
    SND.swishGain.gain.value+=(Math.min(0.35,sw)-SND.swishGain.gain.value)*Math.min(1,dt*14);
```

At a tip speed of 11.6 m/s that hits the 0.35 ceiling — which is a gentle roll cast.
Everything faster sounds identical and loud. Replace with:

```js
    /* higher threshold, superlinear below the cap: quiet strokes stay quiet and
       there is still headroom at speed */
    const sw=Math.pow(Math.max(0,tipSp-3.0),1.5)*0.006*P.volLine;
    SND.swishGain.gain.value+=(Math.min(0.22,sw)-SND.swishGain.gain.value)*Math.min(1,dt*12);
```

### Splash should scale from nothing

```js
const sndSplash=v=>sndBurst(700+Math.random()*300,1.1,0.16+Math.min(0.5,v*0.09),
                            Math.min(0.9,0.10+v*0.13)*P.volSplash,0.25);
```

The 0.10 floor means a feather-soft landing is still clearly audible, and it
saturates by about 6 m/s. Quadratic with no floor gives you the whole range —
and a delicate presentation becomes something you can *hear* you got right:

```js
const sndSplash=v=>sndBurst(560+Math.random()*260+v*40, 1.1,
                            0.10+Math.min(0.55,v*0.075),
                            Math.min(0.85,0.012*v*v)*P.volSplash, 0.25);
```

At 1 m/s that's 0.012 — barely there. At 4 m/s, 0.19. At 8 m/s, 0.77.

---

## 5. Parameters

### `P` block

```js
  nodeLen:0.08, leadNode:0.03, leaderLen:2.74, tippetLen:0.90,
```
unchanged — already at the values you want.

```js
  spoolDrag:3.00,     /* already 3.00 */
  dragMul:1.00,       ->  dragMul:0.40,
  tippet:21.0,        ->  tippet:40.0,
```

### `PHYSICAL`

```js
  dragMul:1.00,     /* dragK already carries 0.5*rho*Cd*A/m with Cd=1.1 */
  ...
  guideMu:0.15, statFric:0.05, spoolDrag:1.00, spoolDead:0.05,
  tippet:21.0,      /* 5X = 4.75 lb */
  buoyancy:1.00, stick:1.00, nodeLen:0.20,
```
→
```js
  dragMul:0.40,     /* felt value; 1.00 is the isolated-cylinder physics */
  ...
  guideMu:0.15, statFric:0.05, spoolDrag:3.00, spoolDead:0.05,
  tippet:40.0,      /* raised while the fight is being tuned */
  buoyancy:1.00, stick:1.00, nodeLen:0.08,
```

Also delete the duplicate `leadNode:0.06,` (it appears twice) and set the
remaining one to `leadNode:0.03,`.

### `MENU` ranges

```js
  ['Spool drag','spoolDrag',0.05,3.00,0.05, ...]
  ['Line air drag','dragMul',0.10,4.00,0.05, ...]
  ['Line node length','nodeLen',0.08,0.50,0.01, ...]
  ['Leader node length','leadNode',0.03,0.25,0.01, ...]
```
→
```js
  ['Spool drag','spoolDrag',0.05,5.00,0.05, ...]
  ['Line air drag','dragMul',0.10,1.50,0.05, ...]
  ['Line node length','nodeLen',0.02,0.14,0.01, ...]
  ['Leader node length','leadNode',0.01,0.05,0.005, ...]
```

### ⚠ MAXNODE will clamp you

`MAXNODE=620`. Node count is `ceil(leaderLen/leadNode) + (34−leaderLen)/nodeLen`.

| nodeLen / leadNode | nodes needed |
|---|---|
| 0.20 / 0.06 | ~202 |
| **0.08 / 0.03 (new default)** | **~485** |
| 0.06 / 0.02 | ~658 — over |
| 0.02 / 0.01 (new minimum) | ~1837 — far over |

Below about 0.07 the chain is silently truncated: `nAct` caps at 620 and the line
simply stops short of the reel. You won't get an error, just wrong behaviour.

If you want the bottom of the new range to be real, raise it:

```js
const MAXNODE=620,   ->   const MAXNODE=1900,
```

That's ~46 KB of extra typed arrays — nothing. The cost is CPU in the solver, which
the FPS row will tell you about honestly.

---

## 6. Air resistance — how it's actually modelled

Two pieces.

**The coefficient**, built once per node in `rebuildMasses`:

```js
dragK[i]=0.5*1.2*1.1*pr[1]*span/m;
```

That's `½ · ρ_air · C_d · A / m`, with ρ = 1.2 kg/m³, C_d = 1.1, and projected area
`A = diameter × span`. Dividing by node mass means `dragK` is an *acceleration* per
unit v² — which is why it's independent of node spacing, since both `span` and `m`
scale together.

**The application**, per substep in `airDrag`:

```js
const vt = v·t̂;                       /* along the line */
const n  = v − vt·t̂;                   /* across the line */
const kN = dragK[i]*P.dragMul, kT = kN*0.027;
const fN = 1/(1+kN*|n|*h), fT = 1/(1+kT*|vt|*h);
```

Velocity is split into components along and across the line's local tangent, and
the two get very different treatment: **full crossflow drag across, 2.7% of it
along.** That ratio is the physical heart of the model — a cylinder sliding along
its own axis sees only skin friction, while one moving sideways sees pressure drag
nearly forty times larger. It's also what makes loops work: the belly moves
sideways and is braked hard, while the section shooting through the guides moves
along itself and is barely braked at all.

The `1/(1+k·v·h)` form is an implicit quadratic drag — algebraically identical to
`dv/dt = −k v²` but unconditionally stable at any step size, so it can't blow up
when the tip snaps.

### On 1.0 versus your 0.4

I don't think 1.0 is wrong *as physics*. C_d = 1.1 for a smooth cylinder in
crossflow is right for Re ≈ 10³–10⁵, and 1 mm line at 10–20 m/s sits at Re ≈ 700–1400,
where the textbook value is 1.0–1.2. So the number is defensible on its own terms.

What I'd suggest is that 0.4 is telling you something real about a *different*
parameter. Drag and mass appear in the equations only as a ratio — `dragK` is
literally `A/m`. Halving drag and doubling line mass are nearly the same
intervention as far as the loop is concerned. Your `CLASSIC` preset ran mass at
6.17× with drag at 3.5×, which is a drag-per-momentum ratio of about 0.57. Your
`PHYSICAL` at mass 1.0 with drag 0.4 gives 0.40. Those are much closer to each
other than either is to physical 1.0/1.0.

So the consistent reading is: **real 5wt line at 0.99 g/m is too light to carry a
loop in this simulation, and you've been compensating on whichever knob was in
front of you.** Which would mean the honest fix is on the mass side, not the drag
side — the same question the rod-versus-line comparison was designed to answer.

I've made the change you asked for, because a felt observation across many casts is
real data and 0.4 is a legitimate finding. But it's worth writing down as "drag 0.4
compensates for something" rather than "drag is 0.4," so it doesn't harden into a
constant before you've tested the alternative.
