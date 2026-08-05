import { Quaternion, Vector3 } from './three-stub.mjs';

/* ─────────────────────────────────────────────────────────────────────────
   CASTER v2 — built to published expert kinematics rather than guesswork.

   What the literature actually constrains:

   1. SEQUENCE. Röijezon et al. (2017), 3D motion capture of elite casters:
      peak speed occurs first for rod TRANSLATION, then rod ROTATION, then the
      line haul. Løvoll & Borger (500 fps video) see the same order — rod hand
      max speed, then maximum angular velocity of the butt, then minimum chord
      length. v1 of this caster had no translation at all, which is the single
      biggest thing wrong with it.

   2. MAGNITUDE. Perkins & Richards' Casting Analyzer (rate gyro on the reel
      seat) measures peak butt angular velocity of 300 deg/s on the back cast
      and 355 deg/s on the forward cast, with roughly 15% asymmetry. v1 peaked
      near 825 deg/s — more than twice an expert — which is almost certainly
      why the blank was folding to 96-100 degrees of total bend.

   3. SHAPE. Smooth acceleration to a hard stop. The angular velocity rises
      smoothly to its maximum and is then abruptly checked; what follows is rod
      rebound, not hand motion.

   4. GEOMETRY. The rod tip should track a straight line through the stroke.
      Arc and stroke length both scale with the length of line being cast:
      short line means narrow arc and short stroke, long line means both wider.
      Arc too wide for the rod's bend opens the loop; too narrow tails it.

   What is NOT public: the raw kinematic traces. Röijezon's and Ekander's data
   are available from the corresponding authors on request, not for download.
   So rather than fit to a trace we cannot get, this caster is parameterised on
   the quantities the literature does pin down, and the harness checks the
   simulation against the published magnitudes.
   ───────────────────────────────────────────────────────────────────────── */

const DEG = Math.PI / 180;
const XAXIS = new Vector3(1, 0, 0);
const N = 600;                       // integration samples per stroke

/* rotation: accelerate as x^q, then a hard check over the last (1-xs) */
function rotShape(x, q = 2.0, xs = 0.88) {
  if (x <= xs) return Math.pow(x / xs, q);
  return Math.pow(1, q) * (1 - (x - xs) / (1 - xs));
}
/* translation: a bell peaking early, so the hand leads and then hands off */
function transShape(x, a = 1.4, b = 2.6) {
  return Math.pow(Math.max(x, 0), a) * Math.pow(Math.max(1 - x, 0), b);
}

function profile(shape, args) {
  const v = new Float64Array(N + 1);
  let sum = 0;
  for (let i = 0; i <= N; i++) { v[i] = shape(i / N, ...args); sum += v[i]; }
  const mean = sum / (N + 1);
  const disp = new Float64Array(N + 1);
  let acc = 0;
  for (let i = 0; i <= N; i++) { disp[i] = acc / (N * mean); acc += v[i]; }
  const peak = Math.max(...v) / mean;      // peak rate / mean rate
  return { v, disp, peak };
}

const ROT = profile(rotShape, [2.0, 0.88]);
const TRANS = profile(transShape, [1.4, 2.6]);

const at = (p, x) => {
  const f = Math.max(0, Math.min(N - 1e-9, x * N));
  const i = Math.floor(f), t = f - i;
  return p[i] + (p[i + 1] - p[i]) * t;
};

/* Peak rate happens at ROT.peak x (arc/T). Solve T for a target peak. */
export function strokeTimeFor(arcDeg, peakDegPerSec) {
  return arcDeg * ROT.peak / peakDegPerSec;
}

export const STROKE2 = {
  settle: 1.20,
  /* 9 ft 5wt, roughly 9.5 m of line out — a medium cast, so a medium arc */
  arcDeg: 62,
  strokeLen: 0.55,        // metres of hand travel
  peakOmega: 320,         // deg/s at the butt: expert back cast per the gyro data
  peakOmegaFwd: 355,      // forward cast runs ~15% faster than the back cast
  startDeg: 35,           // rod pitch at the start of the back stroke
  pause: 1.10,
  hold: 2.60,
  handAngleDeg: 8,        // hand path tilts slightly up going back
};

export function timings(s = STROKE2) {
  const backT = strokeTimeFor(s.arcDeg, s.peakOmega);
  const fwdT = strokeTimeFor(s.arcDeg, s.peakOmegaFwd);
  return { backT, fwdT };
}
export function strokeDuration2(s = STROKE2) {
  const { backT, fwdT } = timings(s);
  return s.settle + backT + s.pause + fwdT + s.hold;
}

const _q = new Quaternion();
export function poseAt2(t, s = STROKE2) {
  const { backT, fwdT } = timings(s);
  const t1 = s.settle, t2 = t1 + backT, t3 = t2 + s.pause, t4 = t3 + fwdT;
  const back = s.startDeg + s.arcDeg;          // pitch at the back stop
  const ca = Math.cos(s.handAngleDeg * DEG), sa = Math.sin(s.handAngleDeg * DEG);

  let pitch, slide, phase;
  if (t < t1) { pitch = s.startDeg; slide = 0; phase = 'settle'; }
  else if (t < t2) {
    const x = (t - t1) / backT;
    pitch = s.startDeg + s.arcDeg * at(ROT.disp, x);
    slide = s.strokeLen * at(TRANS.disp, x);
    phase = 'back';
  } else if (t < t3) { pitch = back; slide = s.strokeLen; phase = 'pause'; }
  else if (t < t4) {
    const x = (t - t3) / fwdT;
    pitch = back - s.arcDeg * at(ROT.disp, x);
    slide = s.strokeLen * (1 - at(TRANS.disp, x));
    phase = 'forward';
  } else { pitch = s.startDeg; slide = 0; phase = 'hold'; }

  _q.setFromAxisAngle(XAXIS, pitch * DEG);
  /* hand travels a straight path: back and slightly up, then forward and down.
     +z is behind the caster, so sliding back is +z. */
  return {
    x: 0.28,
    y: 1.15 + slide * sa,
    z: 0.10 + slide * ca,
    q: _q, phase, pitchDeg: pitch, slide,
  };
}
