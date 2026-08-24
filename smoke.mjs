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
  /* Real. It used to return `this` untouched, which meant the rod could not
     be rotated: `_off.set(0,0,NEXT_Z).applyQuaternion(_q)` came back unchanged,
     so the blank pointed along -Z whatever the wrist did. A casting game whose
     harness cannot turn the rod is a harness that has never seen a cast. With
     an identity quaternion this is a no-op, so nothing that was passing
     changes — it only makes rotation reachable. */
  applyQuaternion(q){
    const x=this.x,y=this.y,z=this.z,qx=q.x,qy=q.y,qz=q.z,qw=q.w;
    const ix=qw*x+qy*z-qz*y, iy=qw*y+qz*x-qx*z,
          iz=qw*z+qx*y-qy*x, iw=-qx*x-qy*y-qz*z;
    this.x=ix*qw+iw*-qx+iy*-qz-iz*-qy;
    this.y=iy*qw+iw*-qy+iz*-qx-ix*-qz;
    this.z=iz*qw+iw*-qz+ix*-qy-iy*-qx;
    return this;
  }
  applyMatrix4(){return this;} setScalar(s){return this.set(s,s,s);}
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
  setFromEuler(){return this;} setFromUnitVectors(){return this;}
  multiplyQuaternions(a,b){
    const ax=a.x,ay=a.y,az=a.z,aw=a.w, bx=b.x,by=b.y,bz=b.z,bw=b.w;
    return this.set(ax*bw+aw*bx+ay*bz-az*by, ay*bw+aw*by+az*bx-ax*bz,
                    az*bw+aw*bz+ax*by-ay*bx, aw*bw-ax*bx-ay*by-az*bz);
  }
  multiply(q){return this.multiplyQuaternions(this,q);}
  premultiply(q){return this.multiplyQuaternions(q,this);}
  invert(){return this.set(-this.x,-this.y,-this.z,this.w);}
  slerp(){return this;} normalize(){return this;}
  setFromRotationMatrix(){return this;}};
const E=class{constructor(x=0,y=0,z=0,o='XYZ'){this.x=x;this.y=y;this.z=z;this.order=o;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} setFromQuaternion(){return this;}};

