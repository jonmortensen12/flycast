/* Minimal harness: stub Three.js and the DOM with enough real maths to execute
   the module top-level and catch undeclared identifiers / TDZ errors. */
import fs from 'fs';
import vm from 'vm';

const V3=class{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
  clone(){return new V3(this.x,this.y,this.z);}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
  subVectors(a,b){this.x=a.x-b.x;this.y=a.y-b.y;this.z=a.z-b.z;return this;}
  addVectors(a,b){this.x=a.x+b.x;this.y=a.y+b.y;this.z=a.z+b.z;return this;}
  multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
  addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
  length(){return Math.hypot(this.x,this.y,this.z);}
  lengthSq(){return this.x**2+this.y**2+this.z**2;}
  normalize(){const l=this.length()||1;return this.multiplyScalar(1/l);}
  distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}
  dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
  cross(v){return this.crossVectors(this.clone(),v);}
  crossVectors(a,b){this.x=a.y*b.z-a.z*b.y;this.y=a.z*b.x-a.x*b.z;this.z=a.x*b.y-a.y*b.x;return this;}
  lerp(v,t){this.x+=(v.x-this.x)*t;this.y+=(v.y-this.y)*t;this.z+=(v.z-this.z)*t;return this;}
  applyQuaternion(){return this;} applyMatrix4(){return this;} setScalar(s){return this.set(s,s,s);}
  setFromMatrixPosition(){return this;} negate(){return this.multiplyScalar(-1);}
  toArray(){return [this.x,this.y,this.z];} min(){return this;} max(){return this;}
  setLength(l){return this.normalize().multiplyScalar(l);} equals(){return false;}
  transformDirection(){return this;} project(){return this;} unproject(){return this;}
};
const V2=class{constructor(x=0,y=0){this.x=x;this.y=y;}
  set(x,y){this.x=x;this.y=y;return this;} copy(v){this.x=v.x;this.y=v.y;return this;}
  clone(){return new V2(this.x,this.y);} length(){return Math.hypot(this.x,this.y);}
  normalize(){const l=this.length()||1;this.x/=l;this.y/=l;return this;}
  add(v){this.x+=v.x;this.y+=v.y;return this;} dot(v){return this.x*v.x+this.y*v.y;}
  lerp(v,t){this.x+=(v.x-this.x)*t;this.y+=(v.y-this.y)*t;return this;}
  setScalar(s){this.x=s;this.y=s;return this;}
  sub(v){this.x-=v.x;this.y-=v.y;return this;} multiplyScalar(s){this.x*=s;this.y*=s;return this;}};
const V4=class{constructor(x=0,y=0,z=0,w=0){this.x=x;this.y=y;this.z=z;this.w=w;}
  set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;}};
const Q=class{constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w;}
  set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;}
  copy(q){return this.set(q.x,q.y,q.z,q.w);} clone(){return new Q(this.x,this.y,this.z,this.w);}
  setFromAxisAngle(a,r){const h=r/2,s=Math.sin(h);return this.set(a.x*s,a.y*s,a.z*s,Math.cos(h));}
  setFromEuler(){return this;} setFromUnitVectors(){return this;} multiply(){return this;}
  premultiply(){return this;} invert(){return this;} slerp(){return this;} normalize(){return this;}
  setFromRotationMatrix(){return this;}};
const E=class{constructor(x=0,y=0,z=0,o='XYZ'){this.x=x;this.y=y;this.z=z;this.order=o;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} setFromQuaternion(){return this;}};

class Obj3D{
  constructor(){this.position=new V3();this.rotation=new E();this.quaternion=new Q();
    this.scale=new V3(1,1,1);this.children=[];this.visible=true;this.userData={};
    this.matrixWorld={elements:new Array(16).fill(0)};this.material=null;this.geometry=null;}
  add(...o){for(const c of o) if(c) this.children.push(c);return this;}
  remove(){return this;} clear(){this.children.length=0;return this;}
  getWorldPosition(v){return v.copy(this.position);}
  getWorldQuaternion(q){return q;} getWorldDirection(v){return v;}
  lookAt(){} traverse(f){f(this);for(const c of this.children)c.traverse&&c.traverse(f);}
  updateMatrixWorld(){} localToWorld(v){return v;} worldToLocal(v){return v;}
  attach(o){return this.add(o);} removeFromParent(){return this;}
  applyMatrix4(){return this;} rotateX(){return this;} translate(){return this;}
  setRotationFromQuaternion(){}
  addEventListener(t,f){(this._ev||(this._ev={}))[t]=f;}
  removeEventListener(){} dispatchEvent(e){const f=this._ev&&this._ev[e.type];if(f)f(e);}
}
function attr(arr,item){return {array:arr,itemSize:item,count:arr.length/item,needsUpdate:false,
  setXYZ(){},setXY(){},setX(){},setY(){},setZ(){},setW(){},
  getX(i){return arr[i*item]||0;},getY(i){return arr[i*item+1]||0;},getZ(i){return arr[i*item+2]||0;},
  setUsage(){return this;},applyMatrix4(){return this;}};}
