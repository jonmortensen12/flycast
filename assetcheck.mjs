/* Check the model assets are geometrically sane, without a GPU or a headset.

   The trout model has two eyes, correctly mirrored — and one of them was
   INVISIBLE, because the head is sculpted lopsided: at the eye station the
   hull runs z -0.041 .. +0.062, so its midline is +0.010 while the eyes sit
   symmetric about zero. That put the +z eye 18 mm under the skin and left the
   -z one standing 2.4 mm proud. One eye, and nothing wrong with the eyes.

   Fixed by mirroring the buried eye about the head's own midline — one node
   translation in the GLB, BIN chunk untouched, no vertex data rewritten. This
   is the guard on that, and on anything like it in a future model.

   Run: node assetcheck.mjs                                                  */
import fs from 'fs';
function load(path){
  const b=fs.readFileSync(path);
  let off=12,chunks=[];
  while(off<b.length){const len=b.readUInt32LE(off),type=b.toString("ascii",off+4,off+8);
    chunks.push({type,len,start:off+8});off+=8+len;}
  return {b,json:JSON.parse(b.toString("utf8",chunks[0].start,chunks[0].start+chunks[0].len)),
          BIN:chunks[1].start};
}
const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,c){const o=new Array(16);
  for(let q=0;q<4;q++)for(let r=0;r<4;r++){let s=0;
    for(let k=0;k<4;k++)s+=a[k*4+r]*c[q*4+k];o[q*4+r]=s;}return o;}
function trs(n){const t=n.translation||[0,0,0],q=n.rotation||[0,0,0,1],s=n.scale||[1,1,1];
  const [x,y,z,w]=q,x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,
        wx=w*x2,wy=w*y2,wz=w*z2;
  return [(1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,
          (xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0,
          (xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0,t[0],t[1],t[2],1];}
const xf=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
                 m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
                 m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
function report(path,label){
  const {b,json,BIN}=load(path);
  const got={};
  function verts(mi,m){
    const a=json.accessors[json.meshes[mi].primitives[0].attributes.POSITION];
    const bv=json.bufferViews[a.bufferView];
    const base=BIN+(bv.byteOffset||0)+(a.byteOffset||0), st=bv.byteStride||12, o=[];
    for(let i=0;i<a.count;i++){const q=base+i*st;
      o.push(xf(m,[b.readFloatLE(q),b.readFloatLE(q+4),b.readFloatLE(q+8)]));}
    return o;
  }
  (function walk(i,par){const n=json.nodes[i];const m=mul(par,trs(n));
    if(n.mesh!==undefined) got[json.meshes[n.mesh].name]=verts(n.mesh,m);
    for(const c of (n.children||[])) walk(c,m);})(json.scenes[0].nodes[0],I());
  const body=got["Cat_bone_0.001"], A=got["Sphere_0.001"], B=got["Sphere.001_0.001"];
  const stat=v=>{const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
    for(const p of v)for(let a=0;a<3;a++){mn[a]=Math.min(mn[a],p[a]);mx[a]=Math.max(mx[a],p[a]);}
    return {c:mn.map((m,i)=>(m+mx[i])/2), r:mn.map((m,i)=>(mx[i]-m)/2)};};
  const a=stat(A), bb=stat(B);
  const X=(a.c[0]+bb.c[0])/2;
  const slab=body.filter(p=>Math.abs(p[0]-X)<0.02);
  let zmin=1e9,zmax=-1e9;
  for(const p of slab){zmin=Math.min(zmin,p[2]);zmax=Math.max(zmax,p[2]);}
  const proud=(c,r,side)=>side>0 ? (c+r)-zmax : zmin-(c-r);
  console.log("\n"+label);
  console.log("  head at the eye station: z", zmin.toFixed(4),"..",zmax.toFixed(4));
  const pa=proud(a.c[2],a.r[2],+1), pb=proud(bb.c[2],bb.r[2],-1);
  for(const [nm,c,r,pr] of [['A',a.c[2],a.r[2],pa],['B',bb.c[2],bb.r[2],pb]]){
    const ok=pr>0;
    if(!ok) fails++;
    console.log('  '+(ok?'ok  ':'*** FAIL: ')+'eye '+nm+' centre z '+c.toFixed(4)+
      ' radius '+r.toFixed(4)+' -> stands '+pr.toFixed(4)+
      (ok?' proud of the skin':' UNDER THE SKIN — it will not be visible'));
  }
  /* and they should stand out by the same amount, or one reads as sunken */
  const even=Math.abs(pa-pb)<0.002;
  if(!even) fails++;
  console.log('  '+(even?'ok  ':'*** FAIL: ')+'both eyes stand out by the same amount ('+
    pa.toFixed(4)+' vs '+pb.toFixed(4)+')');
}
let fails=0;
report('assets/trout.glb','trout.glb');
console.log(fails?'\n*** '+fails+' FAILED ***':'\nOK');
process.exit(fails?1:0);
