import * as S from './sim.mjs';
import { poseAt, strokeDuration, STROKE } from './caster.mjs';
const DT=1/72;
function peak(nl,ln){
  S.applyPreset_(S.PHYSICAL); S.P.nodeLen=nl; S.P.leadNode=ln; S.P.waterModel=0;
  S.rebuildSpacing(); S.rebuildRod(); S.rebuildMasses();
  const p0=poseAt(0,STROKE); S.setHand(p0.x,p0.y,p0.z,p0.q); S.resetCast();
  S.setLineHand(0.05,1.05,0.15,0);
  const tip=(S.RN-1)*3; let mx=0,it=0,nodes=0;
  const n=Math.round(strokeDuration(STROKE)/DT);
  const t0=Date.now();
  for(let i=0;i<n;i++){
    const p=poseAt(i*DT,STROKE); S.setHand(p.x,p.y,p.z,p.q);
    S.stepInputs(DT); S.physics(DT);
    const st=S.state(); if(st.blewUp){S.clearBlewUp();return null;}
    nodes=st.nAct; it=S.getSolver().ITER;
    const d=Math.hypot(S.pos[0]-S.rpos[tip],S.pos[1]-S.rpos[tip+1],S.pos[2]-S.rpos[tip+2]);
    const r=d/Math.max(st.lineOut,0.01); if(r>mx)mx=r;
  }
  return {nodes,it,stretch:mx,ms:Date.now()-t0};
}
const rows=[];
for(const [nl,ln] of [[0.20,0.06],[0.12,0.045],[0.08,0.03],[0.05,0.02]]){
  const r=peak(nl,ln);
  rows.push(r?{nodeLen:nl,leadNode:ln,nodes:r.nodes,autoITER:r.it,
    stretch:((r.stretch-1)*100).toFixed(1)+'%',solve_ms:r.ms}:{nodeLen:nl,stretch:'BLEW'});
}
console.log('AFTER: adaptive ITER + alternating sweep');
console.table(rows);