class Geo extends Obj3D{
  constructor(n=64){super();this.attributes={
      position:attr(new Float32Array(n*3),3),
      normal:attr(new Float32Array(n*3),3),
      uv:attr(new Float32Array(n*2),2)};
    this.index=null;this.boundingSphere=null;}
  setAttribute(n,a){this.attributes[n]=a;return this;}
  getAttribute(n){return this.attributes[n];}
  setIndex(){return this;} setDrawRange(a,b){this.drawRange={start:a,count:b};} computeVertexNormals(){}
  computeBoundingSphere(){} dispose(){} rotateX(){return this;} translate(){return this;}
  scale(){return this;} clone(){const g=new Geo();for(const k in this.attributes)g.attributes[k]=this.attributes[k];return g;}
  toNonIndexed(){return this.clone();}
}
function planeAttrs(n){const g=new Geo();
  g.setAttribute('position',attr(new Float32Array(n*3),3));
  g.setAttribute('uv',attr(new Float32Array(n*2),2));
  g.setAttribute('normal',attr(new Float32Array(n*3),3));return g;}

const THREE={
  Vector2:V2,Vector3:V3,Vector4:V4,Quaternion:Q,Euler:E,Object3D:Obj3D,Group:Obj3D,
  Scene:class extends Obj3D{constructor(){super();this.background=null;this.fog=null;}},
  PerspectiveCamera:class extends Obj3D{constructor(){super();this.fov=70;}updateProjectionMatrix(){}},
  OrthographicCamera:class extends Obj3D{updateProjectionMatrix(){}},
  BufferGeometry:Geo,
  PlaneGeometry:class extends Geo{constructor(w,h,a=1,b=1){super();
    const n=(a+1)*(b+1);this.setAttribute('position',attr(new Float32Array(n*3),3));
    this.setAttribute('uv',attr(new Float32Array(n*2),2));
    this.setAttribute('normal',attr(new Float32Array(n*3),3));}},
  SphereGeometry:class extends Geo{constructor(){super();
    this.setAttribute('position',attr(new Float32Array(300),3));
    this.setAttribute('uv',attr(new Float32Array(200),2));
    this.setAttribute('normal',attr(new Float32Array(300),3));}},
  CylinderGeometry:class extends Geo{constructor(){super();
    this.setAttribute('position',attr(new Float32Array(300),3));
    this.setAttribute('uv',attr(new Float32Array(200),2));
    this.setAttribute('normal',attr(new Float32Array(300),3));}},
  BoxGeometry:class extends Geo{},ConeGeometry:class extends Geo{},
  TorusGeometry:class extends Geo{},RingGeometry:class extends Geo{},
  OctahedronGeometry:class extends Geo{},IcosahedronGeometry:class extends Geo{},
  DodecahedronGeometry:class extends Geo{},TetrahedronGeometry:class extends Geo{},
  CapsuleGeometry:class extends Geo{},TorusKnotGeometry:class extends Geo{},
  PolyhedronGeometry:class extends Geo{},WireframeGeometry:class extends Geo{},
  CircleGeometry:class extends Geo{},TubeGeometry:class extends Geo{},
  LatheGeometry:class extends Geo{},ShapeGeometry:class extends Geo{},
  ExtrudeGeometry:class extends Geo{},EdgesGeometry:class extends Geo{},
  Mesh:class extends Obj3D{constructor(g,m){super();this.geometry=g||new Geo();this.material=m||{};}},
  InstancedMesh:class extends Obj3D{constructor(g,m,c){super();this.geometry=g;this.material=m;this.count=c;this.instanceMatrix={needsUpdate:false,setUsage(){return this;}};this.instanceColor={needsUpdate:false};}setMatrixAt(){}setColorAt(){}},
  Points:class extends Obj3D{constructor(g,m){super();this.geometry=g;this.material=m;}},
  Line:class extends Obj3D{constructor(g,m){super();this.geometry=g;this.material=m;}},
  LineSegments:class extends Obj3D{constructor(g,m){super();this.geometry=g;this.material=m;}},
  LineLoop:class extends Obj3D{constructor(g,m){super();this.geometry=g;this.material=m;}},
  Sprite:class extends Obj3D{},
  BufferAttribute:function(a,i){return attr(a,i);},
  Float32BufferAttribute:function(a,i){return attr(Float32Array.from(a),i);},
  InstancedBufferAttribute:function(a,i){return attr(a,i);},
  Color:class{constructor(c){this.r=1;this.g=1;this.b=1;this._h=c;}
    set(){return this;}setHex(){return this;}setHSL(){return this;}
    setRGB(r,g,b){this.r=r;this.g=g;this.b=b;return this;}
    clone(){return new THREE.Color();}lerp(){return this;}copy(){return this;}
    getHex(){return 0;}convertSRGBToLinear(){return this;}multiplyScalar(){return this;}},
  Sphere:class{constructor(c,r){this.center=c;this.radius=r;}},
  Box3:class{setFromObject(){return this;}getSize(v){return v;}getCenter(v){return v;}},
  Matrix4:class{constructor(){this.elements=new Array(16).fill(0);}
    makeRotationFromQuaternion(){return this;}makeRotationFromEuler(){return this;}makeRotationX(){return this;}makeRotationY(){return this;}makeRotationZ(){return this;}makeRotationAxis(){return this;}lookAt(){return this;}scale(){return this;}premultiply(){return this;}clone(){return new THREE.Matrix4();}compose(){return this;}identity(){return this;}
    setPosition(){return this;}multiply(){return this;}invert(){return this;}copy(){return this;}
    makeTranslation(){return this;}makeScale(){return this;}extractRotation(){return this;}},
  Raycaster:class{set(){}setFromCamera(){}intersectObject(){return [];}intersectObjects(){return [];}},
  Clock:class{constructor(){this.t=0;}getDelta(){return 1/72;}getElapsedTime(){this.t+=1/72;return this.t;}},
  DataTexture:class{constructor(d,w,h){this.image={data:d,width:w,height:h};this.needsUpdate=false;}dispose(){}},
  CanvasTexture:class{constructor(){this.needsUpdate=false;this.wrapS=0;this.wrapT=0;this.repeat=new V2(1,1);}dispose(){}},
  Texture:class{constructor(){this.needsUpdate=false;this.repeat=new V2(1,1);}dispose(){}},
  WebGLRenderTarget:class{constructor(w,h,o){this.width=w;this.height=h;this.texture={};this.options=o;}dispose(){}setSize(){}},
  ShaderMaterial:class M{constructor(o={}){Object.assign(this,o);this.uniforms=o.uniforms||{};this.userData={};}dispose(){}clone(){const c=new THREE.ShaderMaterial(this);c.uniforms={};for(const k in this.uniforms)c.uniforms[k]={value:this.uniforms[k].value};c.userData={};return c;}onBeforeCompile(){}},
  RawShaderMaterial:class M{constructor(o={}){Object.assign(this,o);this.uniforms=o.uniforms||{};this.userData={};}dispose(){}clone(){const c=new THREE.ShaderMaterial(this);c.uniforms={};for(const k in this.uniforms)c.uniforms[k]={value:this.uniforms[k].value};c.userData={};return c;}onBeforeCompile(){}},
  MeshStandardMaterial:class{constructor(o={}){Object.assign(this,o);this.userData={};if(!(this.color instanceof THREE.Color))this.color=new THREE.Color(this.color);if(this.emissive!==undefined&&!(this.emissive instanceof THREE.Color))this.emissive=new THREE.Color(this.emissive);}dispose(){}clone(){return new THREE.MeshStandardMaterial(this);}onBeforeCompile(){}},
  MeshPhysicalMaterial:class{constructor(o={}){Object.assign(this,o);this.userData={};if(!(this.color instanceof THREE.Color))this.color=new THREE.Color(this.color);if(this.emissive!==undefined&&!(this.emissive instanceof THREE.Color))this.emissive=new THREE.Color(this.emissive);}dispose(){}clone(){return new THREE.MeshPhysicalMaterial(this);}onBeforeCompile(){}},
  MeshBasicMaterial:class{constructor(o={}){Object.assign(this,o);this.userData={};if(!(this.color instanceof THREE.Color))this.color=new THREE.Color(this.color);if(this.emissive!==undefined&&!(this.emissive instanceof THREE.Color))this.emissive=new THREE.Color(this.emissive);}dispose(){}clone(){return new THREE.MeshBasicMaterial(this);}onBeforeCompile(){}},
  MeshLambertMaterial:class{constructor(o={}){Object.assign(this,o);this.userData={};if(!(this.color instanceof THREE.Color))this.color=new THREE.Color(this.color);if(this.emissive!==undefined&&!(this.emissive instanceof THREE.Color))this.emissive=new THREE.Color(this.emissive);}dispose(){}clone(){return new THREE.MeshLambertMaterial(this);}onBeforeCompile(){}},
  PointsMaterial:class{constructor(o={}){Object.assign(this,o);this.userData={};if(!(this.color instanceof THREE.Color))this.color=new THREE.Color(this.color);if(this.emissive!==undefined&&!(this.emissive instanceof THREE.Color))this.emissive=new THREE.Color(this.emissive);}dispose(){}clone(){return new THREE.PointsMaterial(this);}onBeforeCompile(){}},
  LineBasicMaterial:class{constructor(o={}){Object.assign(this,o);this.userData={};if(!(this.color instanceof THREE.Color))this.color=new THREE.Color(this.color);if(this.emissive!==undefined&&!(this.emissive instanceof THREE.Color))this.emissive=new THREE.Color(this.emissive);}dispose(){}clone(){return new THREE.LineBasicMaterial(this);}onBeforeCompile(){}},
  SpriteMaterial:class{constructor(o={}){Object.assign(this,o);this.userData={};if(!(this.color instanceof THREE.Color))this.color=new THREE.Color(this.color);if(this.emissive!==undefined&&!(this.emissive instanceof THREE.Color))this.emissive=new THREE.Color(this.emissive);}dispose(){}clone(){return new THREE.SpriteMaterial(this);}onBeforeCompile(){}},
  AmbientLight:class extends Obj3D{},DirectionalLight:class extends Obj3D{constructor(){super();this.shadow={mapSize:new V2(),camera:{}};this.target=new Obj3D();}},
  HemisphereLight:class extends Obj3D{},PointLight:class extends Obj3D{},Fog:class{},FogExp2:class{},
  CatmullRomCurve3:class{constructor(p){this.points=p;}getPoint(){return new V3();}getPoints(){return [new V3()];}},
  Curve:class{},Shape:class{moveTo(){}lineTo(){}quadraticCurveTo(){}absarc(){}},
  Path:class{},
  MathUtils:{lerp:(a,b,t)=>a+(b-a)*t,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    degToRad:d=>d*Math.PI/180,randFloat:(a,b)=>a+(b-a)*0.5,randFloatSpread:r=>0},
  WebGLRenderer:class{
    constructor(){
      const ctl=[],grp=[];
      const pad=(hand)=>({
        handedness:hand,
        gamepad:{
          /* NOT every button pressed: an earlier harness did that, which raised
             the net and skipped the line-hand path entirely, and missed a bug
             that lived only in that branch. Triggers held, everything else off. */
          buttons:Array.from({length:8},(_,i)=>({value:i===0?0.6:0,pressed:i===0})),
          axes:[0,0,0.4,0.3]
        }});
      this.xr={enabled:false,isPresenting:false,
        getController:(i)=>(ctl[i]||(ctl[i]=new Obj3D())),
        getControllerGrip:(i)=>(grp[i]||(grp[i]=new Obj3D())),
        connectAll(){
          ctl[0]&&ctl[0].dispatchEvent({type:'connected',data:pad('right')});
          ctl[1]&&ctl[1].dispatchEvent({type:'connected',data:pad('left')});
        },
        setReferenceSpaceType(){},setFoveation(){},setSession(){},getSession(){return null;},
        addEventListener(){}};
      this.shadowMap={enabled:false,type:0};this.capabilities={isWebGL2:true,maxTextureSize:4096};
      this.extensions={has:()=>true,get:()=>({})};this.domElement={style:{},addEventListener(){}};
      this.info={render:{}};this.outputColorSpace=0;this.toneMapping=0;this.autoClear=true;
      this._rt=null;}
    setSize(){}setPixelRatio(){}setAnimationLoop(f){this._loop=f;}
    render(){this._rendered=(this._rendered||0)+1;}
    setRenderTarget(t){this._rt=t;}getRenderTarget(){return this._rt;}
    getContext(){return {};}compile(){}dispose(){}setClearColor(){}
    getClearAlpha(){return 1;}clear(){this._clears=(this._clears||0)+1;}
  },
  SRGBColorSpace:'srgb',LinearSRGBColorSpace:'lsrgb',ACESFilmicToneMapping:1,
  RGBAFormat:1023,RedFormat:1,RGFormat:2,UnsignedByteType:1009,FloatType:1015,HalfFloatType:1016,
  LinearFilter:1006,NearestFilter:1003,LinearMipmapLinearFilter:1008,
  RepeatWrapping:1000,ClampToEdgeWrapping:1001,MirroredRepeatWrapping:1002,
  DoubleSide:2,FrontSide:0,BackSide:1,AdditiveBlending:2,NormalBlending:1,
  PCFSoftShadowMap:2,NoToneMapping:0,DynamicDrawUsage:35048,
  Line3:class{},Plane:class{},Triangle:class{},Frustum:class{},
};

