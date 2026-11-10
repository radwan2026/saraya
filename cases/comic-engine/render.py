import sys, math, random, subprocess, numpy as np
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
from shots import SHOTS
B='/tmp/claude-0/-home-user-saraya/5ff36b23-2257-528a-8aa2-85aceb2b057c/scratchpad/'
FD=B+'fonts/full/package/'
AM=FD+'700Bold/Amiri_700Bold.ttf'; RQ=FD+'700Bold/ArefRuqaa_700Bold.ttf'; LZ=FD+'400Regular/Lalezar_400Regular.ttf'
import os
VERT=os.environ.get('MODE')=='v'
if VERT: W,H,FPS=1080,1920,30; P=880; M=60
else: W,H,FPS=1920,1080,30; P=900; M=90
PX,PY=60,250  # vertical panel position
TXT0,TXT1=1170,1600  # vertical text area
TOFF=420 if VERT else 0  # title y offset
@lru_cache(None)
def F(path,size): return ImageFont.truetype(path,size,layout_engine=ImageFont.Layout.RAQM)
def ease(x): x=min(max(x,0),1); return x*x*(3-2*x)
def eout(x): x=min(max(x,0),1); return 1-(1-x)**3

# ---------- background page ----------
def make_bg():
    rng=np.random.default_rng(7)
    yy,xx=np.mgrid[0:H,0:W]
    base=np.array([27,21,16],float)
    v=1-0.55*(((xx-W/2)/(W*0.62))**2+((yy-H/2)/(H*0.62))**2)
    img=base*np.clip(v,0.25,1)[...,None]
    img+=rng.normal(0,3.5,(H,W,1))
    # fibers
    im=Image.fromarray(np.clip(img,0,255).astype('uint8'))
    d=ImageDraw.Draw(im)
    for _ in range(500):
        x,y=rng.integers(0,W),rng.integers(0,H); l=rng.integers(10,60); a=rng.random()*6.28
        c=int(rng.integers(32,48))
        d.line([(x,y),(x+l*math.cos(a),y+l*math.sin(a))],fill=(c,c-6,c-12),width=1)
    # halftone corners
    for cy in range(0,H,18):
        for cx in range(0,W,18):
            r=max(0,1-((cx/W-0.0)**2+(cy/H-1.0)**2)**0.5*2.2)*5.5
            r2=max(0,1-((cx/W-1.0)**2+(cy/H-0.0)**2)**0.5*2.2)*5.5
            rr=max(r,r2)
            if rr>0.6: d.ellipse([cx-rr,cy-rr,cx+rr,cy+rr],fill=(52,40,28))
    return im.filter(ImageFilter.GaussianBlur(0.6))
BG=make_bg()
BGH=BG
if VERT:
    BGH=BG.copy(); dh=ImageDraw.Draw(BGH)
    dh.text((W/2,170),'ملفات السرايا',font=F(RQ,58),fill=(200,160,78),anchor='mm',direction='rtl',language='ar')
    dh.text((W/2,222),'القضية الأولى',font=F(AM,30),fill=(170,155,125),anchor='mm',direction='rtl',language='ar')
GRAIN=[np.random.default_rng(i).normal(0,6.5,(H,W,1)).astype(np.int16) for i in range(6)]

# ---------- text helpers ----------
def wrap(text,font,maxw):
    words=text.split(' '); lines=[]; cur=''
    for w_ in words:
        t=(cur+' '+w_).strip()
        if font.getlength(t,direction='rtl',language='ar')<=maxw or not cur: cur=t
        else: lines.append(cur); cur=w_
    if cur: lines.append(cur)
    return lines

STY=dict(cap=dict(f=AM,s=40,bg=(233,221,181),ink=(25,18,12),ol=(10,8,6)),
         em =dict(f=AM,s=46,bg=(233,221,181),ink=(170,20,15),ol=(10,8,6)),
         say=dict(f=AM,s=38,bg=(247,243,233),ink=(18,14,10),ol=(10,8,6)),
         tape=dict(f=AM,s=38,bg=(16,26,18),ink=(160,235,150),ol=(90,150,90)),
         tag=dict(f=AM,s=32,bg=(140,22,18),ink=(250,240,225),ol=(10,8,6)))
