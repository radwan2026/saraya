"""Write Sadad Libya colour files (JSON, CSS tokens, Adobe ASE, GIMP GPL).
Run: python3 -I brand/scripts/build_colors.py"""
import json, os, struct

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "colors")
PALETTE = [  # key, Arabic name, English name, hex, role, status
    ("blue", "أزرق سداد", "Sadad Blue", "#0087B0", "primary — logo symbol", "approved — sampled from logo"),
    ("teal", "فيروزي", "Teal", "#13B3BD", "gradient start, accents on dark", "approved — sampled from logo"),
    ("azure", "أزرق فعّال", "Action Azure", "#006DBE", "buttons, links, text on light", "approved — sampled from logo"),
    ("navy", "كحلي", "Navy", "#004985", "wordmark, descriptor, headings", "approved — sampled from logo"),
    ("midnight", "ليلي", "Midnight", "#0A1E33", "dark backgrounds", "proposed"),
    ("ink", "حبري", "Ink", "#1F2D3D", "body text", "proposed"),
    ("slate", "رمادي", "Slate", "#5F6B7A", "secondary text", "proposed"),
    ("mist", "ضبابي", "Mist", "#E4ECF2", "dividers, secondary surfaces", "proposed"),
    ("snow", "ثلجي", "Snow", "#F5F8FB", "app / page background", "proposed"),
    ("white", "أبيض", "White", "#FFFFFF", "cards, fields", "proposed"),
    ("success", "نجاح", "Success", "#1E7F55", "digital UI only", "proposed"),
    ("error", "خطأ", "Error", "#C0392B", "digital UI only", "proposed"),
]
GRADIENT = ["#13B3BD", "#0087B0", "#006DBE", "#004985"]


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def cmyk(h):
    r, g, b = (v / 255 for v in rgb(h))
    k = 1 - max(r, g, b)
    if k == 1:
        return (0, 0, 0, 100)
    return tuple(round(100 * x) for x in ((1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k))


data = {
    "brand": "Sadad Libya / سداد ليبيا",
    "version": "1.0",
    "note": "CMYK values are approximate conversions from RGB; confirm with a print proof.",
    "colors": [
        {"key": k, "name_ar": ar, "name_en": en, "hex": h, "rgb": rgb(h), "cmyk_approx": cmyk(h), "role": role, "status": st}
        for k, ar, en, h, role, st in PALETTE
    ],
    "brand_gradient": {"stops": GRADIENT, "positions": [0, 45, 75, 100], "angle_deg": 135, "use": "screens, campaigns, app icon, large colour areas"},
}
with open(os.path.join(OUT, "sadad-colors.json"), "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

css = [":root {"] + [f"  --sadad-{k}: {h}; /* {en} */" for k, _, en, h, _, _ in PALETTE]
css.append(f"  --sadad-gradient: linear-gradient(135deg, {GRADIENT[0]} 0%, {GRADIENT[1]} 45%, {GRADIENT[2]} 75%, {GRADIENT[3]} 100%);")
css.append("}")
with open(os.path.join(OUT, "sadad-tokens.css"), "w") as f:
    f.write("/* Sadad Libya colour tokens v1.0 */\n" + "\n".join(css) + "\n")

with open(os.path.join(OUT, "sadad-colors.gpl"), "w") as f:
    f.write("GIMP Palette\nName: Sadad Libya\nColumns: 4\n#\n")
    for _, _, en, h, _, _ in PALETTE:
        f.write("%3d %3d %3d\t%s %s\n" % (*rgb(h), en, h))

# Adobe Swatch Exchange (ASE) v1.0, RGB global swatches
blocks = b""
for _, _, en, h, _, _ in PALETTE:
    name = f"Sadad {en}".encode("utf-16-be") + b"\x00\x00"
    body = struct.pack(">H", len(name) // 2) + name + b"RGB " + struct.pack(">fff", *(v / 255 for v in rgb(h))) + struct.pack(">H", 0)
    blocks += struct.pack(">HI", 0x0001, len(body)) + body
with open(os.path.join(OUT, "sadad-colors.ase"), "wb") as f:
    f.write(b"ASEF" + struct.pack(">HHI", 1, 0, len(PALETTE)) + blocks)
print("colour files written")
