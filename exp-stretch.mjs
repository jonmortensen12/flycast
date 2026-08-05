import * as S from './sim.mjs';
import { poseAt, strokeDuration, STROKE } from './caster.mjs';

/* The line is inextensible by construction. Any measured stretch is the
   Gauss-Seidel solve failing to converge, and it reads to the player as a soft,
   laggy line. Measure peak stretch during the hardest part of the stroke. */

const DT = 1 / 72;

function peakStretch(nodeLen, leadNode, iter, alt) {
  S.applyPreset_(S.PHYSICAL);
  S.P.nodeLen = nodeLen; S.P.leadNode = leadNode; S.P.waterModel = 0;
  S.setSolver(6, iter, alt);
  S.rebuildSpacing(); S.rebuildRod(); S.rebuildMasses();

  const p0 = poseAt(0, STROKE);
  S.setHand(p0.x, p0.y, p0.z, p0.q);
  S.resetCast();
  S.setLineHand(0.05, 1.05, 0.15, 0);

  const tip = (S.RN - 1) * 3;
  const n = Math.round(strokeDuration(STROKE) / DT);
  let peak = 0, nodes = 0;

  for (let i = 0; i < n; i++) {
    const p = poseAt(i * DT, STROKE);
    S.setHand(p.x, p.y, p.z, p.q);
    S.stepInputs(DT);
    S.physics(DT);
    const st = S.state();
    if (st.blewUp) { S.clearBlewUp(); return { peak: NaN, nodes: st.nAct }; }
    nodes = st.nAct;
    /* measured chord from tiptop to fly, against the material length between
       them. Cannot exceed 1.0 for a truly inextensible line. */
    const d = Math.hypot(S.pos[0] - S.rpos[tip], S.pos[1] - S.rpos[tip + 1], S.pos[2] - S.rpos[tip + 2]);
    const r = d / Math.max(st.lineOut, 0.01);
    if (r > peak) peak = r;
  }
  return { peak, nodes };
}

console.log('peak chord / material length  (1.000 = perfectly inextensible)\n');
const rows = [];
for (const [nl, ln] of [[0.20, 0.06], [0.12, 0.045], [0.08, 0.03], [0.05, 0.02]]) {
  for (const [iter, alt] of [[6,0],[6,1],[12,1],[20,1]]) {
    const t0 = Date.now();
    const r = peakStretch(nl, ln, iter, alt);
    rows.push({
      nodeLen: nl, leadNode: ln, ITER: iter, altSweep: alt?'yes':'no', nodes: r.nodes,
      stretch: Number.isNaN(r.peak) ? 'BLEW UP' : (r.peak).toFixed(3),
      excess: Number.isNaN(r.peak) ? '—' : ((r.peak - 1) * 100).toFixed(1) + '%',
      sec: ((Date.now() - t0) / 1000).toFixed(1),
    });
    process.stderr.write('.');
  }
}
process.stderr.write('\n');
console.table(rows);
