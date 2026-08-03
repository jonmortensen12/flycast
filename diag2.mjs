// Reproduces a hooked-fish fight headlessly and traces the line bookkeeping.
import fs from 'fs'; import vm from 'vm';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
let body=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';","");
// expose internals for inspection (same script, so it closes over them)
body+=`
globalThis.__reset=()=>resetCast();
globalThis.__grid=()=>({GNX,GNZ,gdx,GX0,GZ0,gu,gv,gh,gsolid,ready:gridReady});
globalThis.__flowAt=(x,z)=>{computeFlow(x,z);return{u:flowX,v:flowZ};};
globalThis.__step=(n,dt)=>{for(let i=0;i<n;i++)gridStep(dt);};
globalThis.__probes=()=>({probeOut,probeIn,probeThr,fishTension,handArc,handIdx,handMode});
globalThis.__dbg=()=>({lineOut,offSpool,rodArc,slack:offSpool-lineOut-rodArc,
  tension:M.tension,probeOut,hooked:hooked?hooked.beh:null,
  fishX:hooked?hooked.p.x:null,fishD:hooked?Math.hypot(hooked.p.x-rpos[0],hooked.p.z-rpos[2]):null,
  slipOut,spoolOut,reeling,handMode,handIdx,nAct});
globalThis.__hook=()=>runAction('!hookfish');
globalThis.__set=(k,v)=>{P[k]=v;};
globalThis.__note=()=>note;
globalThis.__geom=()=>{
  const tipIdx=Math.floor(idxAt(lineOut));
  let mat=0,maxStretch=0,worst=-1;
  for(let i=0;i<tipIdx;i++){
    const r=restOf(i),A=i*3,B=A+3;
    const d=Math.hypot(pos[B]-pos[A],pos[B+1]-pos[A+1],pos[B+2]-pos[A+2]);
    mat+=r;
    const st=d/r; if(st>maxStretch){maxStretch=st;worst=i;}
  }
  const T=(RN-1)*3;
  const straight=Math.hypot(pos[0]-rpos[T],pos[1]-rpos[T+1],pos[2]-rpos[T+2]);
  return{tipIdx,material:mat,straight,maxStretch,worst,lineOut,
    probeI0:probeI[0],restAtProbe:restOf(probeI[0]),
    dAtProbe:Math.hypot(pos[probeI[0]*3+3]-pos[probeI[0]*3],
                        pos[probeI[0]*3+4]-pos[probeI[0]*3+1],
                        pos[probeI[0]*3+5]-pos[probeI[0]*3+2])};
};
globalThis.__arr=()=>({pos,vel,invM,rpos,rvel,nAct,probeLam,probeI,
  fish:hooked?{p:hooked.p,v:hooked.v,beh:hooked.beh}:null});
globalThis.__resets=0; globalThis.__firstBad=null;
const _sanity=sanity;
sanity=function(){
  if(globalThis.__firstBad===null){
    for(let i=0;i<nAct;i++){const p=i*3;
      if(!Number.isFinite(pos[p])||!Number.isFinite(pos[p+1])||!Number.isFinite(pos[p+2])||
         !Number.isFinite(vel[p])||!Number.isFinite(vel[p+1])||!Number.isFinite(vel[p+2])){
        globalThis.__firstBad={node:i,invM:invM[i],invMnext:invM[i+1],
          pos:[pos[p],pos[p+1],pos[p+2]],vel:[vel[p],vel[p+1],vel[p+2]],
          probeOut,probeI0:probeI[0],lam0:probeLam[0],
          fish:hooked?{p:{...hooked.p},v:{...hooked.v},beh:hooked.beh}:null};
        break;
      }
    }
  }
  return _sanity();
};
const _reset=resetCast;
resetCast=function(){globalThis.__resets++;return _reset.apply(this,arguments);};
`;
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
 copy(v){this.x=v.x||0;this.y=v.y||0;this.z=v.z||0;return this;}
 clone(){return new V3(this.x,this.y,this.z);}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
 sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
 subVectors(a,b){this.x=a.x-b.x;this.y=a.y-b.y;this.z=a.z-b.z;return this;}
 addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
 multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
 length(){return Math.hypot(this.x,this.y,this.z);}
 normalize(){const l=this.length()||1;return this.multiplyScalar(1/l);}
 distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}
 dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
 applyQuaternion(){return this;} setFromMatrixPosition(){return this;} applyMatrix4(){return this;}}
class Q{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}copy(){return this;}set(){return this;}
 invert(){return this;}multiply(){return this;}setFromEuler(){return this;}setFromRotationMatrix(){return this;}}
