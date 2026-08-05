import json, os, shutil, subprocess, sys
import numpy as np, cv2
SRC=('/mnt/user-data/uploads/YTDown.com_YouTube_How-to-Fly-Cast-Slow-Motion'
     '-Hi-Vis-Fly-C_Media_hxMSwFg1cn0_001_1080p')
K=json.load(open('kin_in.json'))
runs=[(lbl,json.load(open(fn))) for lbl,fn in json.loads(sys.argv[1])]
OUT=sys.argv[2]
PW,PH=640,380
TRK=(90,230,255); SIM=(255,200,90); FONT=cv2.FONT_HERSHEY_SIMPLEX
CX0,CY0,CX1,CY1=700,420,1920,1000
sc=PW/(CX1-CX0); pxm=K['pxm']
def poly(img,pts,col,w):
    q=[(int((x-CX0)*sc),int((y-CY0)*sc)) for x,y in pts]
    for i in range(1,len(q)):
        if abs(q[i][0]-q[i-1][0])+abs(q[i][1]-q[i-1][1])<500:
            cv2.line(img,q[i-1],q[i],col,w,cv2.LINE_AA)
# rebuild the background so we can show the detected rod+line mask directly,
# which is the honest picture of what the tracker actually sees
def build_bg(step=13,n=70):
    c=cv2.VideoCapture(SRC); fr=[]; i=0
    while len(fr)<n:
        ok,f=c.read()
        if not ok: break
        if i%step==0: fr.append(f)
        i+=1
    c.release(); return np.median(np.stack(fr),axis=0).astype(np.uint8)
BG=build_bg()
def maskpts(f):
    hsv=cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
    H=hsv[:,:,0].astype(np.int16);S2=hsv[:,:,1].astype(np.int16);V=hsv[:,:,2].astype(np.int16)
    g=((H>=38)&(H<=92)&(S2>=95)&(V>=55)).astype(np.uint8)
    d=cv2.absdiff(f,BG).max(axis=2)
    m=((d>26).astype(np.uint8)&g)
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8)); m[985:,:]=0
    return m
cap=cv2.VideoCapture(SRC); cap.set(cv2.CAP_PROP_POS_FRAMES,int(K['win'][0]*29.97))
os.makedirs('out',exist_ok=True); shutil.rmtree('out'); os.makedirs('out')
errs={l:[] for l,_ in runs}
n=len(K['t'])
for k in range(n):
    ok,frame=cap.read()
    if not ok: break
    sub=cv2.resize(frame[CY0:CY1,CX0:CX1],(PW,int((CY1-CY0)*sc)))
    pad=np.zeros((PH,PW,3),np.uint8); pad[:min(PH,sub.shape[0])]=sub[:PH]
    trod=K['trod'][k]; tline=K['tline'][k]
    mm=cv2.resize(maskpts(frame)[CY0:CY1,CX0:CX1],(PW,int((CY1-CY0)*sc)),interpolation=cv2.INTER_NEAREST)
    mpad=np.zeros((PH,PW),np.uint8); mpad[:min(PH,mm.shape[0])]=mm[:PH]
    p1=pad.copy(); p1[mpad>0]=(0,255,0); poly(p1,trod,TRK,3); poly(p1,tline,TRK,2)
    cv2.putText(p1,'VIDEO + TRACKING',(10,20),FONT,0.5,TRK,1,cv2.LINE_AA)
    p2=np.full((PH,PW,3),18,np.uint8)
    p2[mpad>0]=(70,190,70)
    poly(p2,trod,TRK,3); poly(p2,tline,TRK,2)
    cv2.putText(p2,'TRACKED  green=detected line  amber=rod fit',(10,20),FONT,0.45,TRK,1,cv2.LINE_AA)
    panels=[p1,p2]
    for lbl,sim in runs:
        s=sim[min(k,len(sim)-1)]
        ox=trod[0][0]+s['rod'][0][0]*pxm; oy=trod[0][1]+s['rod'][0][1]*pxm
        srod=[(ox-p[0]*pxm,oy-p[1]*pxm) for p in s['rod']]
        sline=[(ox-p[0]*pxm,oy-p[1]*pxm) for p in s['line']]
        p=np.full((PH,PW,3),18,np.uint8); poly(p,srod,SIM,3); poly(p,sline,SIM,2)
        cv2.putText(p,'SIM: '+lbl,(10,20),FONT,0.5,SIM,1,cv2.LINE_AA)
        o=np.full((PH,PW,3),18,np.uint8)
        poly(o,trod,TRK,3); poly(o,tline,TRK,2); poly(o,srod,SIM,3); poly(o,sline,SIM,2)
        cv2.putText(o,'OVERLAY  amber = video   cyan = sim',(10,20),FONT,0.5,(235,235,235),1,cv2.LINE_AA)
        panels+= [p,o]
        if tline and sline:
            A=np.array(tline,float); B=np.array(sline,float)
            d=np.sqrt(((A[:,None,:]-B[None,:,:])**2).sum(-1)).min(1)
            errs[lbl].append(d.mean()/pxm)
    rows=(len(panels)+1)//2
    grid=np.zeros((PH*rows,PW*2,3),np.uint8)
    for i,p in enumerate(panels):
        grid[(i//2)*PH:(i//2+1)*PH,(i%2)*PW:(i%2+1)*PW]=p
    band=np.full((30,PW*2,3),12,np.uint8)
    cv2.putText(band,f"t {K['t'][k]:5.2f}s real time    rod {K['ang'][k]:6.1f} deg    "
                     f"source is {K['slowmo']:.1f}x slow motion",(10,21),FONT,0.5,(200,210,210),1,cv2.LINE_AA)
    cv2.imwrite(f'out/f{k:04d}.png',np.vstack([band,grid]))
cap.release()
for l,e in errs.items():
    if e: print(f'{l}: mean line mismatch {np.mean(e):.2f} m')
subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','24','-i','out/f%04d.png',
 '-c:v','libx264','-pix_fmt','yuv420p','-crf','22','-movflags','+faststart',OUT],check=True)
print('wrote',OUT)
