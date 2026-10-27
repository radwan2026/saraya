"""Build Sadad Libya logo assets from the approved reference PNGs.

Run:  python3 -I brand/scripts/build_assets.py   (from the repo root)

Inputs  : brand/assets/reference/sadad-logo-source-{gold,white}.png (1920x1080, transparent)
Outputs : brand/assets/logo/*.png  (raster crops + colour variants)
          brand/assets/logo/*.svg  (auto-traced flat vectors — provisional, see README)
"""
import os
import numpy as np
from PIL import Image
import potrace

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
REF = os.path.join(ROOT, "assets", "reference")
OUT = os.path.join(ROOT, "assets", "logo")
os.makedirs(OUT, exist_ok=True)

GOLD = (217, 159, 65)      # Sadad Gold  #D99F41
CHARCOAL = (28, 28, 30)    # Charcoal    #1C1C1E
GRAPHITE = (59, 59, 59)    # Graphite    #3B3B3B (descriptor colour in the source)
WHITE = (255, 255, 255)

# Regions measured on the 1920x1080 source (x0, y0, x1, y1)
FULL = (619, 225, 1302, 822)
NAME_LOCKUP = (619, 225, 1302, 760)   # symbol + name, no descriptor
SYMBOL = (791, 225, 1156, 600)
WORDMARK = (619, 633, 1302, 760)
DESCRIPTOR_Y = 780

gold_src = np.array(Image.open(os.path.join(REF, "sadad-logo-source-gold.png")).convert("RGBA"))
white_src = np.array(Image.open(os.path.join(REF, "sadad-logo-source-white.png")).convert("RGBA"))
alpha = gold_src[..., 3]


def crop(arr, box, pad=0):
    x0, y0, x1, y1 = box
    return arr[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad]


def mono(box, rgb, pad=0):
    a = crop(alpha, box, pad)
    out = np.zeros(a.shape + (4,), np.uint8)
    out[..., :3] = rgb
    out[..., 3] = a
    return out


def save(arr, name, scale=1):
    im = Image.fromarray(arr, "RGBA")
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.LANCZOS)
    im.save(os.path.join(OUT, name), optimize=True)


PAD = 24

# 1) Primary full logo — gradient gold + graphite descriptor (light backgrounds)
save(crop(gold_src, FULL, PAD), "sadad-logo-full-primary.png")

# 2) Reverse full logo — gradient gold mark + white descriptor (dark backgrounds)
rev = gold_src.copy()
rev[DESCRIPTOR_Y:] = white_src[DESCRIPTOR_Y:]
save(crop(rev, FULL, PAD), "sadad-logo-full-reverse.png")

# 3) Flat single-colour versions (official everyday reference)
for label, rgb in (("gold", GOLD), ("white", WHITE), ("charcoal", CHARCOAL)):
    save(mono(FULL, rgb, PAD), f"sadad-logo-full-{label}.png")
    save(mono(NAME_LOCKUP, rgb, PAD), f"sadad-logo-name-{label}.png")
    save(mono(SYMBOL, rgb, PAD), f"sadad-symbol-{label}.png")
    save(mono(WORDMARK, rgb, PAD), f"sadad-wordmark-{label}.png")

# Flat gold full logo but with graphite / white descriptor
flat = mono(FULL, GOLD, PAD)
ys = DESCRIPTOR_Y - (FULL[1] - PAD)
flat_light = flat.copy(); flat_light[ys:, :, :3] = GRAPHITE
flat_dark = flat.copy(); flat_dark[ys:, :, :3] = WHITE
save(flat_light, "sadad-logo-full-flat-light.png")
save(flat_dark, "sadad-logo-full-flat-dark.png")

# 4) Gradient symbol / name lockup (special use)
save(crop(gold_src, SYMBOL, PAD), "sadad-symbol-metallic.png")
save(crop(gold_src, NAME_LOCKUP, PAD), "sadad-logo-name-metallic.png")

