import * as S from './sim.mjs';
import { poseAt, strokeDuration, STROKE } from './caster.mjs';

const DT = 1 / 72;

export function runCast(opts = {}) {
  const cfg = opts.config || {};
  const stroke = { ...STROKE, ...(opts.stroke || {}) };

  /* reset every tunable we touch, so runs are independent */
  S.applyPreset_(S.PHYSICAL);
  S.applyPreset_(cfg);
  S.P.waterModel = 0;                 // analytic flow; the grid is irrelevant here
  S.rebuildSpacing(); S.rebuildRod(); S.rebuildMasses();

  const p0 = poseAt(0, stroke);
  S.setHand(p0.x, p0.y, p0.z, p0.q);
  S.resetCast();
  S.setLineHand(0.05, 1.05, 0.15, 0);

  const T = strokeDuration(stroke);
  const n = Math.round(T / DT);
  const tipIdx = (S.RN - 1) * 3;

  let maxTipSpeed = 0, maxBend = 0, maxLoopH = 0, blew = false;
  let peakStraight = 0, flyLanded = null, minFlyY = 1e9;
  let tailing = 0;
  const trace = [];

  for (let i = 0; i < n; i++) {
    const t = i * DT;
    const p = poseAt(t, stroke);
    S.setHand(p.x, p.y, p.z, p.q);
    S.stepInputs(DT);
    S.physics(DT);

    const st = S.state();
    if (st.blewUp) { blew = true; S.clearBlewUp(); break; }

    const tipSp = Math.hypot(S.rvel[tipIdx], S.rvel[tipIdx + 1], S.rvel[tipIdx + 2]);
    if (tipSp > maxTipSpeed) maxTipSpeed = tipSp;

    /* total rod bend, same measure the HUD shows */
    let bend = 0;
    for (let k = 1; k < S.RN - 1; k++) {
      const a = (k - 1) * 3, b = k * 3, c = (k + 1) * 3;
      const ux = S.rpos[b] - S.rpos[a], uy = S.rpos[b + 1] - S.rpos[a + 1], uz = S.rpos[b + 2] - S.rpos[a + 2];
      const vx = S.rpos[c] - S.rpos[b], vy = S.rpos[c + 1] - S.rpos[b + 1], vz = S.rpos[c + 2] - S.rpos[b + 2];
      const ul = Math.hypot(ux, uy, uz) || 1, vl = Math.hypot(vx, vy, vz) || 1;
      bend += Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (ul * vl))));
    }
    bend *= 180 / Math.PI;
    if (bend > maxBend) maxBend = bend;

    /* how straight is the flying line? 1.0 means fully turned over */
    const dTipFly = Math.hypot(
      S.pos[0] - S.rpos[tipIdx],
      S.pos[1] - S.rpos[tipIdx + 1],
      S.pos[2] - S.rpos[tipIdx + 2]);
    const straight = dTipFly / Math.max(st.lineOut, 0.01);

    /* loop height: vertical spread of the airborne line */
    const last = Math.min(st.nAct - 1, Math.floor(S.idxAt(st.lineOut)));
    let lo = 1e9, hi = -1e9;
    for (let k = 0; k <= last; k++) {
      const y = S.pos[k * 3 + 1];
      if (y < lo) lo = y; if (y > hi) hi = y;
    }
    const loopH = hi - lo;

    if (p.phase === 'hold') {
      if (straight > peakStraight) peakStraight = straight;
      if (loopH > maxLoopH) maxLoopH = loopH;
      /* tailing loop: the fly drops below the straight tip-to-fly chord while
         the loop is still travelling */
      const midY = 0.5 * (S.pos[1] + S.rpos[tipIdx + 1]);
      if (S.pos[1] < midY - 0.35 && straight < 0.9) tailing++;
    }
    if (S.pos[1] < minFlyY) minFlyY = S.pos[1];

    const film = S.filmY(S.pos[0], S.pos[2], t);
    if (flyLanded === null && p.phase === 'hold' && S.pos[1] < film + 0.05) {
      flyLanded = { t, x: S.pos[0], z: S.pos[2], straight };
    }

    if (opts.trace && i % opts.trace === 0) {
      trace.push({ t: +t.toFixed(3), phase: p.phase, pitch: +p.pitchDeg.toFixed(0),
                   bend: +bend.toFixed(1), tipSp: +tipSp.toFixed(2),
                   straight: +straight.toFixed(3), loopH: +loopH.toFixed(2),
                   lineOut: +st.lineOut.toFixed(2) });
    }
  }

  return { blew, maxTipSpeed, maxBend, peakStraight, maxLoopH, tailing,
           flyLanded, lineOut: S.state().lineOut, trace };
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */
if (process.argv[2] === 'one') {
  const r = runCast({ trace: 7 });
  console.table(r.trace);
  console.log({ blew: r.blew, maxBend: +r.maxBend.toFixed(1),
                maxTipSpeed: +r.maxTipSpeed.toFixed(2),
                peakStraight: +r.peakStraight.toFixed(3),
                maxLoopH: +r.maxLoopH.toFixed(2), tailing: r.tailing });
}
