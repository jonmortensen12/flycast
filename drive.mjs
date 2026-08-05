import * as S from '/home/claude/sim/sim.mjs';
import { Quaternion, Vector3 } from '/home/claude/sim/three-stub.mjs';
import { readFileSync, writeFileSync } from 'fs';
const K = JSON.parse(readFileSync('/home/claude/vid/kin_in.json'));
const cfg = JSON.parse(process.argv[2] || '{}');
const outName = process.argv[3];
const DEG=Math.PI/180, X=new Vector3(1,0,0), q=new Quaternion();
const t=K.t, ang=K.ang, pxm=K.pxm;
// video pixels -> metres; +x in image is downrange (sim -Z), +y in image is down
const zz=K.hx.map(v=>-(v-K.hx[0])/pxm), yy=K.hy.map(v=>-(v-K.hy[0])/pxm);
function pose(x){
  let i=0; while(i<t.length-2 && t[i+1]<x) i++;
  const f=Math.min(1,Math.max(0,(x-t[i])/Math.max(t[i+1]-t[i],1e-6)));
  return [ang[i]+(ang[i+1]-ang[i])*f, yy[i]+(yy[i+1]-yy[i])*f, zz[i]+(zz[i+1]-zz[i])*f];
}
S.applyPreset_(S.PHYSICAL); S.applyPreset_(cfg); S.P.waterModel=0;
S.rebuildSpacing(); S.rebuildRod(); S.rebuildMasses();
let [a0,y0,z0]=pose(0);
q.setFromAxisAngle(X,a0*DEG);
S.setHand(0.28,1.15+y0,0.10+z0,q); S.resetCast(); S.setLineHand(0.05,1.05,0.15,0);
const DT=1/240, frames=[]; let wi=0;
for(let k=0;k*DT<=t[t.length-1]+DT;k++){
  const x=k*DT, [a,y,z]=pose(x);
  q.setFromAxisAngle(X,a*DEG);
  S.setHand(0.28,1.15+y,0.10+z,q);
  S.stepInputs(DT); S.physics(DT);
  if(S.state().blewUp) S.clearBlewUp();
  while(wi<t.length && t[wi]<=x){
    const st=S.state();
    const rod=[]; for(let i=0;i<S.RN;i++) rod.push([+S.rpos[i*3+2].toFixed(4),+S.rpos[i*3+1].toFixed(4)]);
    const last=Math.min(st.nAct-1,Math.floor(S.idxAt(st.lineOut))), line=[];
    for(let j=0;j<90;j++){
      const arc=st.lineOut*j/89, f=Math.min(last-1e-3,Math.max(0,S.idxAt(arc)));
      const ai=Math.max(0,Math.floor(f)), bi=Math.min(last,ai+1), u=f-ai;
      line.push([+(S.pos[ai*3+2]+(S.pos[bi*3+2]-S.pos[ai*3+2])*u).toFixed(4),
                 +(S.pos[ai*3+1]+(S.pos[bi*3+1]-S.pos[ai*3+1])*u).toFixed(4)]);
    }
    frames.push({rod,line}); wi++;
  }
}
while(frames.length<t.length) frames.push(frames[frames.length-1]);
writeFileSync(outName, JSON.stringify(frames));
console.log(outName,'frames',frames.length);
