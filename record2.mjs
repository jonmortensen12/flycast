import * as S from './sim.mjs';
import { poseAt2, strokeDuration2, STROKE2 } from './caster2.mjs';
import { poseAt, strokeDuration, STROKE } from './caster.mjs';
import { writeFileSync } from 'fs';
const DT=1/72, EVERY=2, LINE_PTS=70;
function record(name,note,poseFn,dur,cfg={}){
  S.applyPreset_(S.PHYSICAL); S.applyPreset_(cfg); S.P.waterModel=0;
  S.rebuildSpacing(); S.rebuildRod(); S.rebuildMasses();
  const p0=poseFn(0); S.setHand(p0.x,p0.y,p0.z,p0.q); S.resetCast();
  S.setLineHand(0.05,1.05,0.15,0);
  const tip=(S.RN-1)*3, frames=[]; let prevPitch=p0.pitchDeg;
  for(let i=0;i<Math.round(dur/DT);i++){
    const p=poseFn(i*DT); S.setHand(p.x,p.y,p.z,p.q);
    S.stepInputs(DT); S.physics(DT);
    const s=S.state(); if(s.blewUp){S.clearBlewUp();break;}
    const omega=Math.abs(p.pitchDeg-prevPitch)/DT; prevPitch=p.pitchDeg;
    if(i%EVERY) continue;
    const rod=[]; for(let k=0;k<S.RN;k++) rod.push(+S.rpos[k*3].toFixed(3),+S.rpos[k*3+1].toFixed(3),+S.rpos[k*3+2].toFixed(3));
    const line=[]; const last=Math.min(s.nAct-1,Math.floor(S.idxAt(s.offSpool)));
    for(let j=0;j<LINE_PTS;j++){
      const arc=s.offSpool*j/(LINE_PTS-1);
      const f=Math.min(last-0.001,Math.max(0,S.idxAt(arc)));
      const a=Math.max(0,Math.floor(f)),b=Math.min(last,a+1),t=f-a,A=a*3,B=b*3;
      line.push(+(S.pos[A]+(S.pos[B]-S.pos[A])*t).toFixed(3),
                +(S.pos[A+1]+(S.pos[B+1]-S.pos[A+1])*t).toFixed(3),
                +(S.pos[A+2]+(S.pos[B+2]-S.pos[A+2])*t).toFixed(3));
    }
    let bend=0;
    for(let k=1;k<S.RN-1;k++){
      const a=(k-1)*3,b=k*3,c=(k+1)*3;
      const ux=S.rpos[b]-S.rpos[a],uy=S.rpos[b+1]-S.rpos[a+1],uz=S.rpos[b+2]-S.rpos[a+2];
      const vx=S.rpos[c]-S.rpos[b],vy=S.rpos[c+1]-S.rpos[b+1],vz=S.rpos[c+2]-S.rpos[b+2];
      const ul=Math.hypot(ux,uy,uz)||1,vl=Math.hypot(vx,vy,vz)||1;
      bend+=Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy+uz*vz)/(ul*vl))));
    }
    let ux=S.rpos[3]-S.rpos[0],uy=S.rpos[4]-S.rpos[1],uz=S.rpos[5]-S.rpos[2];
    const ul=Math.hypot(ux,uy,uz)||1; ux/=ul;uy/=ul;uz/=ul;
    const defl=Math.hypot(S.rpos[tip]-(S.rpos[0]+ux*S.ROD_LEN),
                          S.rpos[tip+1]-(S.rpos[1]+uy*S.ROD_LEN),
                          S.rpos[tip+2]-(S.rpos[2]+uz*S.ROD_LEN));
    const chord=Math.hypot(S.pos[0]-S.rpos[tip],S.pos[1]-S.rpos[tip+1],S.pos[2]-S.rpos[tip+2]);
    frames.push({t:+(i*DT).toFixed(3),phase:p.phase,pitch:Math.round(p.pitchDeg),
      bend:+(bend*180/Math.PI).toFixed(1),
      tipSp:+Math.hypot(S.rvel[tip],S.rvel[tip+1],S.rvel[tip+2]).toFixed(2),
      omega:Math.round(p.phase==='settle'?0:omega),
      defl:+(defl*100).toFixed(0),
      stretch:+(chord/Math.max(s.lineOut,0.01)).toFixed(3),
      iter:S.getSolver().ITER, lineOut:+s.lineOut.toFixed(2), rod, line});
  }
  return {name,note,fps:72/EVERY,linePts:LINE_PTS,rodPts:S.RN,frames};
}
const best={...STROKE2,arcDeg:25,strokeLen:0.25};
const wide={...STROKE2,arcDeg:48,strokeLen:0.25};
const clips=[
  record('1 — OLD CASTER (rotation only, 785 deg/s)',
    'No translation and 2.3x expert hand speed. This drove every earlier result.',
    t=>poseAt(t,STROKE), strokeDuration(STROKE)),
  record('2 — EXPERT-CALIBRATED (343 deg/s, 25 cm translation)',
    'Butt speed and rod deflection both inside the published expert band.',
    t=>poseAt2(t,best), strokeDuration2(best)),
  record('3 — TOO WIDE AN ARC (48 deg)',
    'Books say arc too wide for the rod bend opens the loop. Does it?',
    t=>poseAt2(t,wide), strokeDuration2(wide)),
];
writeFileSync('frames.json',JSON.stringify(clips));
for(const c of clips) console.log(`${c.name}: ${c.frames.length} frames, peak bend ${Math.max(...c.frames.map(f=>f.bend)).toFixed(0)}, peak defl ${Math.max(...c.frames.map(f=>f.defl))}cm`);
