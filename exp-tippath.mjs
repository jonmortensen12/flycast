import * as S from './sim.mjs';
import { poseAt2, strokeDuration2, STROKE2 } from './caster2.mjs';
const DT=1/72;
function tipRMS(arcDeg,strokeLen,startDeg){
  const s={...STROKE2,arcDeg,strokeLen,startDeg};
  S.applyPreset_(S.PHYSICAL); S.P.waterModel=0;
  S.rebuildSpacing(); S.rebuildRod(); S.rebuildMasses();
  const p0=poseAt2(0,s); S.setHand(p0.x,p0.y,p0.z,p0.q); S.resetCast();
  S.setLineHand(0.05,1.05,0.15,0);
  const tip=(S.RN-1)*3, path=[]; let defl=0;
  for(let i=0;i<Math.round(strokeDuration2(s)/DT);i++){
    const p=poseAt2(i*DT,s); S.setHand(p.x,p.y,p.z,p.q);
    S.stepInputs(DT); S.physics(DT);
    if(S.state().blewUp){S.clearBlewUp();return null;}
    if(p.phase==='forward'){
      path.push([S.rpos[tip+2],S.rpos[tip+1]]);
      let ux=S.rpos[3]-S.rpos[0],uy=S.rpos[4]-S.rpos[1],uz=S.rpos[5]-S.rpos[2];
      const ul=Math.hypot(ux,uy,uz)||1; ux/=ul;uy/=ul;uz/=ul;
      const d=Math.hypot(S.rpos[tip]-(S.rpos[0]+ux*S.ROD_LEN),
                         S.rpos[tip+1]-(S.rpos[1]+uy*S.ROD_LEN),
                         S.rpos[tip+2]-(S.rpos[2]+uz*S.ROD_LEN));
      if(d>defl)defl=d;
    }
  }
  const m=path.length; if(m<5) return null;
  const mx=path.reduce((a,p)=>a+p[0],0)/m, my=path.reduce((a,p)=>a+p[1],0)/m;
  let sxx=0,sxy=0,syy=0;
  for(const [x,y] of path){sxx+=(x-mx)**2;sxy+=(x-mx)*(y-my);syy+=(y-my)**2;}
  const th=0.5*Math.atan2(2*sxy,sxx-syy), nx=-Math.sin(th), ny=Math.cos(th);
  let s2=0; for(const [x,y] of path) s2+=((x-mx)*nx+(y-my)*ny)**2;
  return {rms:Math.sqrt(s2/m),defl};
}
const [arc,sl,sd]=process.argv.slice(2).map(Number);
const r=tipRMS(arc,sl,sd);
console.log(r?`arc ${arc}  stroke ${sl}m  start ${sd}deg  ->  tip RMS ${(r.rms*100).toFixed(1)} cm   defl ${(r.defl*100).toFixed(0)} cm`
             :`arc ${arc} stroke ${sl} BLEW`);