COLW=880 if VERT else 770
if VERT:
    for k,v in dict(cap=46,em=52,say=44,tape=44,tag=36).items(): STY[k]['s']=v

class Elem:
    def __init__(s,t,kind,text,sub=None,side='R'):
        s.t,s.kind,s.text,s.sub,s.side=t,kind,text,sub,side
        if kind=='card': s._card(); return
        st=STY[kind]; s.st=st; f=F(st['f'],st['s']); s.f=f
        pad=24 if kind!='tag' else 14
        s.lines=wrap(text,f,COLW-2*pad-(30 if kind=='say' and not VERT else 0))
        s.lh=int(st['s']*1.62)
        tw=max(f.getlength(l,direction='rtl',language='ar') for l in s.lines)
        s.w=int(min(COLW,tw+2*pad+(30 if kind=='say' and not VERT else 0))); s.h=s.lh*len(s.lines)+2*pad-int(st['s']*0.2)
        s.pad=pad; s.words=text.split(' '); s.nw=len(s.words); s.cache={}
    def _card(s):
        f1=F(RQ,72 if VERT else 64); f2=F(AM,36 if VERT else 32)
        tw=max(f1.getlength(s.text,direction='rtl',language='ar'),f2.getlength(s.sub,direction='rtl',language='ar'))
        s.w=int(min(COLW,tw+70)); s.h=160; s.nw=1; s.cache={}
        im=Image.new('RGBA',(s.w+12,s.h+12),(0,0,0,0)); d=ImageDraw.Draw(im)
        d.rectangle([10,10,s.w+10,s.h+10],fill=(0,0,0,150))
        d.rectangle([0,0,s.w,s.h],fill=(233,221,181),outline=(10,8,6),width=4)
        d.rectangle([4,4,s.w-4,100],fill=(122,18,16))
        d.text((s.w-30,52),s.text,font=f1,fill=(250,236,200),anchor='rm',direction='rtl',language='ar')
        d.text((s.w-30,130),s.sub,font=f2,fill=(30,20,14),anchor='rm',direction='rtl',language='ar')
        s.cache[1]=im
    def img(s,k):
        k=min(k,s.nw)
        if k in s.cache: return s.cache[k]
        st=s.st; tail=30 if s.kind=='say' else 0
        top=30 if s.side=='U' else 0
        im0=Image.new('RGBA',(s.w+12,s.h+12+top),(0,0,0,0)); d0=ImageDraw.Draw(im0)
        im=Image.new('RGBA',(s.w+12,s.h+12),(0,0,0,0)); d=ImageDraw.Draw(im)
        if s.side=='U': tail=0
        bx0=tail if s.side=='L' else 0; bx1=s.w if s.side=='L' else s.w-tail
        if s.kind=='say':
            d.rounded_rectangle([bx0+9,9,bx1+9,s.h+9],radius=30,fill=(0,0,0,140))
            d.rounded_rectangle([bx0,0,bx1,s.h],radius=30,fill=st['bg'],outline=st['ol'],width=4)
            cy=s.h*0.38
            if s.side=='U':
                pts=[(bx1-150,4),(bx1-120,-26),(bx1-100,4)]
            elif s.side=='R':  # panel is on the right -> tail points right
                pts=[(bx1-4,cy-22),(s.w,cy+6),(bx1-4,cy+20)]
            else:
                pts=[(bx0+4,cy-22),(0,cy+6),(bx0+4,cy+20)]
            d.polygon(pts,fill=st['bg']); d.line([pts[0],pts[1],pts[2]],fill=st['ol'],width=4)
        else:
            d.rectangle([bx0+9,9,bx1+9,s.h+9],fill=(0,0,0,140))
            d.rectangle([bx0,0,bx1,s.h],fill=st['bg'],outline=st['ol'],width=4 if s.kind!='tape' else 3)
            if s.kind=='tape':  # play triangle + reel dots
                d.polygon([(bx1-18,14),(bx1-18,34),(bx1-2-6,24)],fill=st['ink'])
        # words revealed
        shown=0; y=s.pad-int(st['s']*0.12)
        for l in s.lines:
            lw=l.split(' '); take=max(0,min(len(lw),k-shown)); shown+=len(lw)
            if take==0: break
            txt=' '.join(lw[:take])
            d.text((bx1-s.pad-(0 if s.kind!='tape' else 14),y),txt,font=s.f,fill=st['ink'],anchor='ra',direction='rtl',language='ar')
            y+=s.lh
        if s.side=='U' and s.kind=='say':
            im0.alpha_composite(im,(0,top)); d0=ImageDraw.Draw(im0)
            p=[(bx1-150,top+4),(bx1-120,2),(bx1-96,top+4)]
            d0.polygon(p,fill=st['bg']); d0.line(p,fill=st['ol'],width=4); im=im0
        s.cache[k]=im; return im