/* --- DOM --- */
function mkCanvas(){
  const ctx={canvas:null,fillStyle:'',strokeStyle:'',lineWidth:1,globalAlpha:1,font:'',
    textAlign:'',textBaseline:'',lineCap:'',lineJoin:'',shadowBlur:0,shadowColor:'',
    globalCompositeOperation:'',filter:'',
    fillRect(){},strokeRect(){},clearRect(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},
    arc(){},ellipse(){},quadraticCurveTo(){},bezierCurveTo(){},fill(){},stroke(){},save(){},
    restore(){},translate(){},rotate(){},scale(){},fillText(){},strokeText(){},
    measureText(){return {width:10};},drawImage(){},setTransform(){},clip(){},rect(){},
    createLinearGradient(){return {addColorStop(){}};},
    createRadialGradient(){return {addColorStop(){}};},
    createPattern(){return {};},
    getImageData(w,h){return {data:new Uint8ClampedArray(4*256*256),width:256,height:256};},
    putImageData(){},createImageData(w,h){return {data:new Uint8ClampedArray(4*(w||1)*(h||1)),width:w,height:h};}};
  const c={width:256,height:256,style:{},getContext(){return ctx;},toDataURL(){return '';},
    addEventListener(){},removeEventListener(){},appendChild(){},
    getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}};
  ctx.canvas=c;return c;
}
const el=()=>({style:{},classList:{add(){},remove(){},toggle(){}},dataset:{},
  addEventListener(){},removeEventListener(){},appendChild(){},remove(){},
  setAttribute(){},getContext(){return mkCanvas().getContext();},
  textContent:'',innerHTML:'',value:'',disabled:false,width:256,height:256,
  getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}});
