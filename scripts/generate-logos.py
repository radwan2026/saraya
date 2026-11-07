import numpy as np, colorsys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
SRC='public/logos/saraya-icon-original.png'
OUT='public/logos/'
src=Image.open(SRC).convert('RGBA'); a=np.asarray(src).astype(float)/255
rgb=a[...,:3]; alpha=a[...,3]
mx=rgb.max(-1); mn=rgb.min(-1); d=mx-mn+1e-9
r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
yellow=(h>30)&(h<80)
def H(c): return np.array([int(c[i:i+2],16) for i in (1,3,5)])/255
def recolor(c1,c2,acc,ref=0.62,lo=0.55):
    t=np.clip((335-np.where(h<200,h+360,h))/ (335-255),0,1)  # magenta->purple
    t=np.clip((np.where(h<200,h+360,h)-255)/(335-255),0,1); t=1-t
    base=H(c1)*(1-t[...,None])+H(c2)*t[...,None]
    shade=np.clip(mx/ref,lo,1.25)[...,None]
    body=np.clip(base*shade,0,1)
    accent=np.clip(H(acc)*np.clip(mx/0.85,0.7,1.1)[...,None],0,1)
    out=np.where(yellow[...,None],accent,body)
    return Image.fromarray((np.dstack([out,alpha])*255).astype(np.uint8))
FONT='/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
def grad(w,hh,c1,c2):
    x=np.linspace(0,1,w)[None,:]; y=np.linspace(0,1,hh)[:,None]
    t=np.clip((x+(1-y))/2,0,1)[...,None]
    g=H(c1)*(1-t)+H(c2)*t
    return Image.fromarray((g*255).astype(np.uint8)).convert('RGBA')
def badge(text,c1,c2,side,BW=270,BH=130):
    pad=40; W=BW+pad*2; Hh=BH+pad*2; img=Image.new('RGBA',(W,Hh),(0,0,0,0))
    R=int(BH*0.3); off=int(BH*0.09)
    # shadow
    sh=Image.new('RGBA',(W,Hh),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle([pad+off,pad+off*2,pad+BW+off,pad+BH+off*2],R,fill=(0,0,0,70))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
    # offset "side" layer (3D depth)
    ImageDraw.Draw(img).rounded_rectangle([pad+off,pad+off,pad+BW+off,pad+BH+off],R,fill=tuple(int(v*255) for v in H(side))+(255,))
    m=Image.new('L',(W,Hh),0); ImageDraw.Draw(m).rounded_rectangle([pad,pad,pad+BW,pad+BH],R,fill=255)
    gi=Image.new('RGBA',(W,Hh),(0,0,0,0)); gi.paste(grad(BW,BH,c1,c2),(pad,pad)); img.paste(gi,(0,0),m)
    # gloss
    gl=Image.new('RGBA',(W,Hh),(0,0,0,0)); ImageDraw.Draw(gl).rounded_rectangle([pad+8,pad+6,pad+BW-8,pad+BH*0.45],R-6,fill=(255,255,255,38)); img.alpha_composite(gl)
    dr=ImageDraw.Draw(img); fs=int(BH*0.62)
    f=ImageFont.truetype(FONT,fs)
    while dr.textlength(text,font=f)>BW*0.78: fs-=2; f=ImageFont.truetype(FONT,fs)
    dr.text((pad+BW/2+3,pad+BH/2+4),text,font=f,fill=(0,0,0,60),anchor='mm')
    dr.text((pad+BW/2,pad+BH/2),text,font=f,fill='white',anchor='mm')
    return img
def compose(logo,bdg,name):
    W,Hh=790,512; c=Image.new('RGBA',(W,Hh),(0,0,0,0)); c.alpha_composite(logo,(0,0))
    c.alpha_composite(bdg,(430, 455-bdg.height+30))
    c.save(OUT+name+'.png')
    bg=Image.new('RGBA',c.size,(255,255,255,255)); bg.alpha_composite(c); bg.convert('RGB').save(OUT+name+'-white-bg.jpg',quality=95)
orig=src
compose(recolor('#1E5BFF','#21D4FD','#7FE7FF'),badge('PRO','#1E5BFF','#21D4FD','#0B2E8A'),'saraya-pro')
compose(recolor('#FF7A00','#FFC300','#FF5500',ref=0.55,lo=0.88),badge('CLUB','#FF7A00','#FFC300','#C2410C'),'saraya-club')
compose(orig,badge('KIDS','#A8336E','#5B3A8E','#D8B500'),'saraya-kids')
