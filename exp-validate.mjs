import * as S from './sim.mjs';
import { poseAt2, strokeDuration2, timings, STROKE2 } from './caster2.mjs';
import { poseAt, strokeDuration, STROKE } from './caster.mjs';

const DT = 1 / 72;

/* Published benchmarks for a 9 ft 5wt and an expert stroke:
     peak butt angular velocity   300 deg/s back, 355 deg/s forward
     peak rod tip deflection      45-75 cm from the unbent position
     rod tip path                 close to straight through the stroke   */

function run(poseFn, dur, cfg = {}, label = '') {
  S.applyPreset_(S.PHYSICAL);
  S.applyPreset_(cfg);
  S.P.waterModel = 0;
  S.rebuildSpacing(); S.rebuildRod(); S.rebuildMasses();

  const p0 = poseFn(0);
  S.setHand(p0.x, p0.y, p0.z, p0.q);
  S.resetCast();
  S.setLineHand(0.05, 1.05, 0.15, 0);

  const tip = (S.RN - 1) * 3;
  const n = Math.round(dur / DT);
  let prevPitch = p0.pitchDeg, peakOmega = 0, peakDefl = 0, maxBend = 0, peakTipSp = 0;
  const path = [];

  for (let i = 0; i < n; i++) {
    const p = poseFn(i * DT);
    S.setHand(p.x, p.y, p.z, p.q);
    S.stepInputs(DT);
    S.physics(DT);
    if (S.state().blewUp) { S.clearBlewUp(); return { label, blew: true }; }

    const omega = Math.abs(p.pitchDeg - prevPitch) / DT;
    prevPitch = p.pitchDeg;
    /* the settle phase contains a start-up transient from resetCast that has
       nothing to do with the cast — measure only during the stroke itself */
    const live = p.phase !== 'settle';
    if (live && omega > peakOmega) peakOmega = omega;

    /* rod tip deflection: distance from where a rigid rod's tip would be */
    let ux = S.rpos[3] - S.rpos[0], uy = S.rpos[4] - S.rpos[1], uz = S.rpos[5] - S.rpos[2];
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const rx = S.rpos[0] + ux * S.ROD_LEN, ry = S.rpos[1] + uy * S.ROD_LEN, rz = S.rpos[2] + uz * S.ROD_LEN;
    const defl = Math.hypot(S.rpos[tip] - rx, S.rpos[tip + 1] - ry, S.rpos[tip + 2] - rz);
    if (live && defl > peakDefl) peakDefl = defl;

    let bend = 0;
    for (let k = 1; k < S.RN - 1; k++) {
      const a = (k - 1) * 3, b = k * 3, c = (k + 1) * 3;
      const ax = S.rpos[b] - S.rpos[a], ay = S.rpos[b + 1] - S.rpos[a + 1], az = S.rpos[b + 2] - S.rpos[a + 2];
      const bx = S.rpos[c] - S.rpos[b], by = S.rpos[c + 1] - S.rpos[b + 1], bz = S.rpos[c + 2] - S.rpos[b + 2];
      const al = Math.hypot(ax, ay, az) || 1, bl = Math.hypot(bx, by, bz) || 1;
      bend += Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (al * bl))));
    }
    bend *= 180 / Math.PI;
    if (live && bend > maxBend) maxBend = bend;

    const ts = Math.hypot(S.rvel[tip], S.rvel[tip + 1], S.rvel[tip + 2]);
    if (live && ts > peakTipSp) peakTipSp = ts;

    /* tip path during the forward power stroke, in the casting plane (z,y) */
    if (p.phase === 'forward') path.push([S.rpos[tip + 2], S.rpos[tip + 1]]);
  }

  /* RMS deviation of the tip path from its own best-fit straight line */
  let rms = NaN;
  if (path.length > 4) {
    const m = path.length;
    const mx = path.reduce((s, p) => s + p[0], 0) / m;
    const my = path.reduce((s, p) => s + p[1], 0) / m;
    let sxx = 0, sxy = 0, syy = 0;
    for (const [x, y] of path) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const nx = -Math.sin(th), ny = Math.cos(th);
    let s2 = 0;
    for (const [x, y] of path) s2 += ((x - mx) * nx + (y - my) * ny) ** 2;
    rms = Math.sqrt(s2 / m);
  }

  return { label, blew: false, peakOmega, peakDefl, maxBend, peakTipSp, rms };
}

const fmt = r => r.blew ? { stroke: r.label, result: 'BLEW UP' } : ({
  stroke: r.label,
  'butt deg/s': r.peakOmega.toFixed(0),
  'tip defl cm': (r.peakDefl * 100).toFixed(0),
  'total bend deg': r.maxBend.toFixed(0),
  'tip m/s': r.peakTipSp.toFixed(1),
  'tip path RMS cm': (r.rms * 100).toFixed(1),
});

const rows = [];
rows.push(fmt(run(t => poseAt(t, STROKE), strokeDuration(STROKE), {}, 'v1 (rotation only)')));
rows.push(fmt(run(t => poseAt2(t, STROKE2), strokeDuration2(STROKE2), {}, 'v2 (translate+rotate)')));

/* Does arc width behave the way the instruction books say? */
for (const arc of [40, 55, 70, 90]) {
  const s = { ...STROKE2, arcDeg: arc };
  rows.push(fmt(run(t => poseAt2(t, s), strokeDuration2(s), {}, `v2 arc ${arc} deg`)));
}
/* And stroke length? */
for (const sl of [0.15, 0.35, 0.75]) {
  const s = { ...STROKE2, strokeLen: sl };
  rows.push(fmt(run(t => poseAt2(t, s), strokeDuration2(s), {}, `v2 stroke ${(sl * 100) | 0} cm`)));
}

console.log('\nTARGETS from published expert data:');
console.log('  butt angular velocity   300 (back) / 355 (fwd) deg/s');
console.log('  peak tip deflection     45-75 cm for a 9ft 5wt');
console.log('  tip path                near straight through the stroke\n');
console.table(rows);
console.log('v2 stroke durations:', timings(STROKE2));
