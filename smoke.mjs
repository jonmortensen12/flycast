// Executes the module with stubbed THREE + DOM and ticks the animation loop.
// Catches ReferenceErrors and TypeErrors that node --check cannot see.
import fs from 'fs';
import vm from 'vm';

const html = fs.readFileSync('./index.html','utf8');
const body = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
                 .replace("import * as THREE from 'three';","");

let loopCb=null;
const num = () => 0;
function stub(name){
  const f = function(){ return mk(name); };
  return mk(name, f);
}
function mk(name, target){
  const base = target || function(){};
  return new Proxy(base, {
    get(t,k){
      if(k===Symbol.toPrimitive) return ()=>0;
      if(k==='valueOf') return ()=>0;
      if(k==='toString') return ()=>name;
      if(k==='then') return undefined;
      if(k==='length') return 0;
      if(k==='count') return 0;
      if(k==='setAnimationLoop') return cb=>{loopCb=cb;};
      if(k==='getContext') return ()=>mk('ctx');
      if(k==='measureText') return ()=>({width:10});
      if(k==='createLinearGradient'||k==='createRadialGradient') return ()=>mk('grad');
      if(k==='array') return new Float32Array(64);
      if(k==='attributes') return mk('attrs');
      if(k==='children') return [mk('c0'),mk('c1')];
      if(k==='userData') { t.__ud = t.__ud || {}; return t.__ud; }
      return mk(name+'.'+String(k));
    },
    set(){ return true; },
    apply(){ return mk(name+'()'); },
    construct(){ return mk('new '+name); },
    has(){ return true; },
  });
}
const THREE = mk('THREE');
const canvasEl = mk('canvas');
const document = {
  createElement:()=>canvasEl,
  body:{appendChild:()=>{}},
  getElementById:()=>({classList:{add(){},remove(){}},addEventListener(){},style:{},
                       set innerHTML(v){}, get innerHTML(){return '';}, set textContent(v){}, set disabled(v){}}),
};
const ctx = {
  THREE, document, console,
  navigator:{xr:null, clipboard:null},
  location:{hash:'',href:'x'},
  window:{}, innerWidth:1000, innerHeight:800,
  addEventListener:()=>{}, requestAnimationFrame:()=>{},
  Math, Float32Array, Float64Array, Int32Array, Object, Array, JSON, Number, String, Boolean,
  isNaN, parseFloat, parseInt, Symbol, Error, Proxy, Reflect, Date, encodeURIComponent, decodeURIComponent,
};
ctx.globalThis = ctx;
vm.createContext(ctx);
try{
  vm.runInContext(body, ctx, {filename:'flycast.js'});
  console.log('module top level: OK');
}catch(e){
  console.log('TOP LEVEL THREW:', e.constructor.name+':', e.message);
  console.log(e.stack.split('\n').slice(0,4).join('\n'));
  process.exit(1);
}
if(!loopCb){ console.log('no animation loop registered'); process.exit(1); }
let ok=true;
for(let i=0;i<3;i++){
  try{ loopCb(); }
  catch(e){
    ok=false;
    console.log(`frame ${i+1} THREW: ${e.constructor.name}: ${e.message}`);
    console.log(e.stack.split('\n').slice(0,5).join('\n'));
    break;
  }
}
if(ok) console.log('animation loop: 3 frames OK');