class Obj3D{
  constructor(){this.position=new V3();this.rotation=new E();this.quaternion=new Q();
    this.scale=new V3(1,1,1);this.children=[];this.visible=true;this.userData={};
    this.matrixWorld={elements:new Array(16).fill(0)};this.material=null;this.geometry=null;}
  add(...o){for(const c of o) if(c){c.parent=this;this.children.push(c);}return this;}
  /* Real. `remove()` returning `this` and doing nothing is the third stub in
     this file to answer wrongly rather than fail — after the `has` trap and
     applyQuaternion — and it hid the same class of bug: code that takes a mesh
     out of one parent and puts it in another could not be checked at all,
     because nothing ever came out. */
  remove(...o){for(const c of o){const i=this.children.indexOf(c);
    if(i>=0){this.children.splice(i,1);c.parent=null;}} return this;}
  clear(){for(const c of this.children) c.parent=null;
    this.children.length=0;return this;}
  /* Walk the parents. This used to return the LOCAL position, which pinned
     every hand, panel and reel to the world origin however far the rig had
     walked — so moving the rig reached nothing the simulation can feel, and a
     teleport under load looked free in here while yanking the rod eight metres
     in the headset. Rotation stays stubbed out; positions are what the physics
     reads. */
  getWorldPosition(v){v.copy(this.position);
    /* yaw as well as offset. Every parent in this scene graph is either the
       scene (unrotated) or the player rig (yaw only), so a yaw-only walk is
       exact here — and without it snapTurn cannot be checked at all, because
       the whole point of that code is that the rig's rotation and its new
       origin cancel at the head. */
    for(let p=this.parent;p;p=p.parent){
      const a=p.rotation?p.rotation.y:0;
      if(a){const c=Math.cos(a),si=Math.sin(a),x=v.x,z=v.z;
            v.x=x*c+z*si; v.z=-x*si+z*c;}
      v.add(p.position);
    }
    return v;}
  /* Compose the chain instead of handing back whatever was already in q —
     which is how `_q` used to keep a stale value forever. Identity parents
     make this the grip's own rotation, i.e. exactly what it was. */
  getWorldQuaternion(q){q.copy(this.quaternion);
    for(let p=this.parent;p;p=p.parent) q.premultiply(p.quaternion);
    return q;}
  getWorldDirection(v){return v;}
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
  /* A REAL colour, not a plausible one. This used to answer setHex() with
     itself and getHex() with 0, which is precisely the stub shape the handoff
     warns about: nothing throws, everything reports health, and any code that
     computes a colour is untestable in here. The hooked-fish tension ramp is
     exactly that code. */
  Color:class{constructor(c){this.r=1;this.g=1;this.b=1;if(typeof c==='number')this.setHex(c);}
    set(c){if(typeof c==='number')this.setHex(c);return this;}
    setHex(h){h=Math.floor(h)||0;this.r=((h>>16)&255)/255;this.g=((h>>8)&255)/255;this.b=(h&255)/255;return this;}
    setRGB(r,g,b){this.r=r;this.g=g;this.b=b;return this;}
    setHSL(h,s2,l){
      if(s2===0){this.r=this.g=this.b=l;return this;}
      const q=l<0.5?l*(1+s2):l+s2-l*s2, p2=2*l-q;
      const hue=(t)=>{t=(t%1+1)%1;
        if(t<1/6)return p2+(q-p2)*6*t;
        if(t<1/2)return q;
        if(t<2/3)return p2+(q-p2)*(2/3-t)*6;
        return p2;};
      this.r=hue(h+1/3);this.g=hue(h);this.b=hue(h-1/3);return this;}
    clone(){return new THREE.Color().copy(this);}
    lerp(c,t){this.r+=(c.r-this.r)*t;this.g+=(c.g-this.g)*t;this.b+=(c.b-this.b)*t;return this;}
    copy(c){this.r=c.r;this.g=c.g;this.b=c.b;return this;}
    getHex(){const q=v=>Math.max(0,Math.min(255,Math.round(v*255)));
      return (q(this.r)<<16)|(q(this.g)<<8)|q(this.b);}
    convertSRGBToLinear(){return this;}
    multiplyScalar(s){this.r*=s;this.g*=s;this.b*=s;return this;}},
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
  /* the URL restore path reads these. They were missing, so the whole
     `#s=...` block threw on the first line and was swallowed by its own
     try/catch — the harness reported a clean boot while never once
     exercising the code that carries your settings between sessions. */
  decodeURIComponent,encodeURIComponent,
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
/* The Proxy below answers `has` with true for EVERYTHING, which is what lets it
   report an undeclared read instead of throwing — and that also swallows the
   language's own globals, because they live on the context's intrinsics rather
   than on this object. `Infinity` came back as undefined, so a perfectly
   ordinary `let stop=Infinity` inside the game turned into NaN and quietly took
   six presentation-zone assertions down with it. They are globals, not
   undeclared variables: put them on the table. */
base.Infinity=Infinity; base.NaN=NaN; base.undefined=undefined;
base.parseFloat=parseFloat; base.parseInt=parseInt; base.isFinite=isFinite; base.isNaN=isNaN;
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

/* Menu layout. This failure mode is silent: rowRect() maps row 22 onto the same
   pixel as row 11, so an overgrown tab draws settings on top of each other with
   nothing thrown and nothing logged. Twelve tabs is cheap to check; finding it
   by eye in a headset is not. */
const menu=vm.runInContext(`(()=>{
  const cap=PERCOL*2, over=[], collide=[];
  for(let t=0;t<TABS.length;t++){
    const tab=TABS[t];
    if(tab.rows.length>cap) over.push(tab.name+' ('+tab.rows.length+'/'+cap+')');
    const seen={}; const save=selTab; selTab=t;
    for(const i of tab.rows){
      const r=rowRect(i); if(!r) continue;
      const k=r.x+'x'+r.y;
      if(seen[k]!==undefined) collide.push(tab.name+': '+MENU[i][0]+' on '+MENU[seen[k]][0]);
      else seen[k]=i;
    }
    selTab=save;
  }
  return {tabs:TABS.length, cap, overflowing:over, overlapping:collide.slice(0,6),
          overlapCount:collide.length};
})()`,sandbox);
console.log('menu layout',menu);
if(menu.overflowing.length||menu.overlapCount) console.log('  *** MENU LAYOUT FAILURE ***');

/* Venue hot swap. Venues used to reload the page, which in a headset means
   leaving VR; they now swap in place, and this is the check that everything
   venue-shaped actually followed — and, just as important, that everything
   TACKLE-shaped did not. */
const venue=vm.runInContext(`(()=>{
  const loop=renderer._loop;
  const snap=()=>({venue:SCENE_ID, halfw:HALFW, gz1:+GZ1.toFixed(2),
    obst:OBST.length, obstMeshes:obstMeshes.length, obstDrawn:obstGroup.children.length,
    canopy:CANOPY.length, lies:LIES.length, fishes:fishes.length,
    zones:zoneRings.length, bedKey:bedMat.customProgramCacheKey(),
    obstInFlowGLSL:(GLSL_FLOW.match(/const vec4 OB/g)||[]).length});
  const shaderHash=()=>VENUE_SHADERS.map(e=>{
    const s=e.mat.vertexShader+e.mat.fragmentShader; let a=0;
    for(let i=0;i<s.length;i++) a=(a*31+s.charCodeAt(i))>>>0;
    return a; }).join(',');
  const boot=shaderHash();
  /* set tackle and the speck budget, then travel */
  P.speckBudget=112; P.lineWt=6.5; P.tippet=27; P.nodeLen=0.12;
  onSettingChanged('speckBudget'); loop();
  const rows=[snap()];
  for(const v of ['alder','pond','falls','cedar']){
    runAction('!venue:'+v);
    for(let f=0;f<40;f++) loop();
    rows.push(snap());
  }
  const consistent=rows.every(r=>r.obst===r.obstMeshes&&r.obst===r.obstDrawn
    &&r.obst===r.obstInFlowGLSL&&r.lies===r.fishes&&r.lies===r.zones
    &&r.bedKey==='flycast-bed-1:'+r.venue);
  /* let the last transition run all the way out: fade down, settle the new
     river a few solver steps a frame, fade back up. Nothing may be left
     holding the screen black or half-settled. */
  let drain=0;
  while((venueFade>0||venueSettle>0)&&drain<400){ loop(); drain++; }
  const sig=r=>JSON.stringify(r);
  return {rows, consistent, drainFrames:drain,
    transitionCompletes:venueFade===0&&venueSettle===0&&gridReady,
    distinctReaches:new Set(rows.map(r=>r.venue+':'+r.halfw+':'+r.gz1)).size,
    /* coming back to a reach has to reproduce it exactly, or something is
       accumulating across swaps */
    returnsIdentical:sig(rows[0])===sig(rows[rows.length-1]),
    /* every venue GLSL block put back exactly where it came from */
    shaderRoundTrip:shaderHash()===boot,
    noStrayTokens:!VENUE_SHADERS.some(e=>/@surf|@flow|@scene/.test(e.mat.vertexShader+e.mat.fragmentShader)),
    /* the point of the exercise: your gear survived four venue changes */
    tackleKept:P.lineWt===6.5&&P.tippet===27&&P.nodeLen===0.12,
    budgetKept:P.speckBudget===112&&GS_W===112&&gsRT[0].width===112,
    venueOwnedApplied:P.branchOn===0&&P.specks===0.16};
})()`,sandbox);
console.table(venue.rows);
console.log('venue hot swap',{consistent:venue.consistent, distinctReaches:venue.distinctReaches,
  returnsIdentical:venue.returnsIdentical,
  transitionCompletes:venue.transitionCompletes, drainFrames:venue.drainFrames,
  shaderRoundTrip:venue.shaderRoundTrip, noStrayTokens:venue.noStrayTokens,
  tackleKept:venue.tackleKept, budgetKept:venue.budgetKept,
  venueOwnedApplied:venue.venueOwnedApplied});
if(!(venue.consistent&&venue.shaderRoundTrip&&venue.noStrayTokens&&venue.tackleKept
     &&venue.budgetKept&&venue.venueOwnedApplied&&venue.returnsIdentical
     &&venue.transitionCompletes&&venue.distinctReaches===4))
  console.log('  *** VENUE SWAP FAILURE ***');

/* ── the lap, and the boat that rides it ─────────────────────────────────
   A looping venue is one reach of river that repeats over `SC.loop` metres, so
   the boat can be lifted off one end of the lap and set down at the other with
   nothing changing. Four claims hold that up, and every one of them is the
   kind that fails silently — a wavelength that does not divide the period, a
   rock without its images, a fish standing next to the join, a rig that gets
   carried the wrong way — and shows up as a world that flickers once every
   two minutes, which is exactly the bug nobody can reproduce on demand. */
const drift=vm.runInContext(`(()=>{
  const out={};
  applyVenue('drift');
  const L=SC.loop; out.loop=L;
  /* 1. THE WATER COMES BACK TO ITSELF. Centreline, width and depth over one
     lap, and the bed a lap apart differing by exactly one lap of fall. */
  const fall=surfY(-L*0.5)-surfY(L*0.5);
  let dzE=0,hwE=0,depE=0,bedE=0;
  for(let x=-L*0.5;x<L*0.5;x+=1.5){
    dzE=Math.max(dzE,Math.abs(SC.dz(x)-SC.dz(x+L)));
    hwE=Math.max(hwE,Math.abs(SC.hw(x)-SC.hw(x+L)));
    for(let zr=-9;zr<=9;zr+=3){
      depE=Math.max(depE,Math.abs(SC.dep(x,zr)-SC.dep(x+L,zr)));
      bedE=Math.max(bedE,Math.abs((bedY(x,CZ+zr)-bedY(x+L,CZ+zr))-fall));
    }
  }
  out.periodic={dz:+dzE.toFixed(5),hw:+hwE.toFixed(5),dep:+depE.toFixed(5),
                bed:+bedE.toFixed(5),fall:+fall.toFixed(4)};
  out.reachRepeats = dzE<2e-4 && hwE<2e-4 && depE<2e-4 && bedE<2e-4 && fall>0;

  /* 2. EVERY SOLID THING HAS ITS IMAGES, a lap up and a lap down, so the world
     across the join is the same world. Exactly a third of the list is the
     middle copy, and that is the third with a neighbour on both sides. */
  const same=(a,b)=>Math.abs(a.z-b.z)<1e-6&&Math.abs(a.r-b.r)<1e-6&&a.kind===b.kind;
  let both=0;
  for(const o of OBST){
    const up=OBST.some(q=>Math.abs(q.x-(o.x-L))<1e-6&&same(q,o));
    const dn=OBST.some(q=>Math.abs(q.x-(o.x+L))<1e-6&&same(q,o));
    if(up&&dn) both++;
  }
  out.rocks={total:OBST.length, withBothImages:both};
  out.everySolidThingRepeats = OBST.length>0 && both*3===OBST.length;

  /* 3. AND NOTHING ALIVE STANDS NEXT TO THE JOIN. The fish are the one thing
     not copied — six of them is the whole reach — so a lie near the seam is a
     box and a post appearing out of nothing as you cross. */
  let nearest=1e9;
  for(const l of SC.lies) nearest=Math.min(nearest,L*0.5-Math.abs(l.x));
  out.nearestFishToTheJoin=+nearest.toFixed(1);
  out.fishKeepClearOfTheJoin = nearest>=12;

  /* 4. THE JOIN CARRIES WHAT YOU ARE HOLDING. Measured against the boat and
     against the local film, so a lap that moved the rig by the wrong amount —
     or forgot the fall — shows up as the fly sitting somewhere else. */
  for(let i=0;i<40;i++) renderer._loop();
  out.aboard=boatOn;
  out.ridesTheWater=Math.abs(player.position.y-(surfY(boatP.x)+SC.boat.free))<1e-6;
  const rel=()=>({fly:+(pos[0]-boatP.x).toFixed(4),
                  flyUp:+(pos[1]-surfY(pos[0])).toFixed(4),
                  tip:+(rpos[(RN-1)*3]-boatP.x).toFixed(4),
                  tipUp:+(rpos[(RN-1)*3+1]-surfY(boatP.x)).toFixed(4),
                  z:+(pos[2]-boatP.z).toFixed(4)});
  const D=L*0.5+0.2-boatP.x;
  boatP.x+=D; player.position.x+=D; loopCarry(D,0);
  const a=rel();
  loopWrap();
  const b=rel();
  out.before=a; out.after=b; out.laps=M.laps||0;
  out.carriedAcross = out.laps===1 &&
    Math.abs(a.fly-b.fly)<1e-3 && Math.abs(a.flyUp-b.flyUp)<1e-3 &&
    Math.abs(a.tip-b.tip)<1e-3 && Math.abs(a.tipUp-b.tipUp)<1e-3 &&
    Math.abs(a.z-b.z)<1e-3;

  /* 5. AND THE STICK CANNOT WALK YOU OUT OF THE BOAT. It is the oars here: it
     moves the hull, and you go with the hull. */
  const off=()=>[+(player.position.x-boatP.x).toFixed(4),+(player.position.z-boatP.z).toFixed(4)];
  const o0=off();
  if(offPad){ offPad.axes[2]=1; offPad.axes[3]=-1; }
  for(let i=0;i<30;i++) renderer._loop();
  if(offPad){ offPad.axes[2]=0; offPad.axes[3]=0; }
  const o1=off();
  out.rigStaysInTheBoat = Math.abs(o0[0]-o1[0])<1e-3 && Math.abs(o0[1]-o1[1])<1e-3;

  applyVenue('cedar');
  out.leftAshore = !boatOn;
  return out;
})()`,sandbox);
console.log('the lap, and the boat',drift);
if(!drift.reachRepeats||!drift.everySolidThingRepeats||!drift.fishKeepClearOfTheJoin||
   !drift.aboard||!drift.ridesTheWater||!drift.carriedAcross||!drift.rigStaysInTheBoat||
   !drift.leftAshore)
  console.log('  *** BOAT DRIFT FAILURE ***');

/* The settings string is what carries your tackle into a shared link and back.
   It never used to be tested here at all, because decodeURIComponent was not in
   the sandbox and the whole restore block threw on its first line. */
const roundTrip=vm.runInContext(`(()=>{
  /* deliberately all NON-venue keys: the budget, the line, the leader and the
     reel are yours. A venue-owned key like speckSize is supposed to be
     overwritten by the reach and would prove nothing here. */
  const want={speckBudget:96, lineWt:7, tippet:19, reelSpeed:3.4};
  Object.assign(P,want);
  const str=encodeSettings();
  const url='v='+SCENE_ID+'&s='+encodeURIComponent(str);
  Object.assign(P,{speckBudget:48, lineWt:3, tippet:44, speckSize:0.9});
  const raw=decodeURIComponent(url.slice(url.indexOf('s=')+2));
  const n=applySettings(raw);
  const ok=Object.keys(want).every(k=>Math.abs(P[k]-want[k])<1e-3);
  /* and a venue switch on top must not touch anything the venue does not own */
  applyPreset(Object.assign({},VENUE_BASE,SC.par));
  return {keysApplied:n, hashChars:url.length, restored:ok,
    survivesVenueDefaults:Object.keys(want).every(k=>Math.abs(P[k]-want[k])<1e-3),
    budgetResized:(renderer._loop(),GS_W===96&&gsRT[0].width===96)};
})()`,sandbox);
console.log('settings round trip',roundTrip);
if(!(roundTrip.restored&&roundTrip.survivesVenueDefaults&&roundTrip.budgetResized))
  console.log('  *** SETTINGS ROUND TRIP FAILURE ***');

/* Line threaded through the guides must be invisible to rocks and branches.
   When it was not, the guide constraint dragged the blank after whatever the
   scenery had shoved and the rod folded at the cork — Boulder Garden and Alder
   Tunnel, the two venues with scenery at rod height in the water you stand in. */
const guarded=vm.runInContext(`(()=>{
  const [lo,hi]=guidedNodes();
  const inRod=i=>{const s=sArc(i);return s>=lineOut&&s<=lineOut+rodArc;};
  let wrongSkip=0, wrongKeep=0;
  for(let i=0;i<nAct;i++){
    const skipped=(i>=lo&&i<=hi);
    if(skipped&&!inRod(i)) wrongSkip++;
    if(!skipped&&inRod(i)&&i>lo&&i<hi) wrongKeep++;
  }
  /* and prove it end to end: park every line node inside a rock and check that
     only the ones outside the guides get moved */
  const ob=OBST[0];
  const cy=bedY(ob.x,ob.z)+ob.h*P.obstHeight;
  for(let i=0;i<nAct;i++){ pos[i*3]=ob.x; pos[i*3+1]=cy; pos[i*3+2]=ob.z; }
  const before=Float32Array.from(pos.subarray(0,nAct*3));
  pushOutObstacles();
  let movedInRod=0, movedFree=0;
  for(let i=0;i<nAct;i++){const p=i*3;
    const d=Math.hypot(pos[p]-before[p],pos[p+1]-before[p+1],pos[p+2]-before[p+2]);
    if(d<=1e-9) continue;
    if(i>=lo&&i<=hi) movedInRod++; else movedFree++; }
  return {guidedSpan:[lo,hi], wrongSkip, wrongKeep, movedInRod, movedFree};
})()`,sandbox);
console.log('guided line exempt from scenery',guarded);
if(guarded.movedInRod||guarded.wrongSkip||guarded.wrongKeep||!guarded.movedFree)
  console.log('  *** GUIDE EXEMPTION FAILURE ***');

/* No rock may hang in the water. The mesh centre is put at the height the
   SOLVER calls the crown, so the lower hemisphere used to stop a vertical
   semi-axis short of the bed and you could see the river running underneath a
   boulder. The skirt has to reach past the deepest bed under the footprint,
   the crown must not move while it does, and re-cutting it must not
   accumulate — placeObstacles() runs on every tick of the Obstacle height and
   grade sliders. */
const skirt=vm.runInContext(`(()=>{
  const rocks=[];
  for(const o of OBST){
    if(o.kind!=='rock') continue;
    const cy=bedY(o.x,o.z)+o.h*P.obstHeight, extra=rockSkirt(o);
    /* the bottom of the skirt against the bed all the way round the footprint;
       positive anywhere is water showing under a boulder */
    let gap=-1e9;
    for(let k=0;k<8;k++){const an=k*Math.PI/4;
      gap=Math.max(gap,(cy-o.r*0.72-extra)-bedY(o.x+Math.cos(an)*o.r,o.z+Math.sin(an)*o.r));}
    rocks.push({r:o.r,gap:+gap.toFixed(3),extra:+extra.toFixed(3)});
  }
  /* the cut is a function of the setting, not an accumulation: taller rocks
     get a deeper skirt, and re-cutting at the same setting changes nothing */
  const at=v=>{const was=P.obstHeight;P.obstHeight=v;
    const r=OBST.filter(o=>o.kind==='rock').map(o=>+rockSkirt(o).toFixed(3));
    P.obstHeight=was;return r;};
  const lo=at(0.40), hi=at(1.40);
  /* run the real deform on a two-vertex stand-in: crown fixed, underside dropped */
  const o0=OBST.find(o=>o.kind==='rock');
  const fake={userData:{base:Float32Array.from([0,0.5,0, 0,-0.5,0])},
    geometry:{attributes:{position:{array:new Float32Array(6),needsUpdate:false}},
              computeVertexNormals(){}}};
  skirtRock(fake,o0); skirtRock(fake,o0);       /* twice: must not accumulate */
  const fa=fake.geometry.attributes.position.array;
  return {rocks, floating:rocks.filter(x=>x.gap>-0.10).length,
          deeperWhenTaller:hi.every((v,i)=>v>lo[i]),
          crownHeld:fa[1]===0.5, underDropped:+(fa[4]+0.5+rockSkirt(o0)).toFixed(6)};
})()`,sandbox);
console.log('rocks reach the bed',skirt);
if(skirt.floating||!skirt.crownHeld||skirt.underDropped!==0||!skirt.deeperWhenTaller)
  console.log('  *** FLOATING ROCK ***');

/* The film has to let go of the line from the fly BACKWARDS. A switch at a
   fixed arc length is what produced the plumb drop from a flat line down to a
   sunk fly; the front has to start at the fly, walk back, and stall in the fly
   line rather than swallowing all of it. */
const sink=vm.runInContext(`(()=>{
  const was=P.flySink; P.flySink=0.32;
  sinkArc=0;
  /* fly under the film, well clear of the bed */
  pos[0]=0; pos[2]=CZ; pos[1]=filmY(0,CZ,simTime)-0.30;
  const walk=[];
  for(let f=0;f<1800;f++){ sinkStep(1/72); if(f%300===0) walk.push(+sinkArc.toFixed(3)); }
  const settled=+sinkArc.toFixed(3);
  /* fly line is buoyant: the front must stop inside SINK_LINE of the leader */
  const capped=settled<=leaderTot+SINK_LINE+1e-6 && settled>leaderTot;
  /* the release has to be graded across the feather, not a step */
  const relAt=s=>Math.max(0,Math.min(1,(sinkArc-s)/SINK_FEATHER));
  const graded=relAt(settled-SINK_FEATHER*0.5)>0.2&&relAt(settled-SINK_FEATHER*0.5)<0.8;
  /* pick the fly up and the film takes all of it back */
  pos[1]=filmY(0,CZ,simTime)+0.60; sinkStep(1/72);
  const reset=sinkArc===0;
  /* and a dry fly never releases anything */
  P.flySink=0; sinkStep(1/72);
  const dryStaysUp=sinkArc===0;
  P.flySink=was; sinkArc=0;
  return {walk, settled, leader:+leaderTot.toFixed(2), capped, graded, reset, dryStaysUp,
          monotonic:walk.every((v,i)=>i===0||v>walk[i-1])};
})()`,sandbox);
console.log('sink front walks up the line',sink);
if(!(sink.capped&&sink.graded&&sink.reset&&sink.dryStaysUp&&sink.monotonic))
  console.log('  *** SINK FRONT FAILURE ***');

/* A netted fish goes to the nearest margin and stays there with its card, and
   the margin cannot silt up with the whole river. */
const trophy=vm.runInContext(`(()=>{
  for(const f of fishes) f.reseat();
  trophySeq=0;
  const out=[];
  for(let i=0;i<4&&i<fishes.length;i++){
    const f=fishes[i];
    f.land();
    const cz=CZ+SC.dz(f.bank.x);
    out.push({side:Math.sign(f.bank.z-cz),
              depth:+bedDepth(f.bank.x,f.bank.z).toFixed(2),
              inRiver:Math.abs((f.bank.z-cz)/SC.hw(f.bank.x))<1,
              label:!!(f.label&&f.label.mesh.visible)});
  }
  const parked=fishes.filter(f=>f.state==='landed');
  /* the ones sent home must have given their cards back */
  const strayCards=fishes.filter(f=>f.state!=='landed'&&f.label&&f.label.mesh.visible).length;
  const g=fishes[0];
  /* Run the landed branch for real. It has to SWIM to the margin — a lerp on
     the distance launches a beaten fish off the net at eight metres a second —
     then settle there, keep its card under it, and never time out and vanish. */
  const p0=parked[0];
  /* ── HE IS OFFERED TO YOU BEFORE HE IS PARKED ─────────────────────────
     Landing has to hold the fish up first: chest height, an arm's length
     along the way you are looking, carded, and grabbable for lookSecs. */
  const eye=camera.getWorldPosition(new THREE.Vector3());
  const chestY=q=>Math.max(bedY(q.x,q.z)+0.15,eye.y-P.chestDrop);
  const offered={secs:+p0.showT.toFixed(2),
                 reach:+Math.hypot(p0.present.x-eye.x,p0.present.z-eye.z).toFixed(3),
                 atChest:Math.abs(p0.present.y-chestY(p0.present))<1e-6,
                 carded:!!(p0.label&&p0.label.mesh.visible)};
  /* a second of it: he closes on the offer and stays there */
  const toOffer=p0.p.distanceTo(p0.present);
  for(let f=0;f<72;f++) p0.update(1/72,f/72);
  const camePresent=+(toOffer-p0.p.distanceTo(p0.present)).toFixed(3);
  const waitsThere=p0.showT>0;
  /* taking him in your hand stops the clock — he leaves when you let go */
  p0.held=true; p0.update(1/72,0);
  const heldStops=p0.showT===0;
  p0.held=false; p0.showT=1.0;
  /* and when it runs out he goes on to the bank */
  for(let f=0;f<144;f++) p0.update(1/72,f/72);
  const wentOn=p0.showT<=0;
  /* the bank spot is chest height too, not sunk into the margin */
  const bankAtChest=Math.abs(p0.bank.y-chestY(p0.bank))<1e-6;
  const bankOverWater=+(p0.bank.y-surfY(p0.bank.x)).toFixed(2);
  /* drop it a metre short and let it arrive */
  p0.p.set(p0.bank.x+1.0,p0.bank.y,p0.bank.z);
  const far0=p0.p.distanceTo(p0.bank);
  for(let f=0;f<72;f++) p0.update(1/72,f/72);
  const swimSpeed=+(far0-p0.p.distanceTo(p0.bank)).toFixed(2);   /* m in one second */
  for(let f=0;f<220;f++) p0.update(1/72,f/72);
  const far1=p0.p.distanceTo(p0.bank);
  const cardUnder=p0.label.mesh.position.y<p0.p.y&&
                  Math.abs(p0.label.mesh.position.x-p0.p.x)<1e-6;
  const res={caught:out, parked:parked.length, cap:MAX_TROPHY, strayCards,
          inches:+g.lengthIn().toFixed(1), ounces:+g.weightOz().toFixed(1),
          card:g.weightText(),
          /* sweep every length a venue can hold: the split must never read
             "n lb 16 oz", and a sub-pound fish is weighed in ounces alone */
          badSplit:(()=>{let bad=0,plain=0;
            for(let L=0.15;L<=0.80;L+=0.001){
              const s=Trout.prototype.weightText.call(
                {bodyMass:()=>0.30*Math.pow(L/0.30,3), weightOz:Trout.prototype.weightOz});
              if(/ 16 oz$/.test(s)) bad++;
              if(/^0 lb/.test(s)) bad++;
              if(/^\\d+ oz$/.test(s)) plain++;
            }
            return {bad,plain};})(),
          allWet:out.every(o=>o.depth>=0.10&&o.inRiver),
          allCarded:out.every(o=>o.label),
          swimSpeed, settled:+far1.toFixed(3),
          stillLanded:p0.state==='landed', cardUnder,
          eyeY:+eye.y.toFixed(2), look:P.lookSecs, offered, camePresent,
          waitsThere, heldStops, wentOn, bankAtChest, bankOverWater};
  for(const f of fishes) f.reseat();            /* leave the river as we found it */
  trophySeq=0;
  return res;
})()`,sandbox);
console.log('landed fish rest in the margin',trophy);
if(trophy.parked>trophy.cap||trophy.strayCards||!trophy.allWet||!trophy.allCarded||
   !trophy.stillLanded||!trophy.cardUnder||trophy.settled>0.05||
   trophy.swimSpeed<0.5||trophy.swimSpeed>2.0||
   trophy.badSplit.bad||!trophy.badSplit.plain||
   /* he is held up for you first, at chest height and within reach, with his
      card showing; the clock stops if you take him and runs out if you do not */
   trophy.offered.secs!==trophy.look||Math.abs(trophy.offered.reach-0.55)>0.01||
   !trophy.offered.atChest||!trophy.offered.carded||
   trophy.camePresent<=0||!trophy.waitsThere||!trophy.heldStops||!trophy.wentOn||
   /* and the bank is chest height too, not the bed */
   !trophy.bankAtChest)
  console.log('  *** LANDED FISH FAILURE ***');

/* The stats panel must be movable with the menu SHUT, and must not eat the
   trigger the reel needs while it is. */
const hudDrag=vm.runInContext(`(()=>{
  const uvAt=(x,y)=>({object:hud.mesh,uv:{x:x/HW,y:1-y/HH}});
  const mid=HH/2+60;
  /* The window ships OFF now, and a window that is not drawn must not answer
     the ray at all — otherwise a feature nobody turned on quietly swallows the
     trigger the reel needs. So both states are checked. */
  P.showStats=0; applyDisplay();
  const whenOff=hudChrome(uvAt(HHANDLE.x+4,HHANDLE.y+4));
  P.showStats=1; applyDisplay();
  const r={offAnswersNothing:!whenOff,
          handle:hudChrome(uvAt(HHANDLE.x+4,HHANDLE.y+4)),
          minus:hudChrome(uvAt(HSC_M.x+4,HSC_M.y+4)),
          plus:hudChrome(uvAt(HSC_P.x+4,HSC_P.y+4)),
          numbers:hudChrome(uvAt(HW/2,mid)),
          menuPanel:hudChrome({object:menu.mesh,uv:{x:0.01,y:0.99}}),
          nothing:hudChrome(null)};
  P.showStats=0; applyDisplay();
  return r;
})()`,sandbox);
console.log('stats panel handle live with the menu shut',hudDrag);
if(!(hudDrag.handle&&hudDrag.minus&&hudDrag.plus&&hudDrag.offAnswersNothing)||
   hudDrag.numbers||hudDrag.menuPanel||hudDrag.nothing)
  console.log('  *** HUD HANDLE FAILURE ***');

/* Teleport locomotion. What must hold: it never lands you somewhere wading
   could not have put you, the hop puts your HEAD on the ring rather than the
   rig origin, the screen is black on the frame you move, a snap turn leaves
   your head where it was, and turning the whole thing off gives the stick
   straight back to the walk code. */
const tp=vm.runInContext(`(()=>{
  const wasTP=P.teleport, wasP={x:player.position.x,z:player.position.z,y:player.rotation.y};
  const wasCam={x:camera.position.x,y:camera.position.y,z:camera.position.z};
  const wasGrip=offGrip;
  P.teleport=1; blinkT=0; blinkPending=false; tpArmed=false;
  const aim=(x,y,z)=>{ offGrip={getWorldPosition:v=>v.set(x,y,z), getWorldQuaternion:q=>q};
                       return {landed:tpAim(), ok:tpOK, hit:{x:+tpHit.x.toFixed(2),z:+tpHit.z.toFixed(2)}}; };

  /* somewhere you can stand, somewhere you cannot */
  const mid=CZ+SC.dz(0);                       /* deepest part of the channel */
  const bankZ=mid+SC.hw(0)*1.06;               /* dry ground off the edge */
  const standable={ bank:tpStandable(0,bankZ),
                    middle:tpStandable(0,mid),
                    depthMid:+(surfY(0)-bedY(0,mid)).toFixed(2),
                    onRock:tpStandable(OBST[0].x,OBST[0].z) };

  /* Aim across the water from the near bank. A flat throw from hand height
     carries into the middle, which is over your chest, so it must come back
     refused — that is the depth rule doing its job, not a miss. */
  /* heights are off the GROUND here — the reach falls away downstream, so the
     bank by the spawn is nowhere near y=0 */
  const gy=tpTop(0,bankZ);
  camera.position.set(0,gy+1.55,bankZ);
  const near=aim(0,gy+1.20,bankZ);
  near.depth=+(surfY(near.hit.x)-bedY(near.hit.x,near.hit.z)).toFixed(2);
  /* a shorter throw drops in the margin, where you can stand */
  const margin=aim(0,gy+0.30,bankZ);
  margin.depth=+(surfY(margin.hit.x)-bedY(margin.hit.x,margin.hit.z)).toFixed(2);
  /* launched from far too high, it outruns the range and must be refused */
  const far=aim(0,gy+26.0,bankZ);
  far.reach=+Math.hypot(far.hit.x-camera.position.x,far.hit.z-camera.position.z).toFixed(1);

  /* the hop itself: head onto the ring, dark on the frame it moves */
  tpHit.set(0,tpTop(0,bankZ-4),bankZ-4); tpOK=true;
  blinkTo_(tpHit.x,tpHit.z);
  let darkAtMove=-1, moved=false, peak=0;
  for(let f=0;f<60&&blinkT>0;f++){
    const bx=player.position.x, bz=player.position.z;
    const d=blinkStep(1/72);
    peak=Math.max(peak,d);
    if(!moved&&(player.position.x!==bx||player.position.z!==bz)){ moved=true; darkAtMove=d; }
  }
  /* The rig moves by the error at the HEAD, so the head must end up ON the
     ring. Measured in WORLD terms: this used to rebuild the landing from
     camera.position -- which is LOCAL to the rig -- plus the rig's delta, an
     identity that holds only while the rig sits at the origin. Ask the camera
     where it is instead. (No backticks in here: this comment lives inside a
     template literal, and one backtick ends the whole test.) */
  const _hl=camera.getWorldPosition(new THREE.Vector3());
  const headLand={x:+_hl.x.toFixed(2), z:+_hl.z.toFixed(2)};
  const onRing=Math.hypot(_hl.x-tpHit.x,_hl.z-tpHit.z)<0.01;

  /* snap turn: yaw advances, the head does not move. The camera's position is
     LOCAL to the rig, so standing the head away from the rig origin — which is
     the whole point of the test — means offsetting it by -rig, not setting a
     world position. Written the other way round it put the head exactly over
     the origin and a turn about the head moved nothing, which read as a
     failure of the code rather than of the test. */
  player.position.set(2,0,3); player.rotation.y=0; camera.position.set(-2,1.55,-3);
  /* the property the code exists to guarantee, measured directly: the HEAD
     stays where it is and only the rig swings around it */
  const h0=camera.getWorldPosition(new THREE.Vector3()).clone();
  snapTurn(Math.PI/6);
  const h1=camera.getWorldPosition(new THREE.Vector3());
  const snap={yaw:+player.rotation.y.toFixed(4),
              headKept:Math.hypot(h1.x-h0.x,h1.z-h0.z)<1e-9,
              turned:Math.abs(player.position.x-2)>1e-6};

  /* off means off: the stick goes back to the walk code and nothing is drawn */
  P.teleport=0;
  const offMode={owns:teleportStep(0,-1), arc:tpArc.visible, ring:tpMark.grp.visible};
  /* on means the walk code never sees the stick, even half pushed */
  P.teleport=1;
  const onHalf=teleportStep(0,-0.2);

  P.teleport=wasTP; offGrip=wasGrip; blinkT=0; blinkPending=false; tpArmed=false;
  tpArc.visible=false; tpMark.grp.visible=false;
  player.position.set(wasP.x,0,wasP.z); player.rotation.y=wasP.y;
  /* the head goes back over the rig too: leaving it three metres off to one
     side is a standing offset every later test would inherit */
  camera.position.set(wasCam.x,wasCam.y,wasCam.z);
  return {standable, near, margin, far, peak:+peak.toFixed(2), moved,
          darkAtMove:+darkAtMove.toFixed(2), onRing, snap, offMode, onHalf,
          range:wasTP===undefined?null:P.tpRange};
})()`,sandbox);
console.log('teleport locomotion',tp);
if(!tp.standable.bank||tp.standable.middle||tp.standable.onRock||
   !tp.near.landed||tp.near.ok||!tp.margin.landed||!tp.margin.ok||tp.far.ok||
   !tp.moved||tp.darkAtMove<0.999||tp.peak<0.999||!tp.onRing||
   !tp.snap.headKept||!tp.snap.turned||
   tp.offMode.owns||tp.offMode.arc||tp.offMode.ring||!tp.onHalf)
  console.log('  *** TELEPORT FAILURE ***');

/* ── the tackle through a hop ────────────────────────────────────────────
   The rig moving is a discontinuity, and PBD reads velocity out of
   consecutive positions, so before carryTackle() existed an 8 m hop handed
   the rod butt about 3500 m/s. Measured with this harness: a segment
   stretched to 6.6x its material length, line nodes hit 134 m/s against
   sanity()'s 140 clamp, 3.4 m of line was ripped back in through the guides,
   and with a fish on the line saw 108 N against a 21 N tippet — every hop
   while playing a fish broke you off.

   Everything is measured against a BASELINE taken over the same number of
   frames just before the hop, because by this point in the run P has been
   through the water sweep and half a dozen other tests and no absolute
   threshold means anything. The claim being checked is the right one anyway:
   a hop must not do more to the line than standing still does. */
const hop=vm.runInContext(`(()=>{
  /* Its own world. By this point in the run the venue has been swapped, the
     flow and grade have been driven up for the water sweep and half the
     tackle has been through two presets — measuring a hop against that is
     measuring the leftovers. applyVenue puts back the reach every constant
     was tuned on, and the shipped defaults go on top of it. */
  applyVenue('cedar');
  applyPreset(SHIPPED);
  const worst=()=>{
    let st=0,vmax=0;
    for(let i=1;i<nAct;i++){const a=(i-1)*3,b=i*3;
      const d=Math.hypot(pos[b]-pos[a],pos[b+1]-pos[a+1],pos[b+2]-pos[a+2]);
      if(d/restOf(i-1)>st) st=d/restOf(i-1);}
    for(let i=0;i<nAct;i++){const p=i*3;
      const sp=Math.hypot(vel[p],vel[p+1],vel[p+2]); if(sp>vmax)vmax=sp;}
    return {st,vmax,T:M.tension};
  };
  const settle=n=>{ for(let i=0;i<n;i++) renderer._loop(); };
  const peaks=n=>{ let st=0,v=0,T=0,blew=false;
    for(let i=0;i<n;i++){ renderer._loop(); const w=worst();
      if(w.st>st)st=w.st; if(w.vmax>v)v=w.vmax; if(w.T>T)T=w.T; blew=blew||blewUp; }
    return {st:+st.toFixed(2), v:+v.toFixed(0), T:+T.toFixed(1), blew}; };

  for(const f of fishes) f.reseat();
  lineOut=12; offSpool=lineOut+rodArc+2.2; resetCast(); settle(70);
  const base=peaks(30);
  /* Distance from the TIPTOP, not an absolute position: the fly is drifting
     the whole time, so "did it move by eight metres" is measuring the current
     as much as the hop. What the carry actually claims is that the
     configuration is preserved, and this is that claim. */
  const tipGap=()=>{const T=(NG-1)*3;
    return Math.hypot(pos[0]-guidePos[T],pos[1]-guidePos[T+1],pos[2]-guidePos[T+2]);};
  const was={lineOut, gap:tipGap()};
  camera.getWorldPosition(_camWorld);
  blinkTo_(_camWorld.x-8,_camWorld.z);
  /* far enough past the blink for the move to have happened (the dark half is
     0.13 s and this harness ticks at 1/45), near enough that the fly has not
     had time to swing downstream and muddy the measurement */
  let mid=null;
  for(let i=0;i<12;i++) renderer._loop();
  mid={gap:+tipGap().toFixed(2), lineOut:+lineOut.toFixed(2)};
  const after=peaks(28);
  const open={base, after, mid, wasGap:+was.gap.toFixed(2),
              carried:Math.abs(mid.gap-was.gap)<1.0,        /* it came with you */
              kept:Math.abs(mid.lineOut-was.lineOut)<0.6,   /* not ripped in */
              dry:surfY(pos[0])-bedY(pos[0],pos[2])<=0.02};

  /* and again with a fish on, which is the case that used to break you off */
  for(const f of fishes) f.reseat();
  lineOut=12; offSpool=lineOut+rodArc+2.2; resetCast(); settle(50);
  runAction('!hookfish'); settle(30);
  const hookedBefore=!!hooked;
  /* PIN WHAT HE IS DOING ACROSS BOTH WINDOWS.
     peaks() is the maximum over 30-40 frames, a hooked fish picks a new
     behaviour every second or two, and a run that happens to land inside the
     second window is thirty newtons of FISH rather than thirty newtons of hop.
     This check therefore failed at random, on builds that touch none of it,
     roughly one run in four — and the comment below already knew why: "a
     fight's own tension swings between nothing and everything run to run".
     A test that has to be re-run to be believed is a test nobody believes.
     (No backticks in here: this comment lives inside a template literal.)
     Pinned to RUN, the hardest steady pull, with a fixed direction and
     full stamina, both windows see the same fish and the only difference left
     between them is the hop, which is the thing being measured. */
  const pin=()=>{ if(hooked){ hooked.beh='run'; hooked.behT=9;
                              hooked.stamina=1; hooked.run.set(-1,0,0); } };
  pin(); const fbase=peaks(30);
  camera.getWorldPosition(_camWorld);
  blinkTo_(_camWorld.x-8,_camWorld.z);
  pin(); const fafter=peaks(40);
  const fish={hookedBefore, stillOn:!!hooked,
              wet:hooked?+(surfY(hooked.p.x)-bedY(hooked.p.x,hooked.p.z)).toFixed(2):null,
              base:fbase, after:fafter, tippet:P.tippet};

  for(const f of fishes) f.reseat();
  blinkT=0; blinkPending=false;
  resetCast();
  return {open, fish};
})()`.replace('SHIPPED',JSON.stringify(shipped)),sandbox);
console.log('tackle through a hop',hop);
{
  const o=hop.open, f=hop.fish;
  if(o.after.blew||f.after.blew||
     /* Peak node speed is printed but NOT asserted on. The stub water's own
        peaks are erratic here and reach sanity()'s 140 m/s clamp in several of
        these states with the line under no stretch and no tension at all — a
        single node flying free, not the chain being yanked. Stretch and
        tension are the measures that discriminate, and they do it cleanly:
        x1.4 against x6.6, and 0.3 N against 17.5 N.

        With a fish on, the claim is the one that actually cost you fish: a hop
        must not reach breaking strain. 108 N against a 40 N tippet fires both
        of these; 7 N fires neither. */
     o.after.st>o.base.st+1.5 || o.after.T>o.base.T+3 ||
     !o.carried||!o.kept||o.dry||
     !f.hookedBefore||!f.stillOn||f.wet<=0.05||
     f.after.st>f.base.st+1.5 ||
     /* Against the TIPPET, not against the baseline. A fight's own tension
        swings between nothing and everything run to run, so a baseline of 0 N
        makes any relative margin either fragile or meaningless. The claim
        worth holding is the one that cost fish: a hop must not take the line
        near breaking strain. 89 N against a 40 N tippet fires this; the 20 N
        a fish pulls on its own does not. */
     f.after.T>=f.tippet*0.8)
    console.log('  *** TACKLE-THROUGH-A-HOP FAILURE ***');
}

/* ── a fish on: the stick, and what the line may do to him ───────────────
   Three claims, all of which used to be false or untested.

   1. With a fish on, the stick wades whatever Teleport move says — you close
      the distance to net him rather than hopping and hoping.
   2. A tippet cannot TRANSMIT more than it can hold. `fishTension` is the raw
      pull, because the rod and the break-off test both want it raw; what
      reaches the fish's body is clamped to P.tippet. Before this, 144 N was
      measured arriving at a fish on a 21 N 5X tippet — six tippets' worth,
      for the several frames it takes a 1/12 s smoothed M.tension to climb
      past the threshold and fire the break.
   3. Nothing about a hooked trout is 8 m/s.

   Note what this does NOT claim: the reported symptom was a fish twenty feet
   in the air, and it is not reproduced here — see HANDOFF section 5. */
const fight=vm.runInContext(`(()=>{
  const wasP={x:player.position.x,z:player.position.z,y:player.rotation.y};
  applyVenue('cedar'); applyPreset(SHIPPED);
  const settle=n=>{ for(let i=0;i<n;i++) renderer._loop(); };
  for(const f of fishes) f.reseat();
  lineOut=12; offSpool=lineOut+rodArc+2.2; resetCast(); settle(60);

  /* 1. the stick, with and without a fish */
  const wasTP=P.teleport; P.teleport=1;
  const dry={owns:teleportStep(0,-1), arc:tpArc.visible};
  runAction('!hookfish'); settle(30);
  const on={hooked:!!hooked, owns:teleportStep(0,-1),
            arc:tpArc.visible, ring:tpMark.grp.visible};
  /* and with the toggle off it was already the walk code, fish or no fish */
  P.teleport=0;
  const off={owns:teleportStep(0,-1)};
  P.teleport=wasTP;

  /* 2 & 3. drive the fight hard and watch what reaches him. The rod hand can
     actually be rotated now, so this is a real sweep rather than a shove. */
  const grip=renderer.xr.getControllerGrip(0);
  let sawT=0, sawV=0, sawAir=0, carried=0, capBit=false, capRaw=0, capGot=0;
  for(let f=0;f<220&&hooked;f++){
    grip.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.sin(f*0.55)*1.1);
    if(f===40&&hooked){ hooked.beh='jump'; hooked.behT=0.45; hooked.v.y=3.6; }
    renderer._loop();
    if(!hooked) break;
    const film=filmY(hooked.p.x,hooked.p.z,simTime);
    sawT=Math.max(sawT,fishTension);
    sawV=Math.max(sawV,Math.hypot(hooked.v.x,hooked.v.y,hooked.v.z));
    sawAir=Math.max(sawAir,hooked.p.y-film);
    /* what the GAME applied, not what this test would have applied. Recompute
       the cap here and the assertion is true by construction and worth nothing. */
    carried=Math.max(carried,fishCarried);
  }
  grip.quaternion.set(0,0,0,1);
  /* AND THE CAP, PUT TO HIM DIRECTLY. Whether a fight left to itself happens
     to pull harder than the tippet is a coin toss — 49, 51, 40 and 36 newtons
     over four runs of the same build, and it got looser again the moment the
     rod started bending, because a rod that bends is a rod absorbing the pull
     that used to go into the line. So the claim is tested rather than waited
     for: hold him at two metres of stretch, which is a hundred and twenty
     newtons and three tippets, and see what actually reaches him. */
  if(!hooked){ runAction('!hookfish'); for(let i=0;i<6;i++) renderer._loop(); }
  if(hooked){
    const T=(RN-1)*3, L0=lineOut, d=L0+2.0;
    for(let i=0;i<3&&hooked;i++){
      hooked.p.set(rpos[T]-d,rpos[T+1]-0.60,rpos[T+2]);
      hooked.v.set(0,0,0); lineOut=L0;
      renderer._loop();
      capRaw=Math.max(capRaw,fishTension); capGot=Math.max(capGot,fishCarried);
    }
  }
  capBit=capRaw>P.tippet*1.5&&capGot<=P.tippet+1e-6;
  for(const f of fishes) f.reseat();
  player.position.set(wasP.x,0,wasP.z); player.rotation.y=wasP.y;
  resetCast();
  return {dry, on, off, tippet:P.tippet, capBit,
          cap:{raw:+capRaw.toFixed(1), got:+capGot.toFixed(1)},
          rawSeen:+sawT.toFixed(1), carriedMax:+carried.toFixed(1),
          topSpeed:+sawV.toFixed(1), topAir:+sawAir.toFixed(2)};
})()`.replace('SHIPPED',JSON.stringify(shipped)),sandbox);
console.log('a fish on',fight);
if(!fight.dry.owns || !fight.on.hooked || fight.on.owns || fight.on.arc || fight.on.ring ||
   fight.off.owns || fight.carriedMax>fight.tippet ||
   !fight.capBit ||                   /* the cap must have actually bitten */
   fight.topSpeed>8.05 || fight.topAir>3.4)
  console.log('  *** FISH-ON FAILURE ***');

/* ── the fish bends the rod ──────────────────────────────────────────────
   The reaction the line puts back into the blank was written into rod
   VELOCITY only — inside a substep that has already integrated the rod, and
   that ends by re-deriving every rod velocity from the positions it solved.
   It was therefore overwritten a few lines later, every substep, and never
   moved a node: the rod hung at its own dead weight with a fish on. So the
   claim here is the crude one that would have caught it — a fish pulling
   across the blank bends it further than its own weight does — plus the one
   that says the Playing flex knob reaches the same place.

   The pull is pinned ACROSS the rod on purpose. A rod pointed straight at a
   fish takes almost none of his pull as bend, and that is correct physics
   rather than a bug, so it is not what this measures. */
const rodbend=vm.runInContext(`(()=>{
  applyVenue('cedar'); applyPreset(SHIPPED);
  const settle=n=>{ for(let i=0;i<n;i++) renderer._loop(); };
  const fight=(flex)=>{
    for(const f of fishes) f.reseat();
    P.fightFlex=flex;
    lineOut=12; offSpool=lineOut+rodArc+2.2; resetCast(); settle(60);
    const idle=M.bend;
    runAction('!hookfish'); settle(4);
    if(!hooked) return {idle:+idle.toFixed(1), bend:0, carried:0};
    /* HOLD HIM AT A FIXED STRETCH, SQUARE TO THE BLANK. A fight's own tension
       swings between nothing and everything run to run, so a peak taken over a
       swimming fish cannot compare two rods - the same flake the hop test was
       pinned for. Park him at lineOut + 0.30 m, which is 18 N at the shipped
       Line stretch, and put him ACROSS the rod: a rod pointed down the line at
       a fish takes his pull as compression and barely bends at all, which is
       correct physics and the reason an angler keeps the rod up and off to the
       side. What is left, after the rod settles, is the bend. */
    const T=(RN-1)*3;
    let ax=rpos[T]-rpos[0], az=rpos[T+2]-rpos[2];
    const al=Math.hypot(ax,az)||1; ax/=al; az/=al;
    let carried=0, sum=0, n=0;
    for(let i=0;i<130&&hooked;i++){
      /* THE TIP MOVES, so the stretch is measured off where it is NOW. Held
         against the tip as it stood at the take, a rod that bends half a metre
         is a rod changing its own load by thirty newtons — which is how the
         softer setting came to read LESS bend than the stiff one: both were
         pinned at the tippet, and neither was measuring flex at all. */
      hooked.beh='easy'; hooked.behT=9; hooked.stamina=1;
      /* and the stretch is taken off the CURRENT lineOut as well, rather than
         holding that still too: the reel and the guides move it about on their
         own, and a rig that fights them is a rig measuring the fight. */
      const d=lineOut+0.30;
      hooked.p.set(rpos[T]-az*d, rpos[T+1]-0.60, rpos[T+2]+ax*d);
      hooked.v.set(0,0,0);
      renderer._loop();
      if(!hooked) break;
      carried=Math.max(carried,fishCarried);
      if(i>=90){ sum+=M.bend; n++; }
    }
    for(const f of fishes) f.reseat();
    resetCast();
    return {idle:+idle.toFixed(1), bend:+(sum/Math.max(1,n)).toFixed(1),
            carried:+carried.toFixed(1)};
  };
  const stiff=fight(1.0), soft=fight(3.0);
  applyPreset(SHIPPED);
  return {stiff, soft};
})()`.replace('SHIPPED',JSON.stringify(shipped)),sandbox);
console.log('the fish bends the rod',rodbend);
if(rodbend.stiff.carried<5 ||                        /* he has to have pulled */
   rodbend.stiff.bend<rodbend.stiff.idle+6 ||        /* and it has to arrive */
   rodbend.soft.bend<rodbend.stiff.bend+2)           /* and the knob has to bite */
  console.log('  *** ROD-BEND FAILURE ***');

/* ── the control guide ───────────────────────────────────────────────────
   Every callout says something, both hands are drawn, turning it off hides
   all of it, and the words track the settings — which is the part that rots.
   A label still reading TELEPORT with the toggle off is worse than no label.

   `lazy` is reported but NOT asserted: the geometry is built on first use, and
   by this point in the run the frame loop has been ticking with handGuide at
   its shipped 1, so of course it is already built. The claim that is worth
   holding is the one below it — off means nothing on screen. */
const guide=vm.runInContext(`(()=>{
  const was=P.handGuide, wasTP=P.teleport;
  P.handGuide=0; guideStep();
  const lazy=!GUIDE.built;                 /* informational, see above */
  P.handGuide=1; guideStep();
  const hands=GUIDE.hands.map(h=>({name:h.name, rows:h.rows.length,
    shown:h.grp.visible,
    words:h.rows.map(r=>r.lbl.said)}));
  const blank=GUIDE.hands.some(h=>h.rows.some(r=>!r.lbl.said||r.lbl.said==='|'));
  /* the stick tells the truth about the mode */
  P.teleport=1; guideStep();
  const tp=GUIDE.hands[1].rows[0].lbl.said;
  P.teleport=0; guideStep();
  const walk=GUIDE.hands[1].rows[0].lbl.said;
  P.teleport=1; runAction('!hookfish'); guideStep();
  const wade=GUIDE.hands[1].rows[0].lbl.said;
  for(const f of fishes) f.reseat();
  P.teleport=wasTP; P.handGuide=0; guideStep();
  const hidden=GUIDE.hands.every(h=>!h.grp.visible);
  P.handGuide=was;
  /* THE GHOST HAS TO POINT THE WAY THE ROD DOES. Both are drawn in grip
     space, and the rod runs along Z (butt at +BUTT_Z, blank out toward -Z),
     so a controller held in that hand has its handle along Z too. The first
     version laid it down -Y — a quarter turn out, and that is exactly what it
     looked like in the headset. CapsuleGeometry is built about Y, so the
     handle's axis is (0,1,0) turned by its own rotation.x. */
  const handleAxis=(()=>{
    const b=GUIDE.hands[0].grp.userData.handle;
    const rx=b?b.rotation.x:0;
    return {x:0, y:Math.cos(rx), z:Math.sin(rx)};
  })();
  /* the rod's own direction in the same space, straight out of handTargets */
  const rodAxis={x:0,y:0,z:(NEXT_Z-BUTT_Z)<0?-1:1};
  const align=Math.abs(handleAxis.x*rodAxis.x+handleAxis.y*rodAxis.y+
                       handleAxis.z*rodAxis.z);
  return {lazy, hands, blank, hidden,
          handleAxis:{x:+handleAxis.x.toFixed(2),y:+handleAxis.y.toFixed(2),
                      z:+handleAxis.z.toFixed(2)},
          rodAxis, alignDeg:+(Math.acos(Math.min(1,align))*180/Math.PI).toFixed(1),
          stick:{tp:tp.split('|')[0], walk:walk.split('|')[0], wade:wade.split('|')[0]}};
})()`,sandbox);
console.log('control guide',{lazy:guide.lazy, blank:guide.blank, hidden:guide.hidden,
  handleAxis:guide.handleAxis, rodAxis:guide.rodAxis,
  handleVsRod:guide.alignDeg+' deg', stick:guide.stick,
  rows:guide.hands.map(h=>h.name+':'+h.rows+(h.shown?' shown':' hidden'))});
console.log('  callouts:',guide.hands.map(h=>h.words.map(w=>w.split('|')[0]).join(', ')).join('  |  '));
if(guide.blank||!guide.hidden||
   guide.hands.length!==2||guide.hands.some(h=>h.rows<4||!h.shown)||
   guide.stick.tp!=='TELEPORT'||guide.stick.walk!=='WALK'||guide.stick.wade!=='WADE'||
   guide.alignDeg>30)
  console.log('  *** CONTROL GUIDE FAILURE ***');

/* ── the fish you can see ────────────────────────────────────────────────
   Two faults reported from the headset, both geometric, both measurable.

   1. A procedural twin standing in the water beside the asset fish, never
      swimming — and sometimes one hanging in the air. rebuildMesh() called
      scene.remove() on a mesh built into fishGroup, which removes nothing,
      then added the replacement to the scene. So every model load and every
      toggle of Use model assets left one more frozen fish behind, in a group
      buildFish() no longer clears.
   2. The mouth: two fixed-radius ellipsoids on a snout far narrower than they
      were, standing 32 mm proud on each side — a dark biscuit held crosswise.
      Both are sized from prof() now, and the check is that they stay inside
      the hull over their WHOLE length, because an ellipsoid tapers as a circle
      and a snout tapers faster. */
const fishy=vm.runInContext(`(()=>{
  /* every mesh a fish owns lives in fishGroup, and nothing it replaced is
     left anywhere */
  const before={group:fishGroup.children.length, scene:scene.children.length};
  for(const f of fishes){ f.rebuildMesh(); f.rebuildMesh(); }
  const after={group:fishGroup.children.length, scene:scene.children.length};
  const parented=fishes.every(f=>f.mesh.parent===fishGroup);
  const orphans=scene.children.filter(o=>fishes.some(f=>f.mesh===o)).length;

  /* the mouth against the body it is set into */
  const bodyW=t=>0.125*prof(t)*0.52;
  const sweep=(t,halfLen,k)=>{
    const w=bodyW(t)*k; let worstOut=-1e9;
    for(let i=0;i<=200;i++){
      const dx=(i/200*2-1)*halfLen, x=t+dx;
      if(x<0) continue;
      const ez=w*Math.sqrt(Math.max(0,1-(dx/halfLen)**2));
      worstOut=Math.max(worstOut,ez-bodyW(x));
    }
    return {halfW:+w.toFixed(4), snoutW:+bodyW(0.030).toFixed(4),
            proud:+worstOut.toFixed(4)};
  };
  /* the same numbers makeTrout uses — see the MOUTH block there */
  const gape=sweep(0.052,0.048,0.80), jaw=sweep(0.045,0.042,0.74);
  return {before, after, parented, orphans, gape, jaw};
})()`,sandbox);
console.log('the fish you can see',fishy);
if(fishy.after.group!==fishy.before.group || fishy.after.scene!==fishy.before.scene ||
   !fishy.parented || fishy.orphans ||
   fishy.gape.proud>0 || fishy.jaw.proud>0 ||
   fishy.gape.halfW>fishy.gape.snoutW*1.25 || fishy.jaw.halfW>fishy.jaw.snoutW*1.25)
  console.log('  *** FISH-MESH FAILURE ***');

/* ── phone remote ────────────────────────────────────────────────────────
   No Peer here, so a fake conn is dropped straight into REMOTE and the
   protocol is driven by hand. What this is actually guarding is the rule
   that the phone is a VIEW of P: everything it sends must land through
   P[key]/onSettingChanged(key), it must not be able to name anything that
   is not a row of MENU, and a value it just set must not be echoed back at
   it mid-drag — that echo is what makes a slider fight the thumb. */
const rem=vm.runInContext(`(()=>{
  const sent=[];
  const before={}; for(const k in P) before[k]=P[k];
  REMOTE.conn={open:true, send(o){sent.push(o);}, close(){}, dataChannel:{bufferedAmount:0}};
  REMOTE.phone=true;
  remoteHandshake();

  /* the schema went out in numbered pieces and comes back whole */
  const parts=sent.filter(m=>m.t==='part');
  const ids={};
  for(const m of parts){ (ids[m.id]=ids[m.id]||[])[m.i]=m.s; }
  const first=Object.keys(ids)[0];
  let schema=null, whole=false;
  try{ schema=JSON.parse(ids[first].join('')); whole=true; }catch(e){}
  const chunked={parts:parts.length, whole,
                 rows:schema?schema.menu.length:0, tabs:schema?schema.tabs.length:0,
                 vals:schema?Object.keys(schema.vals).length:0};

  /* every non-action row of MENU must name a real setting, or the phone
     draws a slider over undefined — the same drift the flat panel hit */
  const orphan=MENU.filter(r=>r[1]&&r[1].charAt(0)!=='!'&&typeof P[r[1]]!=='number')
                   .map(r=>r[1]);
  /* and every row must be reachable: a row in no tab cannot be tapped */
  const inTab=new Set(); for(const t of TABS) for(const i of t.rows) inTab.add(i);
  const unreachable=MENU.map((r,i)=>[r,i]).filter(([r,i])=>r[1]&&!inTab.has(i)).length;

  /* a set lands, and the push after it carries no echo of that key */
  sent.length=0;
  const was=P.tippet;
  remoteData({t:'set',k:'tippet',v:33});
  const landed=P.tippet;
  remotePush();
  const vals=sent.filter(m=>m.t==='vals');
  const echoed=vals.some(m=>'tippet' in m.v);
  const stats=sent.filter(m=>m.t==='hud').length;

  /* junk is refused rather than poked into P */
  remoteData({t:'set',k:'tippet',v:'NaN'});
  remoteData({t:'set',k:'__proto__',v:1});
  remoteData({t:'set',k:'notASetting',v:1});
  const junkHeld=P.tippet===33 && !('notASetting' in P);

  /* an action the menu does not list is refused; one it lists runs, and
     the wholesale rewrite it caused reaches the phone */
  const fakeRan=(()=>{ try{ remoteData({t:'act',k:'!wipeEverything'}); return false; }catch(e){ return true; } })();
  sent.length=0;
  remoteData({t:'act',k:'!classicrod'});
  const after=sent.filter(m=>m.t==='vals');
  const preset={moved:after.length?Object.keys(after[0].v).length:0,
                massMul:+P.massMul.toFixed(2)};

  /* stats carry what the person on the phone cannot see */
  const hud=remoteStats();
  const hudKeys=['fps','venue','lineOut','tension','tippet','hand','feeding','hooked'];
  const hudOK=hudKeys.every(k=>k in hud);

  /* the in-headset surface of it: the row exists, it is reachable, and the
     panel draws with a live code in the header and a status in the strip */
  const row=MENU.findIndex(r=>r[1]==='!remote');
  const wasSel=menuSel, wasTab=selTab;
  menuSel=row; selTab=TABS.findIndex(t=>t.rows.indexOf(row)>=0);
  REMOTE.state='ready'; REMOTE.code='K7QP';
  let drew=true; try{ drawMenu(); }catch(e){ drew=false; }
  const line=remoteStatus();
  REMOTE.state='off';
  let drewOff=true; try{ drawMenu(); }catch(e){ drewOff=false; }
  menuSel=wasSel; selTab=wasTab;
  const inMenu={row:row>=0, tab:selTab>=0, drew, drewOff,
                code:line.indexOf('K7QP')>=0, url:line.indexOf('remote.html')>=0};

  /* closing takes the timer and the channel with it */
  remoteStop();
  const closed=REMOTE.conn===null&&REMOTE.state==='off'&&REMOTE.timer===null;

  P.tippet=was;
  applyPreset(before);          /* the preset above rewrote most of P */
  return {chunked, orphan, unreachable, landed, echoed, stats, junkHeld,
          fakeRan, preset, hudOK, closed, inMenu,
          url:remoteUrl('WXYZ').slice(-16)};
})()`,sandbox);
console.log('phone remote',rem);
if(!rem.chunked.whole||rem.chunked.parts<2||rem.chunked.rows<100||rem.chunked.tabs<8||
   rem.chunked.vals<100||rem.orphan.length||rem.unreachable||
   rem.landed!==33||rem.echoed||!rem.stats||!rem.junkHeld||rem.fakeRan||
   rem.preset.moved<5||!rem.hudOK||!rem.closed||
   !rem.inMenu.row||!rem.inMenu.tab||!rem.inMenu.drew||!rem.inMenu.drewOff||
   !rem.inMenu.code||!rem.inMenu.url)
  console.log('  *** PHONE REMOTE FAILURE ***');

/* ── the species ─────────────────────────────────────────────────────────
   Five fish out of one body, and the failures worth guarding are the quiet
   ones: a paint pass that throws only for the species nobody has turned on
   yet, a mesh swap that leaves the old body in the group (which is exactly
   what the asset rebuild got wrong once), a river emptied by turning every
   box off, and a size slider that moves the fish but not the card. */
const spec=vm.runInContext(`(()=>{
  const before={}; for(const k in P) before[k]=P[k];
  const keys=SPECIES_ORDER.map(k=>SPECIES[k].key);

  /* every species paints, meshes, and swims a frame on its own */
  const built=[], errs=[];
  for(const id of SPECIES_ORDER){
    for(const k of keys) P[k]=0;
    P[SPECIES[id].key]=1;
    try{
      syncSpecies();
      const kinds=[...new Set(fishes.map(f=>f.sp.id))];
      built.push(id+' x'+fishes.length);
      if(kinds.length!==1||kinds[0]!==id) errs.push(id+' got '+kinds.join('+'));
      for(const f of fishes) f.update(1/72,1.0);
    }catch(e){ errs.push(id+': '+e.message); }
  }

  /* turn everything off and the river is still not empty */
  for(const k of keys) P[k]=0;
  syncSpecies();
  const noneOn=fishes.length>0&&fishes.every(f=>f.sp.id==='rainbow');

  /* mixed water, and a lie that keeps its fish across a re-sync */
  for(const k of keys) P[k]=1;
  syncSpecies();
  const mix=fishes.map(f=>f.sp.id);
  const allOn=mix.every(id=>SPECIES_ORDER.indexOf(id)>=0);
  syncSpecies();
  const stable=fishes.every((f,i)=>f.sp.id===mix[i]);

  /* THE DRAW MUST ACTUALLY SPREAD. A sin-fract hash passed every check above
     and still put three rainbows and a brown in a reach with five species
     turned on, because in double precision it barely moves between lies a few
     metres apart. Bucket the whole bed and demand something near flat. */
  const bins=new Array(SPECIES_ORDER.length).fill(0); let n=0;
  for(let x=-48;x<=48;x+=0.5) for(let z=-14;z<=14;z+=0.5){
    bins[Math.min(bins.length-1,Math.floor(lieDraw({x,z})*bins.length))]++; n++;
  }
  const spread=+((Math.max(...bins)-Math.min(...bins))/n).toFixed(4);
  /* and on the reach in front of you, more than one species actually shows up */
  const kindsHere=new Set(mix).size;

  /* swapping species over and over must not grow the group */
  const kids0=fishGroup.children.length;
  for(let i=0;i<4;i++){ P.spBrown=i%2; P.spSalmon=(i+1)%2; syncSpecies(); }
  const kids1=fishGroup.children.length;

  /* a fish you have ON stays on through a species change */
  for(const k of keys) P[k]=1; syncSpecies();
  const f0=fishes[0]; f0.state='hooked'; f0.stamina=0.6; hooked=f0;
  P.spBrook=0; syncSpecies(); P.spBrook=1; syncSpecies();
  const kept=f0.state==='hooked'&&Math.abs(f0.stamina-0.6)<1e-9&&hooked===f0;
  f0.state='holding'; hooked=null;

  /* Fish size is live, the mesh scale IS the length, and weight follows it
     CUBED — the card cannot disagree with what the rod feels */
  P.fishSize=1; for(const f of fishes) f.sizeSync();
  const l1=fishes[0].len, w1=fishes[0].weightOz();
  P.fishSize=2; for(const f of fishes) f.sizeSync();
  const l2=fishes[0].len, w2=fishes[0].weightOz(), s2=fishes[0].mesh.scale.x;
  P.fishSize=1; for(const f of fishes) f.sizeSync();
  const size={len:+(l2/l1).toFixed(3), wt:+(w2/w1).toFixed(2),
              scale:+(s2/l2).toFixed(3), back:+(fishes[0].len/l1).toFixed(3)};

  /* traits off means every fish reads a rainbow, traits on means it does not */
  P.spTraits=0;
  const flat=SPECIES_ORDER.every(id=>Object.keys(RAINBOW_BEH).every(
    k=>k==='fight'||beh({sp:SPECIES[id]},k)===RAINBOW_BEH[k]));
  P.spTraits=1;
  const varied=beh({sp:SPECIES.brown},'take')!==beh({sp:SPECIES.brook},'take');

  /* A SPECIES WITH NO MODEL OF ITS OWN STAYS PROCEDURAL. It must not borrow
     another species' mesh: with assets/trout.glb present — the normal case —
     the generic slot stood in for everything, so a brown, a brookie, a
     cutthroat and a salmon all rendered as the one rainbow model and the
     species were indistinguishable until you turned assets off. */
  P.assetOn=1;
  troutAssets.rainbow={geo:TROUT_GEO,mat:speciesBodyMat(SPECIES.rainbow),extra:[]};
  const borrow=SPECIES_ORDER.map(id=>id+':'+(makeTrout(0.4,SPECIES[id]).userData.fromAsset?'model':'procedural'));
  delete troutAssets.rainbow;
  const onlyRainbowModelled=borrow[0]==='rainbow:model'
    && borrow.slice(1).every(q=>q.endsWith(':procedural'));

  /* A LOADED FISH IS NOT MADE OF METAL. glTF defaults metallicFactor AND
     roughnessFactor to 1 when a file does not state them, and a model exported
     without a metal-roughness map is exactly the file that does not state
     them — assets/trout.glb is one. A metal has no diffuse term, everything it
     shows is what it reflects, and this scene carries no environment map, so
     the rainbow rendered as a black silhouette with a highlight sliding over
     it: measured on the display fish, RGB 5,5,3 out of 255. So the model's
     finish is held to the species' own paint before any fish is built from it,
     which is also what makes the wet-shine ramp start where it should. */
  const bareGltf=new THREE.MeshStandardMaterial({metalness:1,roughness:1});
  fishFinish(bareGltf,SPECIES.rainbow);
  P.assetOn=1;
  troutAssets.rainbow={geo:TROUT_GEO,mat:bareGltf,extra:[]};
  const lit=makeTrout(0.4,SPECIES.rainbow);
  const litMat=lit.userData.swim;          /* the body material, wave and all */
  const finish={metal:+bareGltf.metalness.toFixed(2), rough:+bareGltf.roughness.toFixed(2),
                fromAsset:!!lit.userData.fromAsset,
                metal0:+litMat.userData.metal0.toFixed(2),
                paint:SPECIES.rainbow.paint.metal};
  delete troutAssets.rainbow;
  const notMadeOfMetal = finish.fromAsset && finish.metal<=finish.paint+1e-9
                      && finish.metal0===finish.metal && finish.rough<0.98;

  /* and each one is reachable from the menu, so the phone gets it too */
  const rows=SPECIES_ORDER.every(id=>MENU.some(r=>r[1]===SPECIES[id].key)
                                     &&(SPECIES[id].key in P));
  const sizeRow=MENU.some(r=>r[1]==='fishSize')&&('fishSize' in P);

  applyPreset(before);
  return {built, errs, noneOn, allOn, stable, spread, kindsHere, borrow,
          onlyRainbowModelled, finish, notMadeOfMetal,
          kids:[kids0,kids1], kept, size, flat, varied,
          rows, sizeRow};
})()`,sandbox);
console.log('the species',spec);
if(spec.errs.length||!spec.noneOn||!spec.allOn||!spec.stable||
   spec.spread>0.03||spec.kindsHere<2||!spec.onlyRainbowModelled||
   !spec.notMadeOfMetal||
   spec.kids[0]!==spec.kids[1]||!spec.kept||
   spec.size.len!==2||Math.abs(spec.size.wt-8)>0.05||spec.size.scale!==1||
   spec.size.back!==1||!spec.flat||!spec.varied||!spec.rows||!spec.sizeRow)
  console.log('  *** SPECIES FAILURE ***');

/* These three run LAST on purpose. They press buttons, hook a fish, spook
   one and move another, and every one of those consumes RNG and leaves the
   reach in a different state — which is enough to change what a fight is
   doing at the moment a later test hops the rig, and that test measures the
   tension it finds. A new check should not be able to fail an old one by
   standing in front of it. */
/* ── DRIVING THE MENU WITH THE STICK AND THE FACE BUTTONS ──────────────
   The controls moved: the left hand opens the menu and owns the two resets,
   the right hand walks it. Every one of those is an edge on a gamepad button
   or a push on an axis nothing used to read, and every one of them is the kind
   of thing that is silently wrong in a headset ("nothing happens when I press
   that") rather than throwing. So they are driven here, through the real frame
   loop, off the real pads.

   Note the Raycaster stub returns no hits, so pointerOnMenu is false and the
   stick has the menu — which is exactly the state being tested. */
const nav=vm.runInContext(`(()=>{
  const loop=renderer._loop, out={};
  const press=(pad,i,n)=>{ pad.buttons[i].pressed=true; for(let k=0;k<(n||1);k++) loop();
                           pad.buttons[i].pressed=false; loop(); };
  const stick=(dx,dy,n)=>{ rodPad.axes[2]=dx; rodPad.axes[3]=dy;
                           for(let k=0;k<(n||1);k++) loop();
                           rodPad.axes[2]=0; rodPad.axes[3]=0; loop(); };
  /* the pads the game actually bound, not new ones */
  out.pads = !!rodPad && !!offPad && rodPad!==offPad;

  /* left stick click opens it, and again shuts it */
  toggleMenu(false);
  press(offPad,3); out.stickOpens=menuOpen;
  press(offPad,3); out.stickShuts=!menuOpen;
  /* B does the same from the right hand */
  press(rodPad,5); out.bOpens=menuOpen;

  /* up and down walk the rows of the tab you are on */
  selTab=TABS.findIndex(t=>t.name==='FISH'); menuSel=firstRowOf(selTab);
  const first=menuSel;
  stick(0,1); const second=menuSel;
  stick(0,1); const third=menuSel;
  stick(0,-1); const back=menuSel;
  out.rowsWalk = second!==first && third!==second && back===second;

  /* off the bottom of a tab wraps to the top of the same one: the tab bar is
     the way to another section, not the end of this one */
  const tabWas=selTab;
  const rows=TABS[selTab].rows; menuSel=rows[rows.length-1];
  stick(0,1);
  out.wrapsAtTheBottom = selTab===tabWas && menuSel===rows[0];

  /* UP OFF THE TOP ROW GOES INTO THE TAB BAR, and sideways walks it there */
  menuSel=firstRowOf(selTab);
  stick(0,-1);
  out.upIntoTheTabs = menuFocus==='tabs' && selTab===tabWas;
  stick(1,0);
  out.tabsGoRight = selTab===(tabWas+1)%TABS.length && menuFocus==='tabs';
  stick(-1,0);
  out.tabsGoLeft = selTab===tabWas;
  /* up again is already as high as it goes — it must not fall out of the bar */
  stick(0,-1);
  out.tabsAreTheTop = menuFocus==='tabs';
  /* down drops into the rows of whichever tab you stopped on */
  stick(0,1);
  out.downIntoTheRows = menuFocus==='rows' && menuSel===firstRowOf(selTab);
  /* and A does the same thing from up there */
  stick(0,-1);
  press(rodPad,4);
  out.aOpensTheTab = menuFocus==='rows' && menuSel===firstRowOf(selTab);
  /* nothing sideways in the bar may touch a setting */
  const watch=P.takeRadius;
  stick(0,-1); stick(1,0); stick(-1,0); stick(0,1);
  out.tabsTouchNoSetting = P.takeRadius===watch;

  /* left and right move the value by its own step, exactly */
  menuFocus='rows';
  selTab=TABS.findIndex(t=>t.name==='FISH');
  const row=MENU.findIndex(r=>r[1]==='takeRadius');
  menuSel=row; P.takeRadius=0.70;
  const st=MENU[row][4];
  stick(1,0); const up=P.takeRadius;
  stick(-1,0); const down=P.takeRadius;
  out.step={st, up:+up.toFixed(4), down:+down.toFixed(4)};
  out.oneStepUp   = Math.abs(up-(0.70+st))<1e-6;
  out.oneStepBack = Math.abs(down-0.70)<1e-6;

  /* held, it repeats — but only after a beat, so a flick is one step */
  P.takeRadius=0.70; menuSel=row;
  rodPad.axes[2]=1; for(let k=0;k<3;k++) loop();
  const flick=P.takeRadius;
  for(let k=0;k<40;k++) loop();
  const held=P.takeRadius;
  rodPad.axes[2]=0; loop();
  out.flickIsOneStep = Math.abs(flick-(0.70+st))<1e-6;
  out.holdRepeats = held>flick+st*0.5;

  /* a value is never driven outside its own range */
  const [lo,hi]=rowRange('takeRadius',MENU[row][2],MENU[row][3]);
  P.takeRadius=hi; menuSel=row; stick(1,0,2);
  out.clampsHigh = P.takeRadius<=hi+1e-9;
  P.takeRadius=lo; stick(-1,0,2);
  out.clampsLow = P.takeRadius>=lo-1e-9;
  P.takeRadius=0.70;

  /* clicking the right stick is the next tab */
  selTab=0; menuSel=firstRowOf(0);
  press(rodPad,3);
  out.stickClickTabs = selTab===1;

  /* A pushes an action row, and steps the range of one that is not */
  selTab=TABS.findIndex(t=>t.name==='PRESETS');
  menuSel=MENU.findIndex(r=>r[1]==='!recenter');
  menu.mesh.position.set(9,9,9);
  press(rodPad,4);
  out.aPushesAction = menu.mesh.position.x!==9;
  menuSel=row; RANGEX['takeRadius']=1;
  press(rodPad,4);
  out.aStepsRange = RANGEX['takeRadius']!==1;
  RANGEX['takeRadius']=1;

  /* the pointer wins while the ray is on the panel */
  selTab=TABS.findIndex(t=>t.name==='FISH'); menuSel=firstRowOf(selTab);
  const keep=menuSel;
  pointerOnMenu=true; stick(0,1); pointerOnMenu=false;
  out.pointerWins = menuSel===keep;

  /* and the whole thing can be switched off */
  P.stickNav=0; stick(0,1); P.stickNav=1;
  out.navOffIsOff = menuSel===keep;

  /* the left hand's two resets, from the buttons that now carry them */
  toggleMenu(false);
  lineOut=3.0; press(offPad,4); out.xResets = lineOut>7.0;
  fishes[0].state='spooked'; press(offPad,5); out.yReseats = fishes[0].state==='holding';

  /* A with the menu shut is the stats window */
  P.showStats=0; applyDisplay();
  press(rodPad,4); out.aShowsStats = P.showStats>0.5 && hud.mesh.visible;
  press(rodPad,4); out.aHidesStats = P.showStats<0.5 && !hud.mesh.visible;
  return out;
})()`,sandbox);
console.log('menu navigation',nav);
{
  const bad=Object.entries(nav).filter(([k,v])=>v===false).map(([k])=>k);
  if(bad.length) console.log('  *** MENU NAVIGATION FAILURE:',bad.join(', '),'***');
}

/* The ghost has to say what the buttons now do. A label that lies is worse
   than no label, and the words are the only place the new map is written down
   where a player can read it. */
const ghost=vm.runInContext(`(()=>{
  P.handGuide=1; buildGuide(); renderer._loop();
  const out={hands:GUIDE.hands.length}, missing=[], toolong=[];
  const seen={};
  for(const [name,parts] of [['right',GUIDE_RIGHT],['left',GUIDE_LEFT]]){
    for(const [key,at,to] of parts){
      const k=name+':'+to.join(',');
      if(seen[k]) missing.push(name+' two labels in one place');
      seen[k]=1;
      for(const open of [false,true]){
        menuOpen=open;
        const w=guideWords(key,name);
        if(!w||!w[0]) { missing.push(name+'/'+key+(open?' (menu open)':'')); continue; }
        /* 22 px Space Mono over 302 usable px is ~22 characters, and the plate
           holds three wrapped lines before it stops drawing */
        if(String(w[1]||'').length>66) toolong.push(name+'/'+key+' '+w[1].length);
      }
    }
  }
  menuOpen=false;
  out.keys=[...GUIDE_RIGHT.map(r=>'R:'+r[0]),...GUIDE_LEFT.map(r=>'L:'+r[0])].join(' ');
  out.silent=missing; out.overflowing=toolong;
  /* the map itself: X and Y are the resets, A and B are on the rod hand */
  out.leftHasXY = GUIDE_LEFT.some(r=>r[0]==='x') && GUIDE_LEFT.some(r=>r[0]==='y');
  out.rightHasAB = GUIDE_RIGHT.some(r=>r[0]==='a') && GUIDE_RIGHT.some(r=>r[0]==='b');
  out.rightHasStick = GUIDE_RIGHT.some(r=>r[0]==='stick');
  out.noYOnRight = !GUIDE_RIGHT.some(r=>r[0]==='y');
  menuOpen=true; const a=guideWords('a','right'); menuOpen=false;
  const a2=guideWords('a','right');
  out.aWordsFollowMenu = a[0]!==a2[0];
  return out;
})()`,sandbox);
console.log('control guide',ghost);
if(ghost.silent.length||ghost.overflowing.length||!ghost.leftHasXY||!ghost.rightHasAB||
   !ghost.rightHasStick||!ghost.noYOnRight||!ghost.aWordsFollowMenu)
  console.log('  *** CONTROL GUIDE FAILURE ***');

/* ── THE TENSION MARKER AND THE FLOATING MESSAGE ──────────────────────── */
const disp=vm.runInContext(`(()=>{
  const loop=renderer._loop, out={};
  const red=h=>(h>>16)&255, grn=h=>(h>>8)&255;
  /* the ramp: green at slack, red at the tippet, and never going backwards */
  const at=r=>tensionRamp(r);
  out.slackIsGreen = grn(at(0))>red(at(0));
  out.breakingIsRed = red(at(1.0))>grn(at(1.0))*2;
  let mono=true, last=-1e9;
  for(let r=0;r<=1.201;r+=0.02){
    const v=red(at(r))-grn(at(r));
    if(v<last-1) mono=false;
    last=v;
  }
  out.rampIsMonotone=mono;
  out.overTippetStaysRed = red(at(1.2))>200;
  /* the blink only ever darkens, and only in the last fifth */
  let dims=true, quiet=true, brighter=false;
  for(let k=0;k<80;k++){
    const t=k*0.017;
    if(tensionColour(0.5,t)!==at(0.5)) quiet=false;
    const c=tensionColour(0.98,t);
    if(red(c)>red(at(0.98))+1) brighter=true;
    if(red(c)<red(at(0.98))-8) dims=false;   /* it does dim somewhere */
  }
  out.blinkOnlyNearTheBreak = quiet;
  out.blinkNeverBrightens = !brighter;
  out.blinkActuallyBlinks = !dims;

  /* the post over a hooked fish shows even with the forest of posts off */
  P.showMarkers=0; P.tensionMark=1;
  const f=fishes[0]; f.state='holding'; loop();
  out.holdingHiddenWithMarkersOff = !f.marker.visible;
  runAction('!hookfish'); loop();
  out.hookedShows = !!hooked && hooked.marker.visible;
  /* and it is the colour the tension says it is */
  M.tension=P.tippet*0.02; loop(); const cool=hooked.marker.children[1].material.color.getHex();
  M.tension=P.tippet*0.75; loop(); const hot =hooked.marker.children[1].material.color.getHex();
  out.colourFollowsTension = red(hot)>red(cool) && grn(hot)<grn(cool);
  P.tensionMark=0; loop(); out.offIsOff = !hooked.marker.visible;
  P.tensionMark=1; P.showMarkers=1;
  if(hooked) hooked.spook('test done',1);
  M.tension=0; loop();

  /* the stats window ships off, and the words go into the world instead */
  out.statsOffByDefault = SHIPPED_SHOWSTATS===0;
  P.showStats=0; applyDisplay(); out.statsHidden=!hud.mesh.visible;
  P.showStats=1; applyDisplay(); out.statsShows=hud.mesh.visible;
  P.showStats=0; applyDisplay();

  P.msgMode=0; P.msgSecs=6; say('a message about nothing');
  loop(); loop();
  out.toastShows = toast.mesh.visible && toastSaid==='a message about nothing';
  /* gaze mode puts it in front of the eye */
  const eye=new THREE.Vector3(); camera.getWorldPosition(eye);
  for(let k=0;k<40;k++) loop();
  out.gazeDistance = +toast.mesh.position.distanceTo(eye).toFixed(2);
  out.inFrontOfYou = Math.abs(out.gazeDistance-P.msgDist)<0.45;

  /* at the fish, it is at the fish */
  P.msgMode=1;
  const g=fishes[1]; g.p.set(4,0.3,-6);
  say('over this one',g);
  for(let k=0;k<6;k++) loop();
  out.atFishDistance = +Math.hypot(toast.mesh.position.x-4,toast.mesh.position.z+6).toFixed(3);
  out.sitsOnTheFish = out.atFishDistance<0.01;
  /* a message about nothing in particular still follows the gaze */
  say('settings copied');
  for(let k=0;k<6;k++) loop();
  out.anchorlessFallsBack = toast.mesh.position.distanceTo(eye)<P.msgDist+1.2;

  /* mode 2 is the old behaviour: the stats window and nothing else */
  /* chatter is chatter: it reaches the stats window and stops there */
  P.msgChatter=0; P.msgMode=0; say('a real event');
  for(let k=0;k<4;k++) loop();
  say('fish: run',fishes[0],true);
  for(let k=0;k<4;k++) loop();
  out.chatterStaysOffTheSky = toastSaid==='a real event' && note==='fish: run';
  P.msgChatter=1; say('fish: sound',fishes[0],true);
  for(let k=0;k<4;k++) loop();
  out.chatterOnFloats = toastSaid==='fish: sound';
  P.msgChatter=0;

  P.msgMode=2; say('quiet please');
  for(let k=0;k<20;k++) loop();
  out.mode2Silent = !toast.mesh.visible;
  P.msgMode=0;
  /* and it goes away on its own */
  P.msgSecs=1; say('brief');
  for(let k=0;k<140;k++) loop();
  out.fades = !toast.mesh.visible;
  P.msgSecs=3.6; P.msgMode=0;
  for(const f of fishes) f.reseat();          /* leave the reach as we found it */
  return out;
})()`.replace('SHIPPED_SHOWSTATS',JSON.stringify(shipped.showStats)),sandbox);
console.log('markers and messages',disp);
{
  const bad=Object.entries(disp).filter(([k,v])=>v===false).map(([k])=>k);
  if(bad.length) console.log('  *** MARKER / MESSAGE FAILURE:',bad.join(', '),'***');
}

/* ── THE PRESENTATION ZONE ─────────────────────────────────────────────
   `latTol` and `upMax` used to appear in exactly ONE place in the file — the
   four vertices of the quad the zone was drawn from — and in no test a fish
   ever applied. That is the failure this is guarding against coming back: a
   picture of a rule with no rule under it. So every claim below is driven
   through the same fitZone/zoneStep/judge the frame loop calls, on real fish
   in the real reach. */
const zone=vm.runInContext(`(()=>{
  const out={}, was={auto:P.zoneAuto, clear:P.zoneClear, up:P.upMax,
                     lat:P.latTol, min:P.zoneMin, slip:P.maxSlip};
  for(const f of fishes) f.reseat();
  const f=fishes[0];
  const put=(x,z,depth)=>{ f.p.set(x,surfY(x)-depth,z); f.fitZone(); };

  /* OFF: every fish gets exactly the box the two sliders describe */
  P.zoneAuto=0; put(0,-6,0.42);
  out.offIsExactly = Math.abs(f.zoneUp-P.upMax)<1e-9 && Math.abs(f.zoneHalf-P.latTol)<1e-9;

  /* ON, in open water: Snell's window, so a DEEPER fish gets a longer and a
     wider box than a shallow one. This is the whole reason a pool fish wants
     a long clean drift and a pocket fish will forgive a short one. */
  P.zoneAuto=1;
  /* somewhere with nothing upstream of it, so only the window is talking */
  const clean=(()=>{
    const scan=ZONE_SCAN(P.upMax);            /* the game's own rule, not ours */
    for(let x=-30;x<30;x+=1){
      let free=true;
      for(const o of OBST) if(o.x<x&&x-o.x<scan&&Math.abs(o.z+6)<o.r+3) free=false;
      for(const d of DROPS) if(d.x+d.w<x&&x-(d.x+d.w)<scan&&d.h*P.grade>=0.06) free=false;
      if(free) return x;
    }
    return null;
  })();
  out.foundOpenWater = clean!==null;
  if(clean!==null){
    put(clean,-6,0.15); const shallow={up:+f.zoneUp.toFixed(2), half:+f.zoneHalf.toFixed(2)};
    put(clean,-6,1.20); const deep   ={up:+f.zoneUp.toFixed(2), half:+f.zoneHalf.toFixed(2)};
    out.window={shallow,deep};
    out.deeperSeesFurther = deep.up>shallow.up*1.4;
    out.deeperSeesWider   = deep.half>shallow.half*1.2;
  }

  /* ON, behind a rock — and WHICH half of the rule applies is decided by
     whether the water is going over it. A drowned boulder is a seam the fly
     can drift through, so the box reaches past it and the drift has to survive
     it. One standing out of the river is not a seam, it is a wall: nothing
     drifts over it, the presentation starts below it, and a box reaching past
     it asks for a cast the water cannot receive. Same rock, twice, with
     Obstacle height deciding which it is. */
  const rock=OBST[0];
  const wasH=P.obstHeight;
  P.zoneClear=0.8;
  /* sink it until its crown is a clear 25 cm under the film. The crown is the
     centre the mesh is placed at PLUS the vertical semi-axis, which is the same
     arithmetic the collision test and the zone rule use — write it out here and
     the test cannot quietly disagree with them. */
  const sinkTo=(o,under)=>Math.max(0.02,
    ((surfY(o.x)-bedY(o.x,o.z))-under-o.r*(o.kind==='log'?0.55:0.72))/o.h);
  P.obstHeight=sinkTo(rock,0.25);
  put(rock.x+2.2,rock.z,0.35);
  const need=2.2+rock.r+P.zoneClear;
  out.rock={dx:2.2, r:+rock.r.toFixed(2), zoneUp:+f.zoneUp.toFixed(2),
            needs:+need.toFixed(2), why:f.zoneWhy};
  out.reachesPastTheSunkRock = f.zoneUp>=need-1e-6 && f.zoneWhy==='rock';
  /* and Zone clear is what buys that extra drift */
  P.zoneClear=2.0; f.fitZone();
  out.clearBuysDrift = f.zoneUp>=2.2+rock.r+2.0-1e-6;
  P.zoneClear=0.8;
  /* the same rock, standing out of the water */
  P.obstHeight=wasH; f.fitZone();
  out.proud={zoneUp:+f.zoneUp.toFixed(2), face:+(2.2-rock.r).toFixed(2), why:f.zoneWhy};
  out.stopsAtTheProudRock = Math.abs(f.zoneUp-(2.2-rock.r))<0.02 && f.zoneWhy==='rock';
  P.obstHeight=sinkTo(rock,0.25);
  /* a rock OUT OF HIS LINE is not his problem */
  put(rock.x+2.2,rock.z+rock.r+4.0,0.35);
  out.rockOffToTheSideIgnored = f.zoneWhy!=='rock';
  P.obstHeight=wasH;

  /* ON, below a lip: same again for a drop in the free surface */
  const lip=DROPS.filter(d=>d.h*P.grade>=0.06).sort((a,b)=>a.x-b.x)[0];
  if(lip){
    /* far enough below it that the window alone would not reach, and inside
       the scan, so the lip is what is doing the work */
    const dxL=Math.min(ZONE_SCAN(P.upMax)-0.3,P.upMax*1.1);
    put(lip.x+lip.w+dxL,-6,0.35);
    out.drop={dx:+dxL.toFixed(2), zoneUp:+f.zoneUp.toFixed(2), why:f.zoneWhy};
    out.reachesPastTheLip = f.zoneWhy==='drop'&&f.zoneUp>=dxL+lip.w*0.5+P.zoneClear-1e-6;
    /* and a fish a long way below the same lip is NOT holding under it */
    put(lip.x+lip.w+ZONE_SCAN(P.upMax)+6,-6,0.35);
    out.farBelowIsNotUnderIt = f.zoneWhy==='window'&&f.zoneUp<P.upMax*1.8;
  }

  /* the floor holds however thin the water gets */
  P.zoneMin=2.5; put(clean===null?0:clean,-6,0.02);
  out.floorHolds = f.zoneUp>=2.5-1e-9;
  P.zoneMin=was.min;

  /* ── WHAT IT MEASURES ───────────────────────────────────────────────── */
  P.zoneAuto=0; P.upMax=4; P.latTol=0.8; put(0,-6,0.42);
  const dt=1/45;
  /* a fly coming the whole way down the box, behaving itself */
  f.zoneReset();
  for(let x=-4.0;x<=0.001;x+=0.05) f.zoneStep(dt,x,-6,0.02,true);
  const full=f.judge(0.02,true,9.0);
  out.fullDrift={cover:+full.cover.toFixed(2), avg:+full.avgSlip.toFixed(3), clean:full.clean};
  out.coversTheWholeBox = full.cover>0.92 && full.clean;
  /* THE FALLBACK IS NOT USED once he has watched something: 9.0 m/s of
     whole-cast average is filthy, and he judged the box instead. */
  out.ignoresTheRestOfTheCast = full.avgSlip<0.05;

  /* the same fly, dragging only in the last third — which the old whole-cast
     average would have forgiven and he must not */
  f.zoneReset();
  for(let x=-4.0;x<=0.001;x+=0.05) f.zoneStep(dt,x,-6,x>-1.3?0.9:0.02,true);
  const late=f.judge(0.9,true,0.0);
  out.lateDrag={avg:+late.avgSlip.toFixed(3), clean:late.clean};
  out.dragInFrontOfHimIsNotForgiven = !late.clean;

  /* and the reverse: filthy above the box, honest inside it */
  f.zoneReset();
  for(let x=-9.0;x<-4.2;x+=0.05) f.zoneStep(dt,x,-6,1.4,true);   /* outside */
  for(let x=-4.0;x<=0.001;x+=0.05) f.zoneStep(dt,x,-6,0.02,true);
  const early=f.judge(0.02,true,1.4);
  out.earlyDrag={avg:+early.avgSlip.toFixed(3), clean:early.clean};
  out.dragAboveTheBoxIsNotHeld = early.clean;

  /* a fly that appears on his head has covered none of it */
  f.zoneReset();
  for(let x=-0.30;x<=0.001;x+=0.03) f.zoneStep(dt,x,-6,0.02,true);
  const onHisHead=f.judge(0.02,true,0.02);
  out.onHisHead={cover:+onHisHead.cover.toFixed(2), pres:+onHisHead.pres.toFixed(2)};
  out.noDriftIsWorthLess = onHisHead.pres<full.pres*0.5 && onHisHead.chance<full.chance*0.5;

  /* out to the side of the box he is not judging it at all */
  f.zoneReset();
  for(let x=-4.0;x<=0.001;x+=0.05) f.zoneStep(dt,x,-6+P.latTol+0.4,0.02,true);
  out.outsideIsNotWatched = f.zoneT===0;
  /* and passing him resets the book, so the next cast starts clean */
  f.zoneReset();
  for(let x=-4.0;x<=0.001;x+=0.05) f.zoneStep(dt,x,-6,0.02,true);
  f.zoneStep(dt,1.5,-6,0.02,true);
  out.passingHimResets = f.zoneT===0 && f.zoneRun===0;

  /* slack water has no upstream and no drift, so the box says nothing and the
     old whole-cast average is what is left — this is what keeps the pond sane */
  f.zoneReset();
  const still=f.judge(0.02,false,0.02);
  out.slackWaterFallsBack = still.cover===1 && still.pres===1;

  /* ── ALL FOUR SIDES OF IT ───────────────────────────────────────────── */
  P.showZones=1; renderer._loop();
  const g=zoneBoxes[0].geometry.attributes.position.array;
  const segs=g.length/6;
  out.segments=segs;
  out.isTwoSidesPlusTwoEnds = segs===ZSEG*2+2;
  /* the last two segments are the cross members: constant x, spanning z */
  const seg=i=>({ax:g[i*6],az:g[i*6+2],bx:g[i*6+3],bz:g[i*6+5]});
  const e1=seg(segs-2), e2=seg(segs-1);
  out.endsAreClosed = Math.abs(e1.ax-e1.bx)<1e-6 && Math.abs(e1.az-e1.bz)>0.05
                   && Math.abs(e2.ax-e2.bx)<1e-6 && Math.abs(e2.az-e2.bz)>0.05
                   && Math.abs(e1.ax-e2.ax)>0.5;
  /* every vertex sits ON the water, which is what the sampling along the long
     sides is for — two corners cannot follow a surface with a drop in it */
  let offWater=0;
  for(let i=0;i<g.length;i+=3) if(Math.abs(g[i+1]-(surfY(g[i])+0.03))>1e-6) offWater++;
  out.everyVertexOnTheWater = offWater===0;

  for(const k in was) {}
  P.zoneAuto=was.auto; P.zoneClear=was.clear; P.upMax=was.up;
  P.latTol=was.lat; P.zoneMin=was.min; P.maxSlip=was.slip;
  for(const q of fishes) q.reseat();
  renderer._loop();
  return out;
})()`,sandbox);
console.log('the presentation zone',zone);
{
  const bad=Object.entries(zone).filter(([k,v])=>v===false).map(([k])=>k);
  if(bad.length) console.log('  *** PRESENTATION ZONE FAILURE:',bad.join(', '),'***');
}

console.log('OK');