const document={
  createElement(t){return t==='canvas'?mkCanvas():el();},
  createElementNS(){return el();},
  getElementById(){return el();},querySelector(){return el();},
  querySelectorAll(){return [];},addEventListener(){},removeEventListener(){},
  body:{appendChild(){},style:{}},documentElement:{style:{}},exitPointerLock(){},
};

const src=fs.readFileSync('index.html','utf8');
const code=src.slice(src.indexOf('<script type="module">')+22, src.lastIndexOf('</script>'))
  .replace("import * as THREE from 'three';","");

const seen=new Set();
const base={THREE,document,console,Math,JSON,Date,Object,Array,Number,String,Boolean,
  Float32Array,Float64Array,Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int32Array,Int8Array,Int16Array,
  Promise,Error,isNaN,isFinite,parseFloat,parseInt,Set,Map,Symbol,RegExp,
  innerWidth:1280,innerHeight:720,devicePixelRatio:2,
  requestAnimationFrame:()=>0,cancelAnimationFrame(){},
  setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
  performance:{now:()=>Date.now()},
  navigator:{userAgent:'node',xr:{isSessionSupported:async()=>false,requestSession:async()=>({})},
    clipboard:{writeText:async()=>{}}},
  location:{hash:'',href:'http://x/',search:''},history:{replaceState(){}},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  AudioContext:class{constructor(){this.destination={};this.currentTime=0;this.sampleRate=48000;this.state='running';}
    createGain(){return {gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}},connect(){},disconnect(){}};}
    createBiquadFilter(){return {frequency:{value:0,setValueAtTime(){}},Q:{value:0},type:'',connect(){},disconnect(){}};}
    createOscillator(){return {frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},type:'',connect(){},disconnect(){},start(){},stop(){}};}
    createBufferSource(){return {buffer:null,loop:false,playbackRate:{value:1},connect(){},disconnect(){},start(){},stop(){}};}
    createBuffer(c,l,r){return {getChannelData:()=>new Float32Array(l),length:l,sampleRate:r};}
    createDynamicsCompressor(){return {threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(){},disconnect(){}};}
    createStereoPanner(){return {pan:{value:0},connect(){},disconnect(){}};}
    createConvolver(){return {buffer:null,connect(){},disconnect(){}};}
    resume(){return Promise.resolve();}},
  addEventListener(){},removeEventListener(){},
  XRRigidTransform:class{},
};
base.window=base; base.self=base; base.globalThis=base;
const sandbox=new Proxy(base,{
  has(){return true;},
  get(t,k){
    if(k in t) return t[k];
    if(typeof k==='string'&&!seen.has(k)){seen.add(k);
      console.log('  UNDECLARED READ:',k);}
    return undefined;
  }
});
vm.createContext(sandbox);
try{
  vm.runInContext(code,sandbox,{filename:'index.html'});
  console.log('module executed');
}catch(e){ console.log('THROW:',e.message); console.log(e.stack.split('\n').slice(0,4).join('\n')); process.exit(1); }

