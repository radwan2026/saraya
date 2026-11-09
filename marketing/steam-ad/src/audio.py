import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
DUR = 45.0
N = int(SR * DUR)
rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)
bus = {k: np.zeros((2, N)) for k in ['drums', 'bass', 'pad', 'lead', 'fx', 'hits']}

def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def put(name, t, x, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= N: return
    x = x[:N - i] * gain
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[name][0, i:i + len(x)] += x * gl * 1.414
    bus[name][1, i:i + len(x)] += x * gr * 1.414
def env(n, a, d, s=0.0, r=0.0, sl=None):
    # simple ADSR: attack a sec, decay d sec to s, hold, release r at end
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    if r > 0:
        rn = int(r * SR); e[-rn:] *= np.linspace(1, 0, rn) if rn <= n else 1
    return e
def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2)); return signal.lfilter(b, a, x)
def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def bp(x, lo, hi):
    b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band'); return signal.lfilter(b, a, x)
def saw(f, n, detune=0.0, phase=None):
    t = np.arange(n) / SR
    ph = (f * (1 + detune) * t + (rng.random() if phase is None else phase)) % 1
    return 2 * ph - 1
def sweep_lp(x, f0, f1, steps=64):
    # time-varying lowpass via blockwise filtering with state
    out = np.zeros_like(x); n = len(x); blk = int(np.ceil(n / steps)); zi = None
    for k in range(steps):
        a0, a1 = k * blk, min(n, (k + 1) * blk)
        if a0 >= n: break
        fc = f0 * (f1 / f0) ** (k / (steps - 1))
        b, a = signal.butter(2, min(fc, SR / 2 - 200) / (SR / 2))
        if zi is None: zi = signal.lfilter_zi(b, a) * 0
        out[a0:a1], zi = signal.lfilter(b, a, x[a0:a1], zi=zi)
    return out

# ---------- instruments ----------
def kick(gain=1.0, big=False):
    n = int(SR * (0.7 if big else 0.42)); t = np.arange(n) / SR
    f = 45 + 140 * np.exp(-t * 28) + (60 * np.exp(-t * 90))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * (4 if big else 7.5))
    click = rng.standard_normal(n) * np.exp(-t * 400) * 0.25
    return np.tanh((x + hp(click, 2000)) * 1.6) * gain
def clap():
    n = int(SR * 0.35); t = np.arange(n) / SR; nz = rng.standard_normal(n)
    e = np.zeros(n)
    for d in [0, 0.011, 0.022]:
        i = int(d * SR); e[i:] += np.exp(-(t[:n - i]) * 60)
    e += np.exp(-t * 14) * 0.5
    return bp(nz, 900, 5000) * e * 0.8
def hat(open_=False):
    n = int(SR * (0.25 if open_ else 0.06)); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (12 if open_ else 70)) * 0.5
def snare():
    n = int(SR * 0.22); t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return (bp(rng.standard_normal(n), 1200, 8000) * np.exp(-t * 22) * 0.7 + tone * 0.4)
def pluck(m, dur=0.25, bright=4000, gain=0.3):
    n = int(SR * dur); f = mtof(m)
    x = saw(f, n, 0) * 0.6 + saw(f, n, 0.006) * 0.4
    x = lp(x, bright) * env(n, 0.003, 0.09, 0.0)
    return x * gain
def bell(m, dur=1.4, gain=0.25):
    n = int(SR * dur); t = np.arange(n) / SR; f = mtof(m)
    x = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 4)
         + 0.3 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 7) + 0.15 * np.sin(2 * np.pi * f * 4.2 * t) * np.exp(-t * 10))
    return x * np.exp(-t * 3.2) * np.minimum(1, t / 0.002) * gain
def pad_chord(notes, dur, cut0=900, cut1=2400, gain=0.08):
    n = int(SR * dur); x = np.zeros(n)
    for m in notes:
        f = mtof(m)
        for d in (-0.007, -0.0025, 0.0025, 0.007):
            x += saw(f, n, d)
    x = sweep_lp(x, cut0, cut1, 24)
    e = np.minimum(1, np.arange(n) / (0.25 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.15 * SR))
    return x * e * gain
def bass_note(m, dur, gain=0.35):
    n = int(SR * dur); f = mtof(m); t = np.arange(n) / SR
    x = saw(f, n, 0, 0) * 0.7 + np.sin(2 * np.pi * f / 2 * t) * 0.6
    x = sweep_lp(x, 2100, 700, 8)
    return np.tanh(x * 1.5) * env(n, 0.004, 0.18, 0.55, 0.03) * gain