class E{constructor(){this.x=0;this.y=0;this.z=0;}setFromQuaternion(){return this;}set(){return this;}}
class Clock{getDelta(){return 1/72;} get elapsedTime(){return 0;}}
let loopCb=null; const listeners=[];
const HANDPOS=new V3(0.25,1.05,-0.25);
function nodeObj(name){return{name,position:new V3(),quaternion:new Q(),
 rotation:{x:0,y:0,z:0,set(){}},scale:{setScalar(){}},visible:true,userData:{},
 children:[{material:{color:{setHex(){}}},position:new V3()},{material:{color:{setHex(){}}},position:new V3()}],
 material:{color:{setHex(){}},opacity:1},
 geometry:{attributes:{position:{array:new Float32Array(64),needsUpdate:false}}},
 add(){},lookAt(){},rotateY(){},updateMatrixWorld(){},updateWorldMatrix(){},
 getWorldPosition(v){const p=name==='ctrl1'?HANDPOS:new V3(0.2,1.15,-0.3);
   if(v&&v.set)v.set(p.x,p.y,p.z);return v||p;},
 getWorldQuaternion(q){return q||new Q();},
 worldToLocal(v){return v;},localToWorld(v){return v;},
 addEventListener(t,f){listeners.push({name,t,f});},removeFromParent(){},traverse(){}};}
function proxy(name){const base=function(){};return new Proxy(base,{
 get(t,k){if(k===Symbol.toPrimitive)return()=>0;if(k==='valueOf')return()=>0;
  if(k==='toString')return()=>name;if(k==='then')return undefined;
  if(k==='length'||k==='count')return 0;if(k==='array')return new Float32Array(64);
  if(k==='setAnimationLoop')return cb=>{loopCb=cb;};
  if(k==='getContext')return()=>proxy('ctx');
  if(k==='measureText')return()=>({width:10});
  if(k==='createLinearGradient'||k==='createRadialGradient')return()=>proxy('grad');
  if(k==='getController'||k==='getControllerGrip')return i=>nodeObj('ctrl'+i);
  if(k==='intersectObjects'||k==='intersectObject')return()=>[];
  return proxy(name+'.'+String(k));},
 set(){return true;},apply(){return proxy(name+'()');},
 construct(t,a){if(name.endsWith('Vector3'))return new V3(a[0]||0,a[1]||0,a[2]||0);
  if(name.endsWith('Quaternion'))return new Q();if(name.endsWith('Euler'))return new E();
  if(name.endsWith('Clock'))return new Clock();
  return proxy('new '+name);},has(){return true;}});}
const THREE=proxy('THREE');
THREE.Vector3=V3;THREE.Quaternion=Q;THREE.Euler=E;THREE.Clock=Clock;
const base={THREE,console,Math,JSON,Object,Array,Number,String,Boolean,Symbol,Error,Proxy,Reflect,
 Date,Float32Array,Float64Array,Int32Array,Uint8Array,Uint16Array,isNaN,parseFloat,parseInt,encodeURIComponent,
 decodeURIComponent,setTimeout,clearTimeout,globalThis:null,
 navigator:{xr:null,clipboard:null},location:{hash:'',href:'x'},window:{},
 innerWidth:1000,innerHeight:800,addEventListener(){},requestAnimationFrame(){},
 document:{createElement:()=>proxy('canvas'),body:{appendChild(){}},
  getElementById:()=>({classList:{add(){},remove(){}},addEventListener(){},style:{},
   set innerHTML(v){},get innerHTML(){return'';},set textContent(v){},set disabled(v){}})}};
base.globalThis=base;
const ctx=vm.createContext(base);
vm.runInContext(body,ctx,{filename:'flycast.js'});
/* the app stores e.data.gamepad once, so the pad object must be live */
const mkPad=()=>({buttons:Array.from({length:6},()=>({pressed:false,value:0})),
  axes:[0,0,0,0],hapticActuators:[{pulse(){}}]});
const padL=mkPad(), padR=mkPad();
const setTrig=(p,v)=>{p.buttons[0].value=v;p.buttons[0].pressed=v>0.5;};
for(const l of listeners){ if(l.t!=='connected')continue;
  const left=l.name==='ctrl1';
  l.f({data:{handedness:left?'left':'right',gamepad:left?padL:padR}}); }