/* Read the shipped defaults HERE, before any probe below touches P. Read at the
   end instead and you are reading whatever the last test left behind — which is
   exactly what happened the first time this check was written. */
const shipped=vm.runInContext(`(()=>{const o={};for(const k in P)o[k]=P[k];return o;})()`,sandbox);
console.log('shipped defaults:',{keys:Object.keys(shipped).length,
  clarity:shipped.clarity, waterOpaque:shipped.waterOpaque,
  water:[shipped.watR,shipped.watG,shipped.watB],
  ripple:shipped.ripple, ripOpacity:shipped.ripOpacity, ripStain:shipped.ripStain,
  standWave:shipped.standWave, speckBudget:shipped.speckBudget,
  waterDetail:shipped.waterDetail, specks:shipped.specks, speckBright:shipped.speckBright});

/* connect both hands with triggers held, then tick frames */
try{
  vm.runInContext('renderer.xr.connectAll();',sandbox);
  const loop=vm.runInContext('renderer._loop',sandbox);
  for(let f=0;f<8;f++) loop();
  console.log('8 frames ticked with both controllers connected');
}catch(e){ console.log('FRAME THROW:',e.message); console.log(e.stack.split('\n').slice(0,6).join('\n')); process.exit(1); }

/* did the water actually solve, and does the texture now refresh? */
const probe=vm.runInContext(`(()=>{
  let vmax=0,vsum=0,n=0;
  for(let k=0;k<gu.length;k++){ if(gsolid[k])continue;
    const s=Math.hypot(gu[k],gv[k]); if(s>vmax)vmax=s; vsum+=s; n++; }
  let tmax=0;
  for(let k=0;k<gridTexData.length;k+=4){
    const t=(gridTexData[k]/255-0.5)*2; tmax=Math.max(tmax,Math.abs(t)*Math.abs(t)*8);
  }
  return {cells:n, meanV:vsum/n, maxV:vmax, texMaxV:tmax,
          gpuSpecks:gsOK, drawn:gSpeckGeo.drawRange?0:0,
          filmMid:filmY(0,-9,1), stillMid:surfY(0)};
})()`,sandbox);
console.log('defaults      ',probe);

