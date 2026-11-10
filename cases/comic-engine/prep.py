# Builds square 1400px panel sources for the comic video.
import numpy as np, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps
S='/tmp/claude-0/-home-user-saraya/5ff36b23-2257-528a-8aa2-85aceb2b057c'
IMG=S+'/images/'; OUT=S+'/scratchpad/comic/panels/'
F=S+'/scratchpad/fonts/'
AMIRI=F+'full/package/700Bold/Amiri_700Bold.ttf'
AMIRI_R=F+'full/package/400Regular/Amiri_400Regular.ttf'
LALEZAR=F+'full/package/400Regular/Lalezar_400Regular.ttf'
N=1400
def font(p,s): return ImageFont.truetype(p,s,layout_engine=ImageFont.Layout.RAQM)
def load(n): return Image.open(IMG+f'{n}.webp').convert('RGB')
def save(im,name): im.resize((N,N),Image.LANCZOS).save(OUT+name+'.png')

def patch_dark(im, box, blur=3):
    a=np.asarray(im).astype(float); x0,y0,x1,y1=box
    ring=np.concatenate([a[y0-6:y0,x0:x1].reshape(-1,3),a[y1:y1+6,x0:x1].reshape(-1,3)])
    c=np.median(ring,0); w,h=x1-x0,y1-y0
    rng=np.random.default_rng(3)
    t=np.clip(np.ones((h,w,3))*c+rng.normal(0,5,(h,w,1)),0,255).astype('uint8')
    m=Image.new('L',(w,h),0); ImageDraw.Draw(m).rectangle([blur,blur,w-blur,h-blur],fill=255)
    im.paste(Image.fromarray(t),(x0,y0),m.filter(ImageFilter.GaussianBlur(blur)))

def blur_region(im, box, r=6):
    reg=im.crop(box).filter(ImageFilter.GaussianBlur(r)); im.paste(reg,box[:2])

# straightforward images
for n,name in [(7,'souq'),(6,'shoes'),(12,'knock'),(13,'tape'),(3,'watch_open'),(1,'office_ref'),
               (11,'khalil_door'),(15,'casefile'),(19,'redledger'),(18,'bag'),(17,'farag'),
               (9,'khalil_int'),(21,'zainab'),(8,'mustafa'),(23,'eyes')]:
    im=load(n)
    if name=='souq': patch_dark(im,(55,280,115,302))          # remove "1956" on sign
    save(im,name)

# office with clock tower: soften English newspaper clipping
im=load(5); blur_region(im,(470,280,570,345),5); save(im,'office')

# evidence watch: remove brand name
im=load(14); patch_dark(im,(483,328,553,352),2); save(im,'watch')

# ashtray: fix pack maker, case card and evidence number
im=load(20)
box=(770,598,948,668)
a=np.asarray(im); reg=a[box[1]:box[3],box[0]:box[2]].reshape(-1,3); lum=reg.mean(1)
paper=reg[lum>np.percentile(lum,55)].mean(0); w,h=box[2]-box[0],box[3]-box[1]
t=Image.new('RGB',(w,h),tuple(int(v) for v in paper)); m=Image.new('L',(w,h),0)
ImageDraw.Draw(m).rectangle([4,4,w-4,h-4],fill=255); im.paste(t,box[:2],m.filter(ImageFilter.GaussianBlur(3)))
d=ImageDraw.Draw(im)
d.text((box[0]+w/2,box[1]+h/2),'مصنع دخان طرابلس',font=font(AMIRI,22),fill=(45,45,45),anchor='mm',direction='rtl',language='ar')
im=im.crop((30,40,1010,700)); im.resize((int(980*1.43),int(660*1.43)),Image.LANCZOS).save(OUT+'ashtray.png'); im=None
pass

# board (corrected)
board=Image.open(S+'/scratchpad/board_fixed.png').convert('RGB'); save(board,'board')

