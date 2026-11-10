import numpy as np, wave
from shots import SHOTS
SR=44100; rng=np.random.default_rng(11)
starts=np.cumsum([0]+[s['dur'] for s in SHOTS]); TOT=starts[-1]; N=int(TOT*SR)+SR
def T(n): return np.arange(n)/SR
def smooth(g,w):
    c=np.cumsum(np.concatenate([[0],g])); h=w//2
    i0=np.clip(np.arange(len(g))-h,0,len(g)); i1=np.clip(np.arange(len(g))+h,0,len(g))
    return (c[i1]-c[i0])/np.maximum(i1-i0,1)
def band(x,lo,hi,soft=True):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); m=np.ones_like(f)
    if lo: m*=1/(1+(lo/np.maximum(f,1))**4)
    if hi: m*=1/(1+(f/hi)**4)
    return np.fft.irfft(X*m,len(x))
def norm(x): return x/(np.abs(x).max()+1e-9)
def env(n,a,dec): t=T(n); return np.minimum(t/max(a,1e-4),1)*np.exp(-np.maximum(t-a,0)/dec)
def reverb(x,sec=1.2,mix=.3):
    n=int(sec*SR); ir=rng.normal(0,1,n)*np.exp(-T(n)/(sec/5)); ir=band(ir,200,6000); ir/=np.abs(ir).sum()**.5*8
    L=len(x)+n; y=np.fft.irfft(np.fft.rfft(x,L)*np.fft.rfft(ir,L),L)[:len(x)+n]
    out=np.zeros(L); out[:len(x)]+=x*(1-mix); out+=y*mix*6; return out