/* the actual complaint: turn the flow and the grade up and see whether what the
   GPU reads still matches what the solver computes */
vm.runInContext('P.current=1.40; P.grade=2.50;',sandbox);
const loop2=vm.runInContext('renderer._loop',sandbox);
for(let f=0;f<200;f++) loop2();
const hot=vm.runInContext(`(()=>{
  let vmax=0,vsum=0,n=0;
  for(let k=0;k<gu.length;k++){ if(gsolid[k])continue;
    const s=Math.hypot(gu[k],gv[k]); if(s>vmax)vmax=s; vsum+=s; n++; }
  let tmax=0,tsum=0;
  for(let k=0,c=0;k<gridTexData.length;k+=4,c++){
    if(gsolid[c])continue;
    const t=(gridTexData[k]/255-0.5)*2, u=Math.sign(t)*t*t*8;
    tmax=Math.max(tmax,Math.abs(u)); tsum+=Math.abs(u);
  }
  return {meanV:vsum/n, maxV:vmax, texMeanV:tsum/n, texMaxV:tmax,
          drawRange:gSpeckGeo.drawRange, speckVerts:GSPECK*3};
})()`,sandbox);
console.log('current 1.4 / grade 2.5', hot);

/* line still sane, and the analytic fallback now agrees with the solver
   instead of flatlining at 2.2 */
const fin=vm.runInContext(`(()=>{
  let bad=0;
  for(let i=0;i<nAct*3;i++) if(!Number.isFinite(pos[i])) bad++;
  const cmp=[];
  for(const x of [-38,-36,-30,0,30,36,38]){
    computeFlow(x,-9); const g=Math.hypot(flowX,flowZ);
    analyticFlow(x,-9); const a=Math.hypot(flowX,flowZ);
    cmp.push({x, blended:+g.toFixed(2), analyticOnly:+a.toFixed(2)});
  }
  return {blewUp, nAct, nonFinite:bad, gridMs:+gridMs.toFixed(2), cmp};
})()`,sandbox);
console.log('line + fallback', fin.blewUp, 'nAct',fin.nAct, 'nonFinite',fin.nonFinite, 'gridMs',fin.gridMs);
console.table(fin.cmp);

/* the new per-step cost: gridTexUpdate now actually runs. Desktop numbers, so
   scale up for the headset, but the ratio between them is what matters. */