const tick=n=>{for(let i=0;i<n;i++) loopCb();};
tick(30);
function scan(tag){
  const a=base.__arr();
  const bad=[];
  for(let i=0;i<a.nAct;i++){const p=i*3;
    for(let c=0;c<3;c++){
      if(!Number.isFinite(a.pos[p+c])||!Number.isFinite(a.vel[p+c])){bad.push(i);break;}
    }
  }
  for(let i=0;i<12;i++){const p=i*3;
    for(let c=0;c<3;c++) if(!Number.isFinite(a.rpos[p+c])||!Number.isFinite(a.rvel[p+c])){bad.push('rod'+i);break;}
  }
  if(a.fish){
    if(!Number.isFinite(a.fish.p.x)||!Number.isFinite(a.fish.v.x)) bad.push('fish');
  }
  if(bad.length) console.log(tag,'non-finite at:',bad.slice(0,8).join(','),
    ' probeLam0=',a.probeLam[0],' probeI0=',a.probeI[0],
    ' fish=',a.fish?JSON.stringify({p:a.fish.p,v:a.fish.v}):null);
  return bad.length;
}
base.__hook();
console.log('immediately after hook, before any tick:');
scan('  ');
for(let f=0;f<5;f++){ tick(1); if(scan('  frame'+(f+1))) break; }
console.log('resets so far:',base.__resets);
console.log('first non-finite:',JSON.stringify(base.__firstBad,null,1));
console.log('hooked:',JSON.stringify(base.__dbg()));
console.log();
console.log('--- holding the reel trigger for 4 seconds ---');
setTrig(padR,1);
console.log('t(s)  lineOut  slack  tension  fishDist  beh');
for(let f=0;f<288;f++){ tick(1);
  if(f%36===0){const d=base.__dbg();
    console.log((f/72).toFixed(1).padStart(4),
      (d.lineOut??0).toFixed(2).padStart(8),(d.slack??0).toFixed(2).padStart(7),
      (d.tension??0).toFixed(2).padStart(8),(d.fishD??0).toFixed(2).padStart(9),' ',d.hooked,' ',base.__note());}}
console.log();
const g=base.__geom();
console.log('GEOMETRY at the end:');
console.log('  material from fly to tiptop :',g.material.toFixed(2),'m   (lineOut says',g.lineOut.toFixed(2),'m)');
console.log('  straight fly-to-rod-tip     :',g.straight.toFixed(2),'m');
console.log('  worst segment stretch       :',g.maxStretch.toFixed(2),'x at node',g.worst,'of',g.tipIdx);
console.log('  probe segment',g.probeI0,': rest',g.restAtProbe.toFixed(3),'actual',g.dAtProbe.toFixed(3),
            ' -> stretch',(g.dAtProbe/g.restAtProbe).toFixed(2)+'x');


console.log();
console.log('=== WATER GRID ===');
base.__set('waterModel',1);
const G=base.__grid();
console.log('grid',G.GNX+'x'+G.GNZ,'cell',G.gdx,'m   ready:',G.ready);
base.__step(400,1/20);
const solid=G.gsolid.reduce((a,b)=>a+b,0);
console.log('solid/dry cells:',solid,'of',G.GNX*G.GNZ);
console.log();
console.log('cross-channel profile at x=-20 (should be fast mid-channel, zero at banks):');
let line='  ';
for(let z=-15.5;z<=-2.5;z+=1.3){const f=base.__flowAt(-20,z);
  line+=f.u.toFixed(2).padStart(6);}
console.log(line);
console.log();
console.log('down-channel profile along the thalweg (z=-9), riffles vs pools:');
console.log('   x     depth   speed');
for(let x=-34;x<=34;x+=6){
  const f=base.__flowAt(x,-9);
  const i=Math.round((x-G.GX0)/G.gdx-0.5), j=Math.round((-9-G.GZ0)/G.gdx-0.5);
  const h=G.gh[i+j*G.GNX];
  console.log(String(x).padStart(5),h.toFixed(2).padStart(8),Math.hypot(f.u,f.v).toFixed(2).padStart(8));
}
console.log();
console.log('wake behind the rock at x=-7.0 z=-7.6 (r=0.85):');
console.log('   dx    u(m/s)   v(m/s)   |v|');
for(const dx of [-2,-1,0,1,2,3,5]){
  const f=base.__flowAt(-7.0+dx,-7.6);
  console.log(String(dx).padStart(5),f.u.toFixed(2).padStart(9),f.v.toFixed(2).padStart(9),Math.hypot(f.u,f.v).toFixed(2).padStart(6));
}
console.log();
console.log('lateral deflection beside the rock (x=-7, z sweep):');
for(const dz of [-1.6,-1.1,0,1.1,1.6]){
  const f=base.__flowAt(-7.0,-7.6+dz);
  console.log('  dz',String(dz).padStart(5),' u',f.u.toFixed(2),' v',f.v.toFixed(2));
}
