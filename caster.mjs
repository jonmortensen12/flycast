import { Quaternion, Vector3 } from './three-stub.mjs';

const DEG = Math.PI / 180;
const XAXIS = new Vector3(1, 0, 0);

/* A casting stroke is a rotation of the rod butt in a vertical plane, plus a
   little hand translation. Pitch is measured from horizontal-forward: 0 deg is
   the rod pointing level down the river (local -Z), +90 is straight up, and
   values past 90 are behind the caster. So 1 o'clock is about +115.

   The velocity profile matters more than the angles. A real stroke accelerates
   smoothly and then STOPS DEAD — it is the stop that unloads the blank and
   throws the loop. Hence an accelerating ease with a hard terminus rather than
   anything that decelerates into the endpoint. */
const ease = (u, p) => Math.pow(Math.max(0, Math.min(1, u)), p);

export const STROKE = {
  settle: 1.20,          // let the line settle before starting
  startDeg: -5,
  backDeg: 115,
  backT: 0.32,           // duration of the back stroke
  pause: 1.10,           // the parameter under test
  fwdDeg: 55,
  fwdT: 0.28,
  hold: 2.60,            // watch the loop unroll
  power: 2.2,            // acceleration exponent; higher = later, harder stop
  handTravel: 0.22,      // metres the hand drifts back and forward
};

export function strokeDuration(s = STROKE) {
  return s.settle + s.backT + s.pause + s.fwdT + s.hold;
}

/* returns {pos:{x,y,z}, q:Quaternion, phase:string, pitchDeg} at time t */
const _q = new Quaternion();
export function poseAt(t, s = STROKE) {
  let pitch, phase, drift;
  const t1 = s.settle, t2 = t1 + s.backT, t3 = t2 + s.pause, t4 = t3 + s.fwdT;

  if (t < t1) { pitch = s.startDeg; phase = 'settle'; drift = 0; }
  else if (t < t2) {
    const u = ease((t - t1) / s.backT, s.power);
    pitch = s.startDeg + (s.backDeg - s.startDeg) * u;
    phase = 'back'; drift = u;
  } else if (t < t3) { pitch = s.backDeg; phase = 'pause'; drift = 1; }
  else if (t < t4) {
    const u = ease((t - t3) / s.fwdT, s.power);
    pitch = s.backDeg + (s.fwdDeg - s.backDeg) * u;
    phase = 'forward'; drift = 1 - u;
  } else { pitch = s.fwdDeg; phase = 'hold'; drift = 0; }

  _q.setFromAxisAngle(XAXIS, pitch * DEG);
  /* hand slides back as the rod goes back, forward as it comes through */
  return {
    x: 0.28,
    y: 1.15 + drift * 0.05,
    z: 0.10 + drift * s.handTravel,
    q: _q,
    phase,
    pitchDeg: pitch,
  };
}

/* False-casting: repeat the back/forward pair n times without the settle. */
export function repeatStroke(n, s = STROKE) {
  const one = s.backT + s.pause + s.fwdT + s.pause;
  return {
    duration: s.settle + n * one + s.hold,
    poseAt(t) {
      if (t < s.settle) return poseAt(t, s);
      const k = Math.min(n - 1, Math.floor((t - s.settle) / one));
      const local = (t - s.settle) - k * one;
      return poseAt(s.settle + local, { ...s, hold: s.pause });
    },
  };
}