const perf=vm.runInContext(`(()=>{
  const t0=Date.now(); for(let i=0;i<200;i++) gridStep(1/20); const tStep=(Date.now()-t0)/200;
  const t1=Date.now(); for(let i=0;i<200;i++) gridFoam(1/20); const tFoam=(Date.now()-t1)/200;
  const t2=Date.now(); for(let i=0;i<200;i++) gridTexUpdate(); const tTex=(Date.now()-t2)/200;
  return {cells:GNX*GNZ, stepMs:+tStep.toFixed(3), foamMs:+tFoam.toFixed(3), texMs:+tTex.toFixed(3)};
})()`,sandbox);
console.log('per solver step (desktop)',perf);

/* the CPU speck path must now be shaded from the same numbers as the GPU one */
const cpu=vm.runInContext(`(()=>{
  P.speckGPU=0;
  return null;
})()`,sandbox);
const loop3=vm.runInContext('renderer._loop',sandbox);
for(let f=0;f<12;f++) loop3();
const sp=vm.runInContext(`(()=>{
  let n=0,fr=0,frMax=0,bad=0,zero=0;
  const vis=Math.floor(SPECK*P.specks);
  for(let i=0;i<vis;i++){
    const p=i*3, f=spFlow[p+2];
    if(!Number.isFinite(f)||f<0) bad++;
    if(spFlow[p]===0&&spFlow[p+1]===0) zero++;
    fr+=f; frMax=Math.max(frMax,f); n++;
  }
  return {particles:n, meanFroude:+(fr/n).toFixed(3), maxFroude:+frMax.toFixed(2),
          nonFinite:bad, neverUpdated:zero,
          hasFlowAttr:!!speckGeo.attributes.aFlow};
})()`,sandbox);
console.log('CPU speck shading inputs (current 1.4 / grade 2.5)',sp);

vm.runInContext('P.current=0.55; P.grade=1.00;',sandbox);
const loop4=vm.runInContext('renderer._loop',sandbox);
for(let f=0;f<250;f++) loop4();
const dist=vm.runInContext(`(()=>{
  const b=[0,0,0,0,0]; let n=0,sum=0;
  const vis=Math.floor(SPECK*P.specks);
  for(let i=0;i<vis;i++){
    const f=spFlow[i*3+2]; if(!Number.isFinite(f))continue;
    sum+=f; n++;
    b[f<0.25?0:f<0.45?1:f<0.65?2:f<0.85?3:4]++;
  }
  return {meanFroude:+(sum/n).toFixed(3),
    'slick <0.25':b[0], '0.25-0.45':b[1], '0.45-0.65':b[2], '0.65-0.85':b[3], 'crest >0.85':b[4]};
})()`,sandbox);
console.log('Froude spread at DEFAULTS',dist);

/* colour: every named look, checked for a sane spectrum and a distinct hue */
const col=vm.runInContext(`(()=>{
  const rows=[];
  for(let i=0;i<WATER_LOOKS.length;i++){
    const [name,vals]=WATER_LOOKS[i];
    applyPreset(vals); renderer._loop();
    const e=waterMat.uniforms.uExt.value, D=waterMat.uniforms.uDeep.value;
    const T=d=>[Math.exp(-e.x*d),Math.exp(-e.y*d),Math.exp(-e.z*d)];
    const a=d=>Math.min(0.96,(1-Math.exp(-d*1.6/Math.max(P.clarity,0.05)))*P.waterOpaque);
    rows.push({look:name,
      'ext R/G/B':[e.x,e.y,e.z].map(v=>+v.toFixed(2)).join(' / '),
      'meanExt':+(((e.x+e.y+e.z)/3)*Math.max(P.clarity,0.2)).toFixed(2),
      'T@1.2m':T(1.2).map(v=>+v.toFixed(2)).join(' / '),
      'alpha@1.2':+a(1.2).toFixed(2)});
  }
  return rows;
})()`,sandbox);
console.table(col);

/* count the vertex-shader texture fetches the speck draw actually costs, so a
   budget change is a number and not a hope */
const budget=vm.runInContext(`(()=>{
  const heads=GSPECK, trails=GSPECK*2;
  /* head: state + fieldAt + surfaceDev.  trail: state + 2 flowAt + fieldAt + surfaceDev */
  const perHead=3, perTrail=5;
  return {specks:GSPECK, points:GSPECK*3,
    vertexFetches:heads*perHead+trails*perTrail,
    updatePassPixels:GS_W*GS_W,
    drawRange:gSpeckGeo.drawRange};
})()`,sandbox);
console.log('speck draw budget',budget);

/* the budget is a setting now: change it, tick, confirm everything resized
   together and that a no-op change does NOT reallocate */