# ---------------- one-shot events ----------------
def ev(name):
    if name=='thunder':
        n=int(5*SR); b=np.cumsum(rng.normal(0,1,n)); b-=smooth(b,2000)
        x=band(b,20,300)*env(n,0.15,1.4); c=band(rng.normal(0,1,int(.6*SR)),900,7000)*env(int(.6*SR),.005,.12)
        x=norm(x); x[:len(c)]+=0.5*norm(c); return reverb(x,2,.35)*.9
    if name=='knock' or name=='knock_rec':
        n=int(.35*SR); t=T(n); x=(np.sin(2*np.pi*95*t)+.6*np.sin(2*np.pi*170*t)+.3*np.sin(2*np.pi*420*t))*np.exp(-t/.06)
        x+=band(rng.normal(0,1,n),300,3000)*np.exp(-t/.012)*.8; x=norm(x)
        if name=='knock_rec': x=band(x,250,3500); return reverb(x,.4,.2)*.6
        return reverb(x,.9,.35)
    if name=='splash':
        n=int(.5*SR); return norm(band(rng.normal(0,1,n),500,6000)*env(n,.01,.12))*.8
    if name=='step':
        n=int(.25*SR); t=T(n); x=np.sin(2*np.pi*70*t)*np.exp(-t/.04)+band(rng.normal(0,1,n),800,5000)*np.exp(-t/.05)*.5
        return norm(x)*.6
    if name=='click':
        n=int(.12*SR); t=T(n); x=band(rng.normal(0,1,n),1500,9000)*np.exp(-t/.004)+.4*np.sin(2*np.pi*2300*t)*np.exp(-t/.01)
        x[int(.045*SR):]+=band(rng.normal(0,1,n-int(.045*SR)),1500,9000)*np.exp(-T(n-int(.045*SR))/.003)*.6
        return norm(x)*.8
    if name=='lock':
        a=ev('click'); n=int(.6*SR); t=T(n); r=np.sin(2*np.pi*3100*t)*np.exp(-t/.08)*.25
        out=np.zeros(n); out[:len(a)]+=a; out[int(.12*SR):int(.12*SR)+len(a)]+=a*.9; return out+r
    if name=='thud':
        n=int(1.2*SR); t=T(n); x=np.sin(2*np.pi*55*t*(1-0.3*t))*np.exp(-t/.25)+band(rng.normal(0,1,n),60,900)*np.exp(-t/.05)*.6
        return reverb(norm(x),1,.25)
    if name=='hit':
        n=int(3*SR); t=T(n); x=np.sin(2*np.pi*42*t)*np.exp(-t/.9)+.5*np.sin(2*np.pi*84*t)*np.exp(-t/.5)
        x+=band(rng.normal(0,1,n),40,2500)*np.exp(-t/.18)*.7; return reverb(norm(x),2.5,.4)
    if name=='sting':
        n=int(4*SR); t=T(n); fr=[146.8,155.6,220,233.1]
        x=sum(np.sin(2*np.pi*f*t+np.sin(2*np.pi*5*t)*.3) for f in fr)*np.minimum(t/.05,1)*np.exp(-t/1.3)
        x+=ev('hit')[:n]*.8; return reverb(norm(x),2.5,.45)
    if name=='swell':
        n=int(2.2*SR); t=T(n); x=band(rng.normal(0,1,n),200,4000)*(t/t[-1])**3
        x+=np.sin(2*np.pi*73.4*t)*(t/t[-1])**2; x=norm(x); x[-int(.03*SR):]*=np.linspace(1,0,int(.03*SR)); return x*.7
    if name=='whoosh':
        n=int(.6*SR); t=T(n); x=band(rng.normal(0,1,n),400,5000)*np.sin(np.pi*t/t[-1])**2; return norm(x)*.35
    if name=='drip':
        n=int(.6*SR); t=T(n); f=1100+1600*t/.04; x=np.sin(2*np.pi*np.cumsum(np.minimum(f,2700))/SR)*np.exp(-t/.035)
        return reverb(norm(x),1.2,.45)*.5
    if name=='creak':
        n=int(.7*SR); t=T(n); f0=180+60*np.sin(2*np.pi*1.3*t)
        saw=((np.cumsum(f0)/SR)%1)*2-1; x=band(saw*(1+.5*rng.normal(0,1,n)),300,2500)*np.sin(np.pi*t/t[-1])
        return norm(x)*.45
    if name=='door':
        return ev('creak')*1.2
    if name=='paper':
        n=int(.9*SR); x=band(rng.normal(0,1,n),1500,9000)*np.abs(band(rng.normal(0,1,n),0,18))
        return norm(x)*.35*np.sin(np.pi*T(n)/T(n)[-1])
    if name=='scratch':
        n=int(1.25*SR); x=band(rng.normal(0,1,n),2500,9000)*(np.abs(band(rng.normal(0,1,n),0,12))>.3*np.abs(band(rng.normal(0,1,n),0,12)).max())
        x[-int(.02*SR):]*=np.linspace(1,0,int(.02*SR)); return norm(x)*.25
    if name=='clink':
        n=int(1.2*SR); t=T(n); x=sum(np.sin(2*np.pi*f*t)*np.exp(-t/d) for f,d in((2650,.4),(4120,.25),(5900,.15)))
        return norm(x)*.35
    if name=='metal':
        n=int(1.5*SR); t=T(n); x=sum(np.sin(2*np.pi*f*t)*np.exp(-t/d) for f,d in((310,.6),(742,.35),(1290,.2)))
        x+=band(rng.normal(0,1,n),200,3000)*np.exp(-t/.03); return reverb(norm(x),1,.3)*.5
    if name in('bell','bell2'):
        def strike(base):
            n=int(6*SR); t=T(n); parts=[(.5,1,3.5),(1,.8,2.6),(1.19,.5,2.0),(1.5,.35,1.6),(2,.4,1.2),(2.74,.2,.8),(3.0,.15,.6)]
            return sum(a*np.sin(2*np.pi*base*r*t)*np.exp(-t/d) for r,a,d in parts)*np.minimum(t/.003,1)
        if name=='bell': x=strike(392)
        else:
            x=np.zeros(int(7.2*SR)); a=strike(392); b=strike(330); x[:len(a)]+=a; x[int(1.1*SR):int(1.1*SR)+len(b)]+=b
        return reverb(norm(x),3,.45)*.6
    if name in('oud_title','oud_end'):
        # Hijaz on D: D Eb F# G A Bb C D
        sc={'D':146.83,'Eb':155.56,'F#':185.0,'G':196.0,'A':220.0,'Bb':233.08,'C':261.63,'D5':293.66,'d':73.42}
        mel=[('A',.35),('Bb',.35),('A',.35),('G',.35),('F#',.5),('G',.35),('F#',.35),('Eb',.35),('D',1.6)] if name=='oud_title' else \
            [('D',.4),('Eb',.4),('F#',.4),('G',.6),('A',.4),('Bb',.4),('A',.4),('G',.4),('F#',.4),('Eb',.4),('D',2.0)]
        out=np.zeros(int(sum(d for _,d in mel)*SR+3*SR)); pos=0
        for note,d in mel:
            f=sc[note]; per=int(SR/f); n=int((d+1.5)*SR)
            buf=rng.uniform(-1,1,per); y=np.zeros(n)
            for k in range(0,n,per):
                seg=min(per,n-k); y[k:k+seg]=buf[:seg]; buf=0.5*(buf+np.roll(buf,-1))*0.994
            y=band(y,80,3500)*np.exp(-T(n)/0.9)
            out[pos:pos+n]+=y; pos+=int(d*SR)
        return reverb(norm(out),2.2,.35)*.55
    raise KeyError(name)
mix=np.zeros(N)
def put(x,t,g):
    i=int(t*SR); x=x[:N-i]; mix[i:i+len(x)]+=x*g
