"""Build Sadad Libya logo assets from the approved reference PNG.

Run:  python3 -I brand/scripts/build_assets.py   (from the repo root)

Input   : brand/assets/reference/sadad-logo-source.png (1920x1080, transparent, blue/teal gradient)
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

BLUE = (0, 135, 176)       # Sadad Blue  #0087B0 — symbol median in the source
NAVY = (0, 73, 133)        # Navy        #004985 — wordmark / descriptor in the source
TEAL = (19, 179, 189)      # Teal        #13B3BD — light end of the symbol gradient
AZURE = (0, 109, 190)      # Azure       #006DBE — deep end of the symbol gradient
MIDNIGHT = (10, 30, 51)    # Midnight    #0A1E33
WHITE = (255, 255, 255)

# Regions measured on the 1920x1080 source (x0, y0, x1, y1)
FULL = (619, 225, 1302, 822)
NAME_LOCKUP = (619, 225, 1302, 760)   # symbol + name, no descriptor
SYMBOL = (791, 225, 1156, 600)
WORDMARK = (619, 633, 1302, 760)
DESCRIPTOR_Y = 780

gradient_src = np.array(Image.open(os.path.join(REF, "sadad-logo-source.png")).convert("RGBA"))
alpha = gradient_src[..., 3]


def crop(arr, box, pad=0):
    x0, y0, x1, y1 = box
    return arr[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad]


def mono(box, rgb, pad=0):
    a = crop(alpha, box, pad)
    out = np.zeros(a.shape + (4,), np.uint8)
    out[..., :3] = rgb
    out[..., 3] = a
    return out


def two_tone(box, top_rgb, bottom_rgb, split_y, pad=0):
    """Symbol in top_rgb, everything from source row split_y down in bottom_rgb."""
    out = mono(box, top_rgb, pad)
    out[split_y - (box[1] - pad):, :, :3] = bottom_rgb
    return out


def save(arr, name):
    Image.fromarray(arr, "RGBA").save(os.path.join(OUT, name), optimize=True)


PAD = 24
NAME_Y = 620  # first source row below the symbol

# 1) Gradient logo exactly as supplied (light backgrounds)
save(crop(gradient_src, FULL, PAD), "sadad-logo-full-primary.png")
save(crop(gradient_src, NAME_LOCKUP, PAD), "sadad-logo-name-gradient.png")
save(crop(gradient_src, SYMBOL, PAD), "sadad-symbol-gradient.png")

# 2) Reverse — gradient symbol, white name + descriptor (dark backgrounds)
rev = gradient_src.copy()
rev[NAME_Y:, :, :3] = WHITE
save(crop(rev, FULL, PAD), "sadad-logo-full-reverse.png")
save(crop(rev, NAME_LOCKUP, PAD), "sadad-logo-name-reverse.png")

# 3) Flat versions (official everyday reference)
save(two_tone(FULL, BLUE, NAVY, NAME_Y, PAD), "sadad-logo-full-flat-light.png")
save(two_tone(FULL, TEAL, WHITE, NAME_Y, PAD), "sadad-logo-full-flat-dark.png")
for label, rgb in (("blue", BLUE), ("navy", NAVY), ("white", WHITE)):
    save(mono(FULL, rgb, PAD), f"sadad-logo-full-{label}.png")
    save(mono(NAME_LOCKUP, rgb, PAD), f"sadad-logo-name-{label}.png")
    save(mono(SYMBOL, rgb, PAD), f"sadad-symbol-{label}.png")
    save(mono(WORDMARK, rgb, PAD), f"sadad-wordmark-{label}.png")
save(two_tone(NAME_LOCKUP, BLUE, NAVY, NAME_Y, PAD), "sadad-logo-name-color.png")

# 4) Horizontal lockup (proposed): symbol on the right (RTL reading start), wordmark left
def horizontal(sym_rgba, wm_rgba, name):
    h_sym = sym_rgba.shape[0]
    k = (h_sym * 0.42) / wm_rgba.shape[0]
    wm_img = Image.fromarray(wm_rgba, "RGBA").resize((int(wm_rgba.shape[1] * k), int(wm_rgba.shape[0] * k)), Image.LANCZOS)
    gap = int(sym_rgba.shape[1] * 0.16)
    canvas = Image.new("RGBA", (wm_img.width + gap + sym_rgba.shape[1] + 2 * PAD, h_sym + 2 * PAD), (0, 0, 0, 0))
    canvas.alpha_composite(wm_img, (PAD, PAD + (h_sym - wm_img.height) // 2 + int(h_sym * 0.04)))
    canvas.alpha_composite(Image.fromarray(sym_rgba, "RGBA"), (PAD + wm_img.width + gap, PAD))
    canvas.save(os.path.join(OUT, name), optimize=True)

horizontal(crop(gradient_src, SYMBOL), crop(gradient_src, WORDMARK), "sadad-logo-horizontal-gradient.png")
horizontal(mono(SYMBOL, BLUE), mono(WORDMARK, NAVY), "sadad-logo-horizontal-color.png")
horizontal(mono(SYMBOL, WHITE), mono(WORDMARK, WHITE), "sadad-logo-horizontal-white.png")
horizontal(mono(SYMBOL, NAVY), mono(WORDMARK, NAVY), "sadad-logo-horizontal-navy.png")

# 5) App icon masters (1024px)
def app_icon(bg, fg, name):
    size = 1024
    a = Image.fromarray(crop(alpha, SYMBOL))
    k = int(size * 0.62) / max(a.size)
    a = a.resize((int(a.width * k), int(a.height * k)), Image.LANCZOS)
    if isinstance(bg, tuple):
        icon = Image.new("RGBA", (size, size), bg + (255,))
    else:  # diagonal gradient teal -> azure -> navy
        t = np.clip((np.add.outer(np.arange(size), np.arange(size)) / (2 * size - 2)), 0, 1)[..., None]
        stops = [(0, TEAL), (0.55, AZURE), (1, NAVY)]
        rgb = np.zeros((size, size, 3))
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            m = ((t >= t0) & (t <= t1))[..., 0]
            u = ((t - t0) / (t1 - t0))[m]
            rgb[m] = np.array(c0) * (1 - u) + np.array(c1) * u
        icon = Image.fromarray(np.dstack([rgb.astype(np.uint8), np.full((size, size), 255, np.uint8)]), "RGBA")
    if fg == "gradient":
        g = Image.fromarray(crop(gradient_src, SYMBOL), "RGBA").resize(a.size, Image.LANCZOS)
        icon.alpha_composite(g, ((size - a.width) // 2, (size - a.height) // 2))
    else:
        icon.paste(Image.new("RGBA", a.size, fg + (255,)), ((size - a.width) // 2, (size - a.height) // 2), a)
    icon.save(os.path.join(OUT, name), optimize=True)

app_icon("gradient", WHITE, "sadad-app-icon-blue-1024.png")
app_icon(WHITE, "gradient", "sadad-app-icon-white-1024.png")


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


name_band = NAME_Y - (FULL[1] - PAD)
trace_svg(FULL, [(0, "#0087B0"), (name_band, "#004985")], "sadad-logo-full-flat-light.svg")
trace_svg(FULL, [(0, "#13B3BD"), (name_band, "#FFFFFF")], "sadad-logo-full-flat-dark.svg")
trace_svg(NAME_LOCKUP, [(0, "#0087B0"), (name_band, "#004985")], "sadad-logo-name-color.svg")
trace_svg(NAME_LOCKUP, [(0, "#004985")], "sadad-logo-name-navy.svg")
trace_svg(NAME_LOCKUP, [(0, "#FFFFFF")], "sadad-logo-name-white.svg")
trace_svg(SYMBOL, [(0, "#0087B0")], "sadad-symbol-blue.svg")
trace_svg(SYMBOL, [(0, "#004985")], "sadad-symbol-navy.svg")
trace_svg(SYMBOL, [(0, "#FFFFFF")], "sadad-symbol-white.svg")

print("assets written to", os.path.normpath(OUT))