def noise_riser(dur, f0=300, f1=9000, gain=0.25):
    n = int(SR * dur); x = rng.standard_normal(n)
    x = sweep_lp(hp(x, 200), f0, f1, 48)
    e = (np.arange(n) / n) ** 2.2
    return x * e * gain
def whoosh(dur=0.7, gain=0.4, rev=False):
    n = int(SR * dur); x = rng.standard_normal(n); t = np.arange(n) / n
    x = sweep_lp(x, 400, 7000, 32) if not rev else sweep_lp(x, 7000, 400, 32)
    e = np.sin(np.pi * t) ** 2 if not rev else np.sin(np.pi * t) ** 2
    pk = t ** 1.5 * np.exp(-((t - 0.65) ** 2) / 0.05)
    return x * (0.6 * e + pk) * gain
def impact(gain=1.0):
    n = int(SR * 2.5); t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * np.cumsum(35 + 60 * np.exp(-t * 8)) / SR) * np.exp(-t * 1.6)
    crash = hp(rng.standard_normal(n), 3000) * np.exp(-t * 2.2) * 0.35
    body = lp(rng.standard_normal(n), 900) * np.exp(-t * 6) * 0.8
    return np.tanh((sub * 1.2 + crash + body) * 1.3) * gain
def pop(m=84, gain=0.18):
    n = int(SR * 0.12); t = np.arange(n) / SR
    f = mtof(m) * (1 + 1.5 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35) * gain
def click(gain=0.15):
    n = int(SR * 0.03); t = np.arange(n) / SR
    return (hp(rng.standard_normal(n), 3000) * np.exp(-t * 300) + np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 200)) * gain
def blip(m, gain=0.15):
    n = int(SR * 0.09); t = np.arange(n) / SR
    return np.sign(np.sin(2 * np.pi * mtof(m) * t)) * np.exp(-t * 30) * gain * 0.5
def coin(gain=0.25):
    a = bell(88, 0.6, gain); b = bell(95, 0.9, gain); o = np.zeros(len(b) + 4000); o[:len(a)] += a; o[4000:] += b; return o