# polaroid composites from the board
def polaroid(box, name, rot, scale_h=980, tint=None):
    card=board.crop(box)
    w,h=card.size; k=scale_h/h
    card=card.resize((int(w*k),int(h*k)),Image.LANCZOS).filter(ImageFilter.UnsharpMask(3,120,2))
    bg=board.crop((max(0,box[0]-160),max(0,box[1]-160),min(1024,box[2]+160),min(1024,box[3]+160)))
    bg=bg.resize((N,N),Image.LANCZOS).filter(ImageFilter.GaussianBlur(14))
    bg=ImageEnhance.Brightness(bg).enhance(0.55)
    cr=card.convert('RGBA').rotate(rot,Image.BICUBIC,expand=True)
    sh=Image.new('RGBA',cr.size,(0,0,0,0)); sh.paste((0,0,0,170),(0,0),cr.split()[3])
    sh=sh.filter(ImageFilter.GaussianBlur(18))
    x=(N-cr.width)//2; y=(N-cr.height)//2+20
    bg.paste(sh,(x+18,y+26),sh); bg.paste(cr,(x,y),cr)
    d=ImageDraw.Draw(bg)  # brass pin
    px,py=N//2+int(rot*-4),y+18
    d.ellipse([px-16,py-16,px+16,py+16],fill=(150,110,40),outline=(60,40,10),width=3)
    d.ellipse([px-7,py-9,px+3,py-1],fill=(230,200,120))
    bg.save(OUT+name+'.png')
polaroid((777,87,907,280),'suleiman',-2.5)
polaroid((495,317,632,486),'safe',2)
polaroid((655,317,775,492),'tea',-2)
polaroid((800,307,927,507),'stairs',1.5)

# ledger page (debt entry), drawn
rng=random.Random(5)
pg=np.ones((N,N,3))*np.array([214,196,152])
yy,xx=np.mgrid[0:N,0:N]
pg*= (1-0.25*(((xx-N/2)/N)**2+((yy-N/2)/N)**2))[...,None]
pg+=np.random.default_rng(2).normal(0,7,(N,N,1))
for _ in range(9):
    cx,cy,r=rng.randint(0,N),rng.randint(0,N),rng.randint(60,220)
    pg[((xx-cx)**2+(yy-cy)**2)<r*r]*=0.97
pg=Image.fromarray(np.clip(pg,0,255).astype('uint8')).filter(ImageFilter.GaussianBlur(1))
d=ImageDraw.Draw(pg)
ink=(28,34,70)
for y in range(230,N-60,92): d.line([(70,y),(N-70,y)],fill=(120,140,170),width=2)
for x in (1140,420): d.line([(x,140),(x,N-60)],fill=(170,80,70),width=3)
fh=font(AMIRI,52); fr=font(AMIRI_R,50)
d.text((1250,180),'التاريخ',font=fh,fill=ink,anchor='mm',direction='rtl')
d.text((780,180),'البيان',font=fh,fill=ink,anchor='mm',direction='rtl')
d.text((250,180),'مدين',font=fh,fill=ink,anchor='mm',direction='rtl')
rows=[('٢/١','بضاعة من الصائغ عمر','١٢٠٠'),('٣/١','أجرة الدكان','٣٥٠'),('٥/١','ثمن أساور عيار ٢١','٨٠٠'),
      ('٧/١','مصاريف نقل','١٤٥'),('٩/١','خ — ٣٠٠ جنيه — آخر مرة','٣٠٠'),('١١/١','سداد جزء من القرض','١٠٠٠'),
      ('١٢/١','مصاريف متنوعة','٢٧٥'),('١٣/١','إيرادات اليوم','٤٥٠')]
y=280
for dt,desc,amt in rows:
    d.text((1250,y),dt,font=fr,fill=ink,anchor='mm',direction='rtl')
    d.text((780,y),desc,font=fr,fill=ink,anchor='mm',direction='rtl')
    d.text((250,y),amt,font=fr,fill=ink,anchor='mm',direction='rtl')
    if desc.startswith('خ'): target=y
    y+=135
for i in range(3):
    d.ellipse([440-i*3,target-58+i*2,1130+i*4,target+58-i*2],outline=(185,30,30),width=6)
pg=pg.rotate(-3,Image.BICUBIC,fillcolor=(30,22,14)); pg.save(OUT+'ledger.png')

# discovery panel: black with speed lines
dp=Image.new('RGB',(N,N),(8,6,6)); d=ImageDraw.Draw(dp)
import math
for i in range(140):
    a=rng.random()*2*math.pi; r0=rng.randint(300,420)
    d.line([(N/2+r0*math.cos(a),N/2+r0*math.sin(a)),(N/2+1100*math.cos(a),N/2+1100*math.sin(a))],
           fill=(rng.randint(60,120),)*3,width=rng.randint(2,7))
dp.save(OUT+'discovery.png')
print('panels ready')