@lru_cache(None)
def sfx_img(text,size,color,rot):
    f=F(LZ,size)
    bb=f.getbbox(text,direction='rtl',language='ar',stroke_width=12)
    w,h=bb[2]-bb[0]+60,bb[3]-bb[1]+60
    im=Image.new('RGBA',(w,h),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.text((30-bb[0]+10,30-bb[1]+10),text,font=f,fill=(0,0,0,200),stroke_width=12,stroke_fill=(0,0,0,200),direction='rtl',language='ar')
    d.text((30-bb[0],30-bb[1]),text,font=f,fill=color,stroke_width=12,stroke_fill=(8,6,4),direction='rtl',language='ar')
    return im.rotate(rot,Image.BICUBIC,expand=True)

# ---------- title cards ----------
@lru_cache(None)
def title_img(kind,text):
    if kind=='big': f=F(RQ,150 if VERT else 190); fill=(214,172,82); sw=6
    elif kind=='red': f=F(LZ,170 if VERT else 200); fill=(205,35,28); sw=10
    elif kind=='mid': f=F(AM,54 if VERT else 64); fill=(236,226,200); sw=0
    else: f=F(AM,34 if VERT else 40); fill=(185,170,140); sw=0
    bb=f.getbbox(text,direction='rtl',language='ar',stroke_width=sw)
    w,h=bb[2]-bb[0]+40,bb[3]-bb[1]+40
    im=Image.new('RGBA',(w,h),(0,0,0,0)); d=ImageDraw.Draw(im)
    if sw: d.text((20-bb[0]+8,20-bb[1]+8),text,font=f,fill=(0,0,0,170),stroke_width=sw,stroke_fill=(0,0,0,170),direction='rtl',language='ar')
    d.text((20-bb[0],20-bb[1]),text,font=f,fill=fill,stroke_width=sw,stroke_fill=(20,12,6),direction='rtl',language='ar')
    return im

def ornament(d,y,a):
    c=(150,115,55,int(255*a))
    L=380 if VERT else 420
    d.line([(W/2-L,y),(W/2-40,y)],fill=c,width=3); d.line([(W/2+40,y),(W/2+L,y)],fill=c,width=3)
    d.polygon([(W/2,y-14),(W/2+14,y),(W/2,y+14),(W/2-14,y)],outline=c,width=3)

# ---------- shot renderer ----------
def render_shot(i):
    sh=SHOTS[i]; dur=sh['dur']; n=int(round(dur*FPS)); out=B+('comic/shots_v/' if VERT else 'comic/shots/')+f'{i:02d}_{sh["id"]}.mp4'
    rnd=random.Random(i)
    ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
                         '-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',out],stdin=subprocess.PIPE)
    istitle='title' in sh
    if not istitle:
        src=Image.open(B+'comic/panels/'+sh['panel']+'.png').convert('RGB')
        sw_,shh=src.size; side=sh['side']
        if VERT: side='U'; px,py=PX,PY
        else: px=W-M-P if side=='R' else M; py=M
        colx0=M if side=='R' else M+P+80; colx1=colx0+COLW
        els=[Elem(t,k,txt,*(rest),side=side) for (t,k,txt,*rest) in sh.get('els',[])]
        # stack positions
        if VERT:
            colx1=PX+P; colx0=colx1-COLW
            events=sorted(set(e.t for e in els)); layouts=[]
            for te in events:
                vis=[e for e in els if e.t<=te]; keep=[]; hsum=0
                for e in reversed(vis):
                    hh=e.h+(30 if (e.kind=='say') else 0)+24
                    if hsum+hh>TXT1-TXT0 and keep: break
                    keep.insert(0,e); hsum+=hh
                lay={}; y=TXT0
                for e in keep: lay[id(e)]=y; y+=e.h+(30 if e.kind=='say' else 0)+24
                layouts.append((te,lay))
        else:
            tot=sum(e.h+26 for e in els)-26
            y=max(M+10,int((H-tot)/2))
            for e in els: e.y=y; y+=e.h+26
            assert y<H-40, (sh['id'],y)
        drops=[(rnd.random()*P,rnd.random()*P,rnd.uniform(28,70),rnd.uniform(1400,2300),rnd.randint(55,120),rnd.choice((1,1,2))) for _ in range(int(240*sh.get('rain',0)))]
        shadow=Image.new('RGBA',(P+60,P+60),(0,0,0,0)); ImageDraw.Draw(shadow).rectangle([30,30,P+30,P+30],fill=(0,0,0,200))
        shadow=shadow.filter(ImageFilter.GaussianBlur(16))
    for fi in range(n):
        t=fi/FPS
        fade=min(ease(t/0.5),ease((dur-t)/0.45))
        frame=(BGH if (VERT and not istitle) else BG).copy()
        if istitle:
            layer=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(layer)
            for (t0,kind,text,yc) in sh['title']:
                yc=yc+TOFF
                a=ease((t-t0)/0.7)*fade
                if a<=0: continue
                im=title_img(kind,text); sc=1+0.04*(1-eout((t-t0)/1.2))
                if sc!=1: im=im.resize((int(im.width*sc),int(im.height*sc)),Image.BICUBIC)
                al=im.split()[3].point(lambda v,a=a:int(v*a)); im2=im.copy(); im2.putalpha(al)
                layer.alpha_composite(im2,(int(W/2-im2.width/2),int(yc-im2.height/2+12*(1-ease((t-t0)/0.7)))))
                if kind in('big','red'): ornament(d,yc+((100 if kind=='big' else 115) if VERT else (125 if kind=='big' else 135)),a)
            frame=Image.alpha_composite(frame.convert('RGBA'),layer).convert('RGB')
        else:
            # ken burns
            u=ease(t/dur); z=sh['z'][0]+(sh['z'][1]-sh['z'][0])*u
            (fx0,fy0),(fx1,fy1)=sh['f']; fx=fx0+(fx1-fx0)*u; fy=fy0+(fy1-fy0)*u
            side_len=min(sw_,shh)/z
            cx=min(max(fx*sw_,side_len/2),sw_-side_len/2); cy=min(max(fy*shh,side_len/2),shh-side_len/2)
            pan=src.transform((P,P),Image.EXTENT,(cx-side_len/2,cy-side_len/2,cx+side_len/2,cy+side_len/2),Image.BILINEAR)
            # rain
            if drops:
                rl=Image.new('RGBA',(P,P),(0,0,0,0)); d=ImageDraw.Draw(rl)
                for (x,y0,l,sp,a,wd) in drops:
                    yy=(y0+sp*t)%(P+80)-40; xx=(x-0.18*sp*t)%P
                    d.line([(xx,yy),(xx-0.18*l,yy+l)],fill=(220,225,235,a),width=wd)
                pan=Image.alpha_composite(pan.convert('RGBA'),rl).convert('RGB')
            # lightning flash
            fl=0
            for t0 in sh.get('flash',[]):
                for off,amp in ((0,.6),(0.18,.35)):
                    dt=t-t0-off
                    if 0<=dt<0.25: fl=max(fl,amp*(1-dt/0.25))
            if fl>0: pan=Image.blend(pan,Image.new('RGB',(P,P),(235,240,255)),fl)
            # shake
            ox=oy=0
            for t0 in sh.get('shake',[]):
                dt=t-t0
                if 0<=dt<0.35: k=(1-dt/0.35)*12; ox+=rnd.uniform(-k,k); oy+=rnd.uniform(-k,k)
            slide=(1-eout(t/0.6))*(60 if side=='R' else -60)
            if VERT: X=int(px+ox); Y=int(py-(1-eout(t/0.6))*50+oy)
            else: X=int(px+slide+ox); Y=int(py+oy)
            fr=frame.convert('RGBA')
            sa=shadow.copy(); sa.putalpha(sa.split()[3].point(lambda v:int(v*fade)))
            fr.alpha_composite(sa,(X-30+14,Y-30+18))
            box=Image.new('RGBA',(P+28,P+28),(232,220,190,255)); bd=ImageDraw.Draw(box)
            bd.rectangle([4,4,P+23,P+23],fill=(8,6,5,255)); box.paste(pan,(14,14))
            box.putalpha(int(255*fade))
            fr.alpha_composite(box,(X-14,Y-14))
            # sfx lettering
            for sf in sh.get('sfx',[]):
                (t0,txt,sx,sy,size,col,rot)=sf[:7]; life=sf[7] if len(sf)>7 else 2.2
                dt=t-t0
                if dt<0 or dt>life: continue
                im=sfx_img(txt,size,col,rot)
                sc=(0.5+0.75*eout(dt/0.12)) if dt<0.12 else (1.25-0.25*ease((dt-0.12)/0.12))
                a=min(1,1-ease((dt-(life-0.5))/0.5))*fade
                im2=im.resize((max(1,int(im.width*sc)),max(1,int(im.height*sc))),Image.BICUBIC)
                im2.putalpha(im2.split()[3].point(lambda v,a=a:int(v*a)))
                fr.alpha_composite(im2,(int(X+sx*P-im2.width/2),int(Y+sy*P-im2.height/2)))
            # text column
            if VERT:
                cur=[l for l in layouts if l[0]<=t]
                if cur:
                    ti=len(cur)-1; te,lay=cur[-1]; prev=layouts[ti-1][1] if ti>0 else {}
                    u2=eout((t-te)/0.4)
                    for e in els:
                        if e.t>t: continue
                        if id(e) in lay:
                            y1=lay[id(e)]; y0=prev.get(id(e),y1+14); e.y=y0+(y1-y0)*u2; e.alpha=1
                        elif id(e) in prev:
                            e.y=prev[id(e)]; e.alpha=1-u2
                        else: e.alpha=0
            for e in els:
                dt=t-e.t
                if dt<0: continue
                if VERT and getattr(e,'alpha',1)<=0.01: continue
                k=e.nw if e.kind=='card' else int(dt*9)+1
                im=e.img(k)
                a=ease(dt/0.35)*fade*(getattr(e,'alpha',1) if VERT else 1)
                im2=im.copy(); im2.putalpha(im2.split()[3].point(lambda v,a=a:int(v*a)))
                ex=colx1-e.w
                yoff=0 if VERT else 14*(1-eout(dt/0.35))
                fr.alpha_composite(im2,(int(ex),int(e.y+yoff)))
            frame=fr.convert('RGB')
        arr=np.asarray(frame).astype(np.int16)
        flick=1+0.012*math.sin(t*7.3+i)+0.006*math.sin(t*23.1)
        arr=np.clip(arr*flick+GRAIN[fi%6],0,255).astype(np.uint8)
        ff.stdin.write(arr.tobytes())
    ff.stdin.close(); ff.wait(); return out

if __name__=='__main__':
    import os
    from multiprocessing import Pool
    os.makedirs(B+'comic/shots',exist_ok=True); os.makedirs(B+'comic/shots_v',exist_ok=True)
    idx=[int(a) for a in sys.argv[1:]] or list(range(len(SHOTS)))
    with Pool(4) as p:
        for o in p.imap_unordered(render_shot,idx): print('done',o,flush=True)