def shimmer(dur=2.0, gain=0.12):
    n = int(SR * dur); o = np.zeros(n + SR)
    notes = [81, 84, 88, 91, 93, 96, 100]
    for k in range(int(dur * 16)):
        x = bell(notes[rng.integers(len(notes))], 0.8, gain * (0.5 + rng.random() * 0.5))
        i = int(k * SR / 16); o[i:i + len(x)] += x[:len(o) - i]
    return o * np.concatenate([np.linspace(0, 1, n // 3), np.ones(n + SR - n // 3)])
def snare_roll(t0, t1, gain=0.35):
    t = t0; k = 0
    while t < t1:
        p = (t - t0) / (t1 - t0)
        put('drums', t, snare() * (0.25 + 0.75 * p), pan=0, gain=gain)
        step = 0.25 if p < 0.5 else 0.125 if p < 0.8 else 0.0625
        t += step

BEAT = 0.5
CH = [(45, [57, 60, 64, 69]), (41, [53, 57, 60, 65]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]
def chord_at(t): return CH[int(t // 2) % 4]

# ---------- arrangement ----------
# Pads all the way 0-36
for bar in range(18):
    t = bar * 2.0
    root, notes = chord_at(t)
    if t < 6: c0, c1, g = 400 + t * 120, 700 + t * 250, 0.06
    elif t < 34: c0, c1, g = 1400, 2600, 0.055
    else: c0, c1, g = 1000, 5000, 0.07
    put('pad', t, pad_chord(notes, 2.15, c0, c1, g), pan=0)
# Intro arp (0.5 - 6), brightening
for k in range(int(5.5 / 0.125)):
    t = 0.5 + k * 0.125
    root, notes = chord_at(t)
    m = notes[[0, 1, 2, 3, 2, 1][k % 6]] + 12
    put('lead', t, pluck(m, 0.22, 1200 + 5000 * (t / 6), 0.16 + 0.08 * (t / 6)), pan=0.35 if k % 2 else -0.35)
# Intro soft kicks + riser + roll
for t in np.arange(3.0, 5.0, 0.5): put('drums', t, kick(0.55))
put('fx', 3.6, noise_riser(2.4, 300, 12000, 0.22))
snare_roll(5.0, 5.98, 0.3)
# Main groove 6 - 34 (half-time break handled)
for b in range(int((34 - 6) / BEAT)):
    t = 6 + b * BEAT
    put('drums', t, kick(0.95))
    if b % 2 == 1: put('drums', t, clap(), gain=0.55)
    put('drums', t + 0.25, hat(), pan=0.25, gain=0.55)
    put('drums', t + 0.125, hat(), pan=-0.25, gain=0.2)
    put('drums', t + 0.375, hat(), pan=-0.25, gain=0.2)
    root, notes = chord_at(t)
    put('bass', t + 0.25, bass_note(root, 0.22, 0.38))
    put('bass', t, bass_note(root - 12, 0.12, 0.25))
# Lead arp in main (12-32)
pat = [0, 2, 1, 3, 2, 1, 3, 2]
for k in range(int((32 - 12) / 0.25)):
    t = 12 + k * 0.25
    root, notes = chord_at(t)
    m = notes[pat[k % 8]] + 12
    put('lead', t, pluck(m, 0.2, 3800, 0.13), pan=0.4 if k % 2 else -0.4)
# Bell melody over STEAM letters + section accents
for i, m in enumerate([81, 84, 86, 88, 91]):
    put('lead', 6.05 + i * 0.5, bell(m, 1.4, 0.2), pan=(i - 2) * 0.3)
    put('hits', 6.05 + i * 0.5, kick(0.35, True))
# hook melody in Stemo/games sections
mel = [(18, 76), (18.5, 79), (19, 81), (19.75, 79), (20, 84), (21, 81), (21.5, 79), (22, 76),
       (26, 76), (26.5, 79), (27, 81), (27.75, 84), (28, 86), (29, 84), (29.5, 81), (30, 79), (30.5, 81)]
for t, m in mel: put('lead', t, bell(m, 1.0, 0.11), pan=0.1)
# Break 34-36 riser + roll
put('fx', 33.9, noise_riser(2.1, 200, 14000, 0.3))
snare_roll(34.5, 35.95, 0.4)
for t in (34.0, 34.5, 35.0, 35.5): put('drums', t, kick(0.7))

# ---------- SFX ----------
put('hits', 6.0, impact(0.9))
put('fx', 5.85, whoosh(0.5, 0.35))
for b in (12, 18, 26, 32):
    put('fx', b - 0.45, whoosh(0.9, 0.5), pan=-0.2)
    put('hits', b, kick(0.6, True))
    put('fx', b + 0.05, shimmer(0.6, 0.06))
# text pops
for i in range(5): put('fx', 0.35 + i * 0.14, pop(79 + i * 2, 0.10), pan=0.3 - i * 0.15)
for i in range(3): put('fx', 3.0 + i * 0.13, pop(84 + i * 3, 0.12))
for i in range(3): put('fx', 3.5 + i * 0.13, pop(88 + i * 3, 0.12))
put('fx', 4.2, whoosh(0.7, 0.18))
for i in range(6): put('fx', 9.2 + i * 0.08, pop(86 + i, 0.07))
# S3
put('fx', 12.15, whoosh(0.8, 0.3), pan=-0.6)
put('fx', 13.0, shimmer(0.8, 0.06), pan=-0.4)
for t in (13.1, 13.4): put('fx', t, pop(90, 0.14))
for i in range(3): put('fx', 13.6 + i * 0.3, pop(86 + i * 2, 0.12), pan=0.5)
for i in range(3):
    t0 = 14.7 + i * 0.25
    for k in range(10): put('fx', t0 + k * 0.12, click(0.06), pan=0.4 - i * 0.4)
    put('fx', t0 + 1.25, bell(93 + i * 2, 0.6, 0.08))
# S4 blocks snapping, robot steps, coin, stat cards
for i in range(5): put('fx', 18.8 + i * 0.28 + 0.25, click(0.22), pan=0.5); put('fx', 18.8 + i * 0.28 + 0.25, pop(70 + i * 2, 0.12), pan=0.5)
for k in range(5): put('fx', 20.3 + k * 0.34, blip(72 + k * 2, 0.15), pan=-0.5)
put('fx', 22.0, coin(0.22), pan=-0.4)
for i in range(4):
    put('fx', 22.55 + i * 0.18, pop(84 + i * 3, 0.15), pan=0.5 - i * 0.33)
    for k in range(8): put('fx', 22.6 + i * 0.18 + k * 0.13, click(0.04))
for i in range(4): put('fx', 23.6 + i * 0.07 * 2, pop(91 + i, 0.08))
# S5 cards
for i in range(3): put('fx', 26.5 + i * 0.22, whoosh(0.5, 0.18), pan=0.6 - i * 0.6)
for i in range(3): put('fx', 28.0 + i * 1.15, bell(88 + [0, 3, 7][i], 1.0, 0.12), pan=0.6 - i * 0.6); put('fx', 28.0 + i * 1.15, shimmer(0.5, 0.05))
# S6 word hits
for i in range(4):
    put('hits', 32 + i * 0.5, impact(0.45))
    put('fx', 32 + i * 0.5, bell(81 + [0, 3, 7, 12][i], 0.5, 0.15))
for i in range(5): put('fx', 34.05 + i * 0.12, pop(84 + i * 2, 0.10))
# ---------- Logo (36-45) ----------
put('hits', 36.0, impact(1.0))
put('fx', 36.0, whoosh(1.4, 0.55), pan=0.3)
put('fx', 37.0, whoosh(1.2, 0.35, rev=True), pan=-0.3)
put('fx', 38.4, shimmer(1.6, 0.09))
put('hits', 39.35, kick(0.6, True))
put('lead', 39.35, bell(81, 2.5, 0.16)); put('lead', 39.35, bell(88, 2.5, 0.1))
put('fx', 40.4, shimmer(1.2, 0.07))
put('lead', 40.5, bell(93, 2.0, 0.1))
put('pad', 36.0, pad_chord([45, 57, 64, 69, 71, 76], 9.0, 600, 3500, 0.06))
put('bass', 36.0, lp(saw(55, int(SR * 8.5), 0, 0), 200) * np.exp(-np.arange(int(SR * 8.5)) / SR * 0.5) * 0.25)
# end card groove 42-45
put('fx', 42.2, whoosh(0.7, 0.3))
for b in range(6):
    t = 42.0 + b * BEAT
    put('drums', t, kick(0.6)); put('drums', t + 0.25, hat(), gain=0.35)
put('hits', 42.8, kick(0.5, True)); put('fx', 42.8, coin(0.2))
for i in range(3): put('fx', 43.1 + i * 0.2, pop(88 + i * 4, 0.1))
put('lead', 44.0, bell(93, 1.2, 0.12)); put('lead', 44.0, bell(88, 1.2, 0.1))

# ---------- mix ----------
# sidechain envelope from kicks (main groove)
sc = np.ones(N)
for b in range(int((34 - 6) / BEAT)):
    i = int((6 + b * BEAT) * SR); n = int(0.3 * SR); t = np.arange(n) / n
    sc[i:i + n] = np.minimum(sc[i:i + n], 0.35 + 0.65 * t ** 0.7)
def reverb(x, secs=2.2, wet=0.25, seed=1):
    r = np.random.default_rng(seed); n = int(secs * SR); t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t * 3.0 / secs * 2.3)
    ir = lp(ir, 6000); ir /= np.sqrt((ir ** 2).sum())
    return x + signal.fftconvolve(x, ir)[:len(x)] * wet * 4
mix = np.zeros((2, N))
gains = {'drums': 0.9, 'bass': 0.8, 'pad': 0.9, 'lead': 0.8, 'fx': 0.9, 'hits': 0.85}
for k, v in bus.items():
    x = v.copy()
    if k in ('pad', 'bass', 'lead'): x *= sc
    if k in ('pad', 'lead', 'fx'):
        x[0] = reverb(x[0], 2.4, 0.3 if k != 'pad' else 0.2, 1); x[1] = reverb(x[1], 2.4, 0.3 if k != 'pad' else 0.2, 2)
    mix += x * gains[k]
mix[:, :] = hp(mix, 25)
# master: fade out, soft limit, normalize
fo = int(0.5 * SR); mix[:, -fo:] *= np.linspace(1, 0, fo) ** 1.5
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.8) / np.tanh(1.8)
mix *= 0.93 / np.max(np.abs(mix))
wavfile.write('soundtrack.wav', SR, (mix.T * 32767).astype(np.int16))
print('ok', mix.shape)
