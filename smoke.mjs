// Headless smoke test. Executes the module and ticks the animation loop with
// simulated controllers, so hand/line code paths actually run.
//
// The global object is a Proxy that reports any UNDECLARED identifier read.
// node --check cannot see those, and they have broken three builds so far:
// a ReferenceError in the render loop freezes the frame with no console.
import fs from 'fs'; import vm from 'vm';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const body=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
                .replace("import * as THREE from 'three';","");

/* --- minimal real maths so hand positions are numbers, not proxies --- */
class V3{
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
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
  applyQuaternion(){return this;}
  setFromMatrixPosition(){return this;}
  applyMatrix4(){return this;}
}
class Q{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}
  copy(){return this;} set(){return this;} invert(){return this;}
  multiply(){return this;} setFromEuler(){return this;} setFromRotationMatrix(){return this;}}
class Clock{getDelta(){return 1/72;} get elapsedTime(){return 0;}}
class E{constructor(){this.x=0;this.y=0;this.z=0;} setFromQuaternion(){return this;} set(){return this;}}

let loopCb=null; const listeners=[];
function node(name){
  const o={
    name, position:new V3(), quaternion:new Q(), rotation:{x:0,y:0,z:0,set(){},},
    scale:{setScalar(){}}, visible:true, userData:{}, children:[],
    material:{color:{setHex(){}},opacity:1}, geometry:{attributes:{position:{array:new Float32Array(64),needsUpdate:false}}},
    add(){}, lookAt(){}, rotateY(){}, updateMatrixWorld(){}, updateWorldMatrix(){},
    getWorldPosition(v){ if(v&&v.set) v.set(0.2,1.1,-0.3); return v||new V3(); },
    getWorldQuaternion(q){ return q||new Q(); },
    worldToLocal(v){ return v; }, localToWorld(v){ return v; },
    addEventListener(t,f){ listeners.push({name,t,f}); },
    removeFromParent(){}, traverse(){},
  };
  return o;
}
function proxy(name){
  const base=function(){};
  return new Proxy(base,{
    get(t,k){
      if(k===Symbol.toPrimitive) return ()=>0;
      if(k==='valueOf') return ()=>0;
      if(k==='toString') return ()=>name;
      if(k==='then') return undefined;
      if(k==='length'||k==='count') return 0;
      if(k==='array') return new Float32Array(64);
      if(k==='setAnimationLoop') return cb=>{loopCb=cb;};
      if(k==='getContext') return ()=>proxy('ctx');
      if(k==='measureText') return ()=>({width:10});
      if(k==='createLinearGradient'||k==='createRadialGradient') return ()=>proxy('grad');
      if(k==='getController'||k==='getControllerGrip') return i=>node('ctrl'+i);
      if(k==='intersectObjects'||k==='intersectObject') return ()=>[];
      return proxy(name+'.'+String(k));
    },
    set(){return true;}, apply(){return proxy(name+'()');},
    construct(t,args){
      if(name.endsWith('Vector3')) return new V3(args[0]||0,args[1]||0,args[2]||0);
      if(name.endsWith('Quaternion')) return new Q();
      if(name.endsWith('Euler')) return new E();
      if(name.endsWith('Clock')) return new Clock();
      return proxy('new '+name);
    },
    has(){return true;},
  });
}
const THREE=proxy('THREE');
THREE.Vector3=V3; THREE.Quaternion=Q; THREE.Euler=E;

const base={
  THREE, console, Math, JSON, Object, Array, Number, String, Boolean, Symbol, Error, Proxy,
  Reflect, Date, Float32Array, Float64Array, Int32Array, Uint8Array, Uint16Array, isNaN, parseFloat, parseInt,
  encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout,
  navigator:{xr:null,clipboard:null}, location:{hash:'',href:'x'}, window:{},
  innerWidth:1000, innerHeight:800, addEventListener(){}, requestAnimationFrame(){},
  document:{ createElement:()=>proxy('canvas'), body:{appendChild(){}},
    getElementById:()=>({classList:{add(){},remove(){}},addEventListener(){},style:{},
      set innerHTML(v){}, get innerHTML(){return '';}, set textContent(v){}, set disabled(v){}}) },
};
/* A Proxy global with has()->true makes every undeclared read resolve to
   undefined instead of throwing, which hides exactly the bug class this test
   exists to catch. Plain context: undeclared reads throw, as in the browser. */
const ctx=vm.createContext(base);

let fail=false;
try{ vm.runInContext(body,ctx,{filename:'flycast.js'}); console.log('module top level: OK'); }
catch(e){ console.log('TOP LEVEL THREW:',e.constructor.name+':',e.message); process.exit(1); }
if(!loopCb){ console.log('no animation loop registered'); process.exit(1); }

/* connect a left and a right controller with pressed triggers, so the line-hand
   code paths actually execute rather than sitting behind a null check */
/* trigger held, everything else released: net down, cork clamp off, so the
   line-hand paths are the ones under test */
const pad=()=>({buttons:[{pressed:true,value:1},{pressed:false,value:0},{pressed:false,value:0},
                         {pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0}],
                axes:[0,0,0.2,0.2], hapticActuators:[{pulse(){}}]});
for(const l of listeners){
  if(l.t!=='connected') continue;
  const left=l.name==='ctrl1';
  try{ l.f({data:{handedness:left?'left':'right', gamepad:pad()}}); }catch(e){}
}
for(let i=0;i<6;i++){
  try{ loopCb(); }
  catch(e){
    fail=true;
    console.log(`frame ${i+1} THREW: ${e.constructor.name}: ${e.message}`);
    console.log(e.stack.split('\n').slice(0,4).join('\n'));
    break;
  }
}
if(!fail) console.log('animation loop: 6 frames OK (controllers connected, triggers held)');
if(!fail) console.log('(undeclared identifier reads would have thrown above)');