# 5) Horizontal lockup (proposed): symbol on the right (RTL reading start), wordmark left
sym = crop(alpha, SYMBOL)
wm = crop(alpha, WORDMARK)
h_sym = sym.shape[0]
scale_wm = (h_sym * 0.42) / wm.shape[0]
wm_img = Image.fromarray(wm).resize((int(wm.shape[1] * scale_wm), int(wm.shape[0] * scale_wm)), Image.LANCZOS)
gap = int(sym.shape[1] * 0.16)
W = wm_img.width + gap + sym.shape[1] + 2 * PAD
H = h_sym + 2 * PAD
canvas = Image.new("L", (W, H), 0)
canvas.paste(wm_img, (PAD, PAD + (h_sym - wm_img.height) // 2 + int(h_sym * 0.04)))
canvas.paste(Image.fromarray(sym), (PAD + wm_img.width + gap, PAD))
h_alpha = np.array(canvas)
for label, rgb in (("gold", GOLD), ("white", WHITE), ("charcoal", CHARCOAL)):
    out = np.zeros(h_alpha.shape + (4,), np.uint8)
    out[..., :3] = rgb
    out[..., 3] = h_alpha
    save(out, f"sadad-logo-horizontal-{label}.png")

# 6) App icon masters (1024px) — flat symbol on charcoal and on gold
def app_icon(bg, fg, name):
    size = 1024
    a = Image.fromarray(crop(alpha, SYMBOL))
    target = int(size * 0.62)
    k = target / max(a.size)
    a = a.resize((int(a.width * k), int(a.height * k)), Image.LANCZOS)
    icon = Image.new("RGBA", (size, size), bg + (255,))
    layer = Image.new("RGBA", a.size, fg + (255,))
    icon.paste(layer, ((size - a.width) // 2, (size - a.height) // 2), a)
    icon.save(os.path.join(OUT, name), optimize=True)

app_icon(CHARCOAL, GOLD, "sadad-app-icon-charcoal-1024.png")
app_icon(GOLD, CHARCOAL, "sadad-app-icon-gold-1024.png")


# 7) Auto-traced SVGs (flat). Upsample alpha 4x for smoother curves.
def trace_svg(box, fills, name, upscale=4):
    """fills: list of (y_from_in_box, colour hex) bands, top to bottom."""
    a = crop(alpha, box, PAD)
    im = Image.fromarray(a).resize((a.shape[1] * upscale, a.shape[0] * upscale), Image.LANCZOS)
    bm = np.array(im) > 128
    path = potrace.Bitmap(~bm).trace(turdsize=8, alphamax=1.0, opticurve=True, opttolerance=0.2)
    w, h = a.shape[1], a.shape[0]
    bands = {}
    for curve in path:
        y_start = curve.start_point.y / upscale
        # assign each closed curve to the colour band where it starts
        band = 0
        for i, (y_from, _) in enumerate(fills):
            if y_start >= y_from:
                band = i
        d = [f"M{curve.start_point.x / upscale:.2f},{curve.start_point.y / upscale:.2f}"]
        for seg in curve.segments:
            if seg.is_corner:
                d.append(f"L{seg.c.x / upscale:.2f},{seg.c.y / upscale:.2f}L{seg.end_point.x / upscale:.2f},{seg.end_point.y / upscale:.2f}")
            else:
                d.append(f"C{seg.c1.x / upscale:.2f},{seg.c1.y / upscale:.2f} {seg.c2.x / upscale:.2f},{seg.c2.y / upscale:.2f} {seg.end_point.x / upscale:.2f},{seg.end_point.y / upscale:.2f}")
        d.append("Z")
        bands.setdefault(band, []).append("".join(d))
    groups = "\n".join(
        f'  <path fill="{fills[b][1]}" fill-rule="evenodd" d="{" ".join(ds)}"/>' for b, ds in sorted(bands.items())
    )
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n'
           f'  <title>Sadad Libya — auto-traced provisional vector</title>\n{groups}\n</svg>\n')
    with open(os.path.join(OUT, name), "w") as f:
        f.write(svg)


desc_band = DESCRIPTOR_Y - (FULL[1] - PAD)
trace_svg(FULL, [(0, "#D99F41"), (desc_band, "#3B3B3B")], "sadad-logo-full-flat-light.svg")
trace_svg(FULL, [(0, "#D99F41"), (desc_band, "#FFFFFF")], "sadad-logo-full-flat-dark.svg")
trace_svg(NAME_LOCKUP, [(0, "#D99F41")], "sadad-logo-name-gold.svg")
trace_svg(NAME_LOCKUP, [(0, "#1C1C1E")], "sadad-logo-name-charcoal.svg")
trace_svg(NAME_LOCKUP, [(0, "#FFFFFF")], "sadad-logo-name-white.svg")
trace_svg(SYMBOL, [(0, "#D99F41")], "sadad-symbol-gold.svg")
trace_svg(SYMBOL, [(0, "#1C1C1E")], "sadad-symbol-charcoal.svg")
trace_svg(SYMBOL, [(0, "#FFFFFF")], "sadad-symbol-white.svg")

print("assets written to", os.path.normpath(OUT))