const rt=vm.runInContext(`(()=>{
  const rows=[]; let allocs=0;
  const realDispose=gsRT[0].dispose;
  const probe=(label)=>rows.push({step:label, GS_W, GSPECK,
    rtW:gsRT[0].width, refCount:gSpeckGeo.attributes.aRef.count,
    drawCount:gSpeckGeo.drawRange.count,
    consistent:(GSPECK===GS_W*GS_W)&&(gsRT[0].width===GS_W)
               &&(gSpeckGeo.attributes.aRef.count===GSPECK*3)});
  probe('start');
  P.speckBudget=256; onSettingChanged('speckBudget'); renderer._loop(); probe('budget 256 via slider');
  const before=gsRT[0];
  P.speckBudget=256; onSettingChanged('speckBudget'); renderer._loop(); probe('same value again');
  const noRealloc=(gsRT[0]===before);
  P.speckBudget=48;  onSettingChanged('speckBudget'); renderer._loop(); probe('budget 48 via slider');
  P.speckBudget=1024; onSettingChanged('speckBudget'); renderer._loop(); probe('budget 1024 via slider');
  P.speckBudget=160; onSettingChanged('speckBudget'); renderer._loop(); probe('back to 160');
  return {rows, noReallocOnSameValue:noRealloc};
})()`,sandbox);
console.table(rt.rows);
console.log('no realloc when value unchanged:',rt.noReallocOnSameValue);

/* standing waves must appear where the specks draw crests and nowhere else —
   same Froude band, so the two cues agree by construction */
const sw=vm.runInContext(`(()=>{
  const band=fr=>Math.max(0,Math.min(1,(fr-0.55)/0.50))*(1-Math.max(0,Math.min(1,(fr-1.9)/1.3)));
  const crest=fr=>Math.max(0,Math.min(1,(fr-0.25)/0.60));   /* speck fragment */
  const rows=[];
  for(const fr of [0.2,0.5,0.8,1.0,1.5,2.5,3.5]){
    const sp=fr*Math.sqrt(9.81*0.5);
    rows.push({Fr:fr, 'speck crestness':+crest(fr).toFixed(2),
      'standing wave':+band(fr).toFixed(2),
      'wavelength m':+Math.max(2*Math.PI*sp*sp/9.81,0.22).toFixed(2)});
  }
  return rows;
})()`,sandbox);
console.table(sw);

/* the ripple map: does the pass run, follow the camera, snap to texels, and
   leave the visible draw range alone? */
const rip=vm.runInContext(`(()=>{
  P.ripple=1.0; P.specks=0.5; P.speckGPU=1;
  const loop=renderer._loop; loop();
  const a={min:[ripUni.uMin.value.x,ripUni.uMin.value.y],
           size:ripUni.uSize.value.x,
           drawAfter:gSpeckGeo.drawRange.count,
           bound:waterMat.uniforms.uRipple.value!==null,
           amt:waterMat.uniforms.uRipAmt.value};
  /* walk downstream and confirm the map follows and stays texel-snapped */
  camera.position.x+=7.3; loop();   /* _camW is refreshed from the camera each frame */
  const tex=P.rippleSpan/512;
  const snapped=Math.abs(ripUni.uMin.value.x/tex-Math.round(ripUni.uMin.value.x/tex))<1e-3;
  const moved=Math.abs(ripUni.uMin.value.x-a.min[0])>1.0;
  /* specks hidden entirely: the map must still be produced */
  P.specks=0.0; P.speckBright=0.0; loop();
  const stillOn=waterMat.uniforms.uRipAmt.value>0.5;
  /* and off when the setting is off */
  P.ripple=0.0; loop();
  const off=waterMat.uniforms.uRipAmt.value===0&&waterMat.uniforms.uRipO.value===0;
  P.ripple=1.0; P.specks=0.5; P.speckBright=1.0;
  /* the tint must follow the water when stained and hold when not */
  P.ripple=1.0; P.ripOpacity=0.8; P.ripR=1;P.ripG=1;P.ripB=1;
  P.ripStain=0.0; P.watR=0.6;P.watG=0.1;P.watB=0.1; loop();
  const unstained=[waterMat.uniforms.uRipC.value.r,waterMat.uniforms.uRipC.value.b];
  P.ripStain=1.0; loop();
  const stained=[waterMat.uniforms.uRipC.value.r,waterMat.uniforms.uRipC.value.b];
  P.ripStain=0.35; P.watR=0.114;P.watG=0.247;P.watB=0.263; P.ripOpacity=0.0;
  return {mapBound:a.bound, ripAmt:a.amt, visibleDrawRange:a.drawAfter,
          tintHoldsAtStain0:Math.abs(unstained[0]-unstained[1])<0.02,
          tintFollowsWaterAtStain1:stained[0]>stained[1]+0.05,
          followsCamera:moved, texelSnapped:snapped,
          worksWithSpecksHidden:stillOn, offWhenZero:off};
})()`,sandbox);
console.log('ripple map',rip);

console.log('OK');