for k,s in enumerate(SHOTS):
    for (t,name,g) in s.get('aud',[]): put(ev(name),starts[k]+t,g)
# ---------------- ambience beds ----------------
def level(key,fade=.6):
    g=np.zeros(N)
    for k,s in enumerate(SHOTS):
        v=s.get('amb',{}).get(key)
        if v is None: continue
        a,b=starts[k],starts[k+1]
        if isinstance(v,tuple): a,b=starts[k]+v[0],starts[k]+v[1]; v=1.0
        g[int(a*SR):int(b*SR)]=np.maximum(g[int(a*SR):int(b*SR)],v)
    return smooth(g,int(fade*SR))
def chunked(fn):
    out=np.zeros(N); L=SR*20
    for i in range(0,N,L): seg=fn(min(L+SR,N-i)); m=min(L,N-i); out[i:i+m]=seg[:m]
    return out
rain=chunked(lambda n: band(rng.normal(0,1,n),400,7000)*.5+band(rng.normal(0,1,n),80,600)*.6)
drops=np.zeros(N); idx=rng.integers(0,N-2000,int(TOT*25))
for i in idx: drops[i:i+400]+=rng.uniform(.2,1)*np.exp(-T(400)/.002)*np.sin(2*np.pi*rng.uniform(1500,4000)*T(400))
rain=norm(rain)*.6+drops*.12
rain_in=band(rain,0,900)*1.4
tick=np.zeros(N); 
for t0 in np.arange(0,TOT,1.0):
    i=int(t0*SR); n=int(.03*SR); tick[i:i+n]+=np.sin(2*np.pi*3200*T(n))*np.exp(-T(n)/.004)
ticks=np.zeros(N)
for ph,per,f in ((0,1.0,3000),(.31,.5,4200),(.17,.75,2500),(.53,.66,3600),(.81,.4,5100)):
    for t0 in np.arange(ph,TOT,per):
        i=int(t0*SR); n=int(.025*SR); ticks[i:i+n]+=np.sin(2*np.pi*f*T(n))*np.exp(-T(n)/.003)*.6
buzz=sum(np.sin(2*np.pi*100*h*T(N))/h for h in range(1,7))*(1+.2*np.sin(2*np.pi*.3*T(N)))
whir=chunked(lambda n: band(rng.normal(0,1,n),300,2500))*.4+np.sin(2*np.pi*50*T(N))*.15
heart=np.zeros(N)
for t0 in np.arange(0,TOT,.85):
    for off,a in((0,1),(.22,.7)):
        i=int((t0+off)*SR); n=int(.18*SR)
        if i+n<N: heart[i:i+n]+=a*np.sin(2*np.pi*48*T(n))*np.exp(-T(n)/.05)
drips=np.zeros(N)
for t0 in rng.uniform(0,TOT,int(TOT*1.3)):
    d=ev('drip')*.25; i=int(t0*SR); drips[i:i+len(d)][:max(0,N-i)]+=d[:max(0,N-i)]
rain_rec=band(rain,300,3000)*.5+rng.normal(0,1,N)*.02  # muffled rain heard on the tape + hiss
beds=dict(rain=(rain,.55),rain_in=(rain_in,.35),tick=(tick,.18),ticks=(ticks,.22),buzz=(buzz,.05),
          whir=(whir,.12),heart=(heart,.5),drips=(drips,.6),rain_rec=(rain_rec,.35))
for k,(x,g) in beds.items(): mix+=x[:N]*level(k)*g
# ---------------- music drone (Hijaz D) ----------------
t=T(N); lv=np.zeros(N)
for k,s in enumerate(SHOTS): lv[int(starts[k]*SR):int(starts[k+1]*SR)]=s.get('mus',.4)
lv=smooth(lv,int(1.5*SR))
dr=np.zeros(N)
for f,a in((73.42,1),(110,.55),(146.83,.35),(155.56,.12)):
    ph=2*np.pi*f*t+0.4*np.sin(2*np.pi*.11*t)
    dr+=a*(np.sin(ph)+.3*np.sin(2*ph)+.15*np.sin(3*ph))
dr*=(0.75+0.25*np.sin(2*np.pi*.07*t))
dr=chunked(lambda n: np.zeros(n))+dr
mix+=norm(dr)*.10*lv
# master
fade=np.ones(N); fade[:int(.5*SR)]=np.linspace(0,1,int(.5*SR)); fade[-int(2*SR):]=np.linspace(1,0,int(2*SR))
mix*=fade; mix=np.tanh(mix/ (np.percentile(np.abs(mix),99.9)+1e-9)*0.8)*0.92
st=np.stack([mix,np.roll(mix,int(.0007*SR))*.97],1)  # slight width
st=(st[:int(TOT*SR)]*32767).astype(np.int16)
with wave.open('audio.wav','wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
print('audio',TOT,'s')
