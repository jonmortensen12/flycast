import * as S from './sim.mjs';
import { poseAt, strokeDuration, STROKE } from './caster.mjs';
import { writeFileSync } from 'fs';

const DT = 1 / 72;
const EVERY = 2;          // record every 2nd step -> 36 fps playback
const LINE_PTS = 70;      // resampled points along the line, by arc length

function record(name, note, { config = {}, stroke = {}, iter = 0 } = {}) {
  const st = { ...STROKE, ...stroke };
  S.applyPreset_(S.PHYSICAL);
  S.applyPreset_(config);
  S.P.waterModel = 0;
  S.rebuildSpacing(); S.rebuildRod(); S.rebuildMasses();

  const p0 = poseAt(0, st);
  S.setHand(p0.x, p0.y, p0.z, p0.q);
  S.resetCast();
  S.setLineHand(0.05, 1.05, 0.15, 0);

  const tip = (S.RN - 1) * 3;
  const n = Math.round(strokeDuration(st) / DT);
  const frames = [];

  for (let i = 0; i < n; i++) {
    const p = poseAt(i * DT, st);
    S.setHand(p.x, p.y, p.z, p.q);
    S.stepInputs(DT);
    S.setSolver(0, iter);   // iter 0 clears the pin and uses the adaptive rule
    S.physics(DT);
    const s = S.state();
    if (s.blewUp) { S.clearBlewUp(); break; }
    if (i % EVERY) continue;

    /* rod */
    const rod = [];
    for (let k = 0; k < S.RN; k++)
      rod.push(+S.rpos[k * 3].toFixed(3), +S.rpos[k * 3 + 1].toFixed(3), +S.rpos[k * 3 + 2].toFixed(3));

    /* line, resampled by arc length from fly to spool */
    const line = [];
    const last = Math.min(s.nAct - 1, Math.floor(S.idxAt(s.offSpool)));
    for (let j = 0; j < LINE_PTS; j++) {
      const arc = s.offSpool * j / (LINE_PTS - 1);
      const f = Math.min(last - 0.001, Math.max(0, S.idxAt(arc)));
      const a = Math.max(0, Math.floor(f)), b = Math.min(last, a + 1), t = f - a;
      const A = a * 3, B = b * 3;
      line.push(
        +(S.pos[A] + (S.pos[B] - S.pos[A]) * t).toFixed(3),
        +(S.pos[A + 1] + (S.pos[B + 1] - S.pos[A + 1]) * t).toFixed(3),
        +(S.pos[A + 2] + (S.pos[B + 2] - S.pos[A + 2]) * t).toFixed(3));
    }

    /* readouts */
    let bend = 0;
    for (let k = 1; k < S.RN - 1; k++) {
      const a = (k - 1) * 3, b = k * 3, c = (k + 1) * 3;
      const ux = S.rpos[b] - S.rpos[a], uy = S.rpos[b + 1] - S.rpos[a + 1], uz = S.rpos[b + 2] - S.rpos[a + 2];
      const vx = S.rpos[c] - S.rpos[b], vy = S.rpos[c + 1] - S.rpos[b + 1], vz = S.rpos[c + 2] - S.rpos[b + 2];
      const ul = Math.hypot(ux, uy, uz) || 1, vl = Math.hypot(vx, vy, vz) || 1;
      bend += Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (ul * vl))));
    }
    const chord = Math.hypot(S.pos[0] - S.rpos[tip], S.pos[1] - S.rpos[tip + 1], S.pos[2] - S.rpos[tip + 2]);

    frames.push({
      t: +(i * DT).toFixed(3),
      phase: p.phase,
      pitch: Math.round(p.pitchDeg),
      bend: +(bend * 180 / Math.PI).toFixed(1),
      tipSp: +Math.hypot(S.rvel[tip], S.rvel[tip + 1], S.rvel[tip + 2]).toFixed(2),
      stretch: +(chord / Math.max(s.lineOut, 0.01)).toFixed(3),
      iter: S.getSolver().ITER,
      lineOut: +s.lineOut.toFixed(2),
      rod, line,
    });
  }
  return { name, note, fps: 72 / EVERY, linePts: LINE_PTS, rodPts: S.RN, frames };
}

const clips = [
  record('1 — DEFAULT CAST, solver fixed',
    'Watch: does a loop form and roll out, or does the line just flop over?',
    {}),
  record('2 — SAME CAST, old solver (ITER 6)',
    'Same stroke, iterations pinned to 6. Watch the line stretch past the tip.',
    { iter: 6 }),
  record('3 — GENTLE STROKE',
    'Half the stroke speed. Is 100 deg of rod bend the stroke, or the blank?',
    { stroke: { backT: 0.55, fwdT: 0.50, power: 1.6 } }),
  record('4 — COARSER LINE (12 cm nodes)',
    'Same convergence as 8 cm for half the solver cost. Does it look worse?',
    { config: { nodeLen: 0.12, leadNode: 0.045 } }),
];

writeFileSync('frames.json', JSON.stringify(clips));
for (const c of clips)
  console.log(`${c.name}: ${c.frames.length} frames, peak bend ` +
    `${Math.max(...c.frames.map(f => f.bend)).toFixed(0)}deg, peak stretch ` +
    `${Math.max(...c.frames.map(f => f.stretch)).toFixed(3)}`);
