#!/usr/bin/env python3
"""Generate a clean, to-scale floor plan (Hall 58, LPTIC – City of Technology 2026).

Output: floor-plan.html (SVG inside). Render to PNG/PDF with render.js.
Units: metres. Hall = 130 m x 24 m, scale 20 px / m. North is on the left.
"""
import math, pathlib, re

S = 20                    # px per metre
X0, Y0 = 150, 300         # hall origin (top-left) on the page
W, H = 2900, 1560         # page size

def px(x): return X0 + x * S
def py(y): return Y0 + y * S

C = dict(
    ink="#0f1f38", navy="#14336b", blue="#1f5fbf", sky="#e8f0fb", line="#9aa8bd",
    red="#b3261e", green="#1e7a46", gold="#f2c94c", goldbg="#fff6d6",
    stage="#eef1f6", tech="#e9f6f1", invest="#fdf1e3", glass="#e6f4fb",
    hold="#f3f6fc", booth="#dde6f3", recep="#fbeee0", grey="#5b6678",
)

out = []
def add(s): out.append(s)

def rect(x, y, w, h, fill, stroke=C["line"], sw=2, rx=6, dash=None, extra=""):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<rect x="{px(x):.1f}" y="{py(y):.1f}" width="{w*S:.1f}" height="{h*S:.1f}" rx="{rx}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d} {extra}/>')

def text(x, y, s, size=18, weight=600, fill=C["ink"], anchor="middle", absolute=False, extra=""):
    X, Y = (x, y) if absolute else (px(x), py(y))
    # `anchor` is the visual anchor (start = left edge, end = right edge).
    # Arabic text is laid out RTL, where SVG start/end are mirrored.
    if re.search("[\u0600-\u06FF]", s):
        extra = extra.replace('direction="rtl"', '') + ' direction="rtl"'
        anchor = {"start": "end", "end": "start"}.get(anchor, anchor)
    add(f'<text x="{X:.1f}" y="{Y:.1f}" font-size="{size}" font-weight="{weight}" fill="{fill}" '
        f'text-anchor="{anchor}" dominant-baseline="middle" {extra}>{s}</text>')

def badge(x, y, n, color, r=17):
    add(f'<circle cx="{px(x):.1f}" cy="{py(y):.1f}" r="{r}" fill="{color}" stroke="#fff" stroke-width="3"/>')
    text(x, y + 0.05, n, 20, 800, "#fff")

# ---------------------------------------------------------------- page + header
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
add(f'<rect x="0" y="0" width="{W}" height="14" fill="{C["navy"]}"/>')
text(W-150, 70, "المخطط المكاني المبدئي — جناح الشركة القابضة للاتصالات وشركات المجموعة", 44, 800, C["navy"], "end", True, 'direction="rtl"')
text(W-150, 122, "معرض وملتقى ليبيا للتقنية والاتصالات «مدينة التقنية 2026» · جناح 58 · المساحة الإجمالية 3,120 م² (130 × 24 م) · النسخة المعدّلة (2) · بديل: المسرح شمالاً", 24, 600, C["grey"], "end", True, 'direction="rtl"')
text(150, 70, "LPTIC · City of Technology 2026", 30, 800, C["navy"], "start", True)
text(150, 112, "Hall 58 · Revision 2 · Conceptual layout – verify on site", 20, 600, C["grey"], "start", True)

# route strip
steps = [("1", "الدخول", C["green"]), ("2", "القابضة وشركاتها", C["navy"]), ("3", "التقنية", C["ink"]),
         ("4", "المسرح الرئيسي", C["ink"]), ("5", "الخروج", C["red"])]
sx = W - 150
add('<g>')
text(sx, 172, "مسار الزيارة:", 22, 800, C["ink"], "end", True); sx -= 170
widths = [120, 230, 120, 200, 110]
for i, (n, label, col) in enumerate(steps):
    add(f'<circle cx="{sx-16}" cy="172" r="16" fill="{col}"/>')
    text(sx-16, 173, n, 18, 800, "#fff", "middle", True)
    text(sx-42, 172, label, 22, 700, C["ink"], "end", True)
    sx -= 42 + widths[i]
    if i < len(steps) - 1:
        add(f'<path d="M{sx+14} 172 L{sx-26} 172" stroke="{C["red"]}" stroke-width="3" marker-end="url(#arr)"/>')
        sx -= 56
add('</g>')

# ---------------------------------------------------------------- dimensions
add(f'<g stroke="{C["grey"]}" stroke-width="1.5" fill="none">'
    f'<path d="M{px(0)} {py(-2.2)} H{px(130)}" marker-start="url(#tick)" marker-end="url(#tick)"/>'
    f'<path d="M{px(130)+50} {py(0)} V{py(24)}" marker-start="url(#tick)" marker-end="url(#tick)"/></g>')
add(f'<rect x="{px(65)-46}" y="{py(-2.2)-16}" width="92" height="32" fill="#fff"/>')
text(65, -2.2, "130 م", 22, 800, C["grey"])
add(f'<rect x="{px(130)+28}" y="{py(12)-36}" width="44" height="72" fill="#fff"/>')
text(132.5, 12, "24 م", 22, 800, C["grey"], extra=f'transform="rotate(-90 {px(132.5)} {py(12)})"')

# north arrow (left)
nx, ny = px(0) - 75, py(12)
add(f'<g transform="translate({nx} {ny})"><circle r="36" fill="#fff" stroke="{C["line"]}" stroke-width="2"/>'
    f'<path d="M-24 0 L14 -12 L6 0 L14 12 Z" fill="{C["navy"]}"/></g>')
text(0, 0, "ش", 24, 800, C["navy"], absolute=True, extra=f'x="{nx}" y="{ny+60}"')
out[-1] = out[-1].replace(f'x="0.0" y="0.0" ', '')
text(nx, ny + 88, "(شمال)", 16, 600, C["grey"], absolute=True)

# ---------------------------------------------------------------- hall shell
rect(0, 0, 130, 24, "#fbfcfe", C["ink"], 5, 4)

# zone 4 – main stage & workshops (0–37.5 m => 900 m²)
rect(0, 0, 37.5, 24, C["stage"], "none", 0, 0)
# zone 3 – technology (44–69 x 12–24 => 300 m²)
rect(44, 12.4, 25, 11.6, C["tech"], C["green"], 2.5, 8)
# investment (44–64 x 0–10 => 200 m²)
rect(44, 0, 20, 10, C["invest"], "#d9a35e", 2.5, 8)
# holding zone (71.5–130 => ~1,400 m²)
rect(71.5, 0, 58.5, 24, C["hold"], "none", 0, 0)
add(f'<line x1="{px(71.5)}" y1="{py(0)}" x2="{px(71.5)}" y2="{py(24)}" stroke="{C["line"]}" stroke-width="2" stroke-dasharray="10 8"/>')
add(f'<line x1="{px(37.5)}" y1="{py(0)}" x2="{px(37.5)}" y2="{py(24)}" stroke="{C["line"]}" stroke-width="2" stroke-dasharray="10 8"/>')

# ---- stage, seating, booths
rect(9, 0.6, 14, 3.4, C["navy"], C["navy"], 0, 8)
text(16, 2.3, "المسرح الرئيسي", 24, 800, "#fff")
rect(1, 0.6, 5, 3.4, "#fff", C["line"]); text(3.5, 2.3, "دعم المسرح", 15, 700, C["grey"])
rect(26, 0.6, 5, 3.4, "#fff", C["line"]); text(28.5, 2.3, "دعم المسرح", 15, 700, C["grey"])
rect(26.5, 5, 4, 3, C["glass"], C["blue"], 2, 4)
text(28.5, 6.1, "كشك الترجمة", 14, 800, C["blue"]); text(28.5, 7.1, "Interpretation", 12, 600, C["blue"])
# speaker icons
for sxm in (8.2, 23.8):
    add(f'<path d="M{px(sxm)-7} {py(4.6)} h6 l8 -7 v20 l-8 -7 h-6z" fill="{C["ink"]}"/>')
# seats: 8 rows x 18 = 144, two blocks, arc around stage centre
cx, cy = 16, 1.2
seats = 0
for r in range(8):
    R = 6.4 + r * 1.05
    n = 9
    for side in (-1, 1):
        a0, a1 = 6, 52 if r < 4 else 50
        for k in range(n):
            a = math.radians(side * (a0 + (a1 - a0) * k / (n - 1)))
            x = cx + R * math.sin(a); y = cy + R * math.cos(a)
            add(f'<rect x="{px(x)-6}" y="{py(y)-5}" width="12" height="10" rx="3" fill="#7d8aa3" '
                f'transform="rotate({-math.degrees(a):.1f} {px(x):.1f} {py(y):.1f})"/>')
            seats += 1
assert seats == 144
text(16, 15.6, "144 مقعداً (قابلة للتوسعة إلى 150)", 17, 700, C["grey"], extra='direction="rtl"')
text(14, 18.4, "المسرح الرئيسي وورش العمل", 26, 800, C["ink"])
text(14, 19.8, "900 م² (تشمل قاعة الورش)", 19, 700, C["grey"], extra='direction="rtl"')
text(14, 22.7, "ساحة انتظار وتنقّل", 16, 600, C["grey"])
badge(2.3, 12, "4", C["ink"])
# workshop glass hall (27.5–37.5 x 14–24 = 100 m²)
rect(27.5, 14, 10, 10, C["glass"], C["blue"], 3, 4)
add(f'<path d="M{px(29.5)} {py(17)} V{py(21.5)} H{px(35.5)} V{py(17)}" fill="none" stroke="{C["ink"]}" stroke-width="5"/>')
text(32.5, 15.3, "قاعة الورش التخصصية", 17, 800, C["blue"])
text(32.5, 16.4, "زجاجية · 100 م² · 25–30 مشاركاً", 13, 600, C["blue"], extra='direction="rtl"')
text(32.5, 22.8, "(ضمن الـ 900 م²)", 13, 600, C["grey"], extra='direction="rtl"')

# ---- kids & youth (38–44 x 1–6 = 30 m²)
rect(38.2, 1, 5.6, 5.36, C["goldbg"], "#d4a017", 2.5, 6)
text(41, 2.6, "الأطفال واليافعون", 12.5, 800, "#8a6400"); text(41, 4, "30 م²", 17, 800, "#8a6400")
text(41, 5.2, "(ركن هادئ)", 12, 600, "#8a6400")

# ---- investment & innovation (44–64 x 0–10)
text(54, 1.3, "الاستثمار والابتكار — 200 م²", 21, 800, "#9a5a12", extra='direction="rtl"')
text(54, 2.6, "12 طاولة عرض (A1–A6 / B1–B6) للمشاريع الناشئة", 14, 600, "#9a5a12", extra='direction="rtl"')
for i in range(6):
    xa = 46.6 + i * 2.75
    for row, yy in (("A", 3.7), ("B", 6.4)):
        rect(xa, yy, 2.2, 1.6, "#fff", "#d9a35e", 1.8, 3)
        text(xa + 1.1, yy + 0.82, f"{row}{6-i}", 14, 800, "#9a5a12")
rect(44.4, 3.7, 1.8, 4.3, "#fff", "#d9a35e", 1.5, 3)
text(45.3, 5.85, "مخزن", 12, 700, "#9a5a12", extra=f'transform="rotate(-90 {px(45.3)} {py(5.85)})"')
rect(46, 8.6, 16, 1.0, "#f6dcb8", "none", 0, 3)
text(54, 9.12, "شريط الاستقبال وبوابة الجناح", 12, 700, "#9a5a12")

# ---- focus group glass room (64.5–69.5 x 4–9 ≈ 25 m²)
rect(64.5, 4, 5, 5, C["glass"], C["blue"], 2.5, 4)
text(67, 5.2, "الغرفة الزجاجية", 13, 800, C["blue"]); text(67, 6.3, "Focus Group", 12, 700, C["blue"])
text(67, 7.4, "25 م² · 6–8", 12, 700, C["blue"], extra='direction="rtl"')
rect(65, 0.4, 4, 3, "none", C["grey"], 1.5, 3, "6 5")
text(67, 1.9, "مساحة حركة", 11, 600, C["grey"])

# ---- main corridor label
text(57, 10.75, "الممر الرئيسي للزوار", 14, 700, C["red"], extra='stroke="#fbfcfe" stroke-width="6" paint-order="stroke"')

# ---- technology zone
text(56.5, 14.2, "منطقة التقنية — 300 م²", 22, 800, C["green"], extra='direction="rtl"')
text(56.5, 15.6, "منصات عرض وتجارب تقنية تفاعلية", 14, 600, C["green"])
icons = ["5G", "Wi-Fi", "IoT", "AI", "VR", "Smart"]
for i, lab in enumerate(icons):
    xi = 47.5 + i * 3.6
    add(f'<circle cx="{px(xi)}" cy="{py(19.3)}" r="30" fill="#fff" stroke="{C["green"]}" stroke-width="2.5"/>')
    text(xi, 19.35, lab, 15, 800, C["green"])
badge(45.5, 13.7, "3", C["ink"])

# ---- holding zone
text(84, 9.3, "القابضة وشركاتها", 30, 800, C["navy"])
text(84, 11.1, "1,400 م²", 26, 800, C["navy"], extra='direction="rtl"')
rect(77, 6.2, 51, 11, "none", C["blue"], 2, 8, "4 6")
rect(97, 8.4, 14, 6.6, C["navy"], C["navy"], 0, 10)
text(104, 10.7, "جناح القابضة", 26, 800, "#fff")
text(104, 12.6, "LPTIC Holding", 20, 600, "#cfe0ff")
badge(97, 15, "2", C["blue"])
text(120, 10.6, "أجنحة الشركات التابعة", 16, 700, C["grey"])
text(120, 12, "(مواقع وأحجام إرشادية)", 14, 600, C["grey"])

top = ["ليبيانا", "المدار الجديد", "الجيل الجديد", "ليبيا للاتصالات والتقنية", "الأكاديمية الليبية"]
for i, name in enumerate(top):
    x = 74 + i * 11.2
    rect(x, 0.6, 9.4, 4, C["booth"], "#8ea2c2", 2, 8)
    text(x + 4.7, 2.6, name, 17 if len(name) < 16 else 15, 800, C["navy"])
bottom = [(74, "البنية"), (98, "الاتصالات الدولية"), (108.5, "هاتف ليبيا"), (119, "بريد ليبيا")]
for x, name in bottom:
    rect(x, 19.4, 9.4, 4, C["booth"], "#8ea2c2", 2, 8)
    text(x + 4.7, 21.4, name, 17, 800, C["navy"])
# reception 72 m² (84.5–96.5 x 18–24)
rect(84.5, 18, 12, 5.8, C["recep"], "#d9a35e", 2.5, 6)
text(90.5, 19.2, "مركز الاستقبال والتوجيه · 72 م²", 14, 800, "#9a5a12", extra='stroke="#fbeee0" stroke-width="7" paint-order="stroke"')
for i in range(4):
    xc = 86.3 + i * 2.8
    add(f'<circle cx="{px(xc)}" cy="{py(21.4)}" r="15" fill="#fff" stroke="#d9a35e" stroke-width="2"/>')
    text(xc, 21.45, str(4 - i), 15, 800, "#9a5a12")

# ---------------------------------------------------------------- visitor route
route = [(90.5, 25.8), (90.5, 16.6), (75.5, 16.6), (75.5, 11.2), (40.5, 11.2), (40.5, 8.0),
         (36.5, 8.0), (36.5, 11.2), (4.5, 11.2), (4.5, 20.6), (25.5, 20.6), (25.5, 25.8)]
# simplify: keep a clean corridor (no detour)
route = [(90.5, 25.8), (90.5, 16.6), (75.5, 16.6), (75.5, 11.6), (27, 11.6), (27, 16.8), (4.5, 16.8), (4.5, 21.0), (25.5, 21.0), (25.5, 25.8)]
pts = []
for (a, b), (c, d) in zip(route, route[1:]):
    L = math.hypot(c - a, d - b); n = max(1, int(L // 7))
    for k in range(n):
        pts.append((a + (c - a) * k / n, b + (d - b) * k / n))
pts.append(route[-1])
dpath = "M" + " L".join(f"{px(x):.1f} {py(y):.1f}" for x, y in pts)
add(f'<path d="{dpath}" fill="none" stroke="{C["red"]}" stroke-width="3.5" stroke-dasharray="12 8" '
    f'marker-mid="url(#arrs)" marker-end="url(#arr)" stroke-linejoin="round"/>')

# entrance / exit
add(f'<rect x="{px(88.5)}" y="{py(24)-5}" width="{4*S}" height="10" fill="#fff"/>')
add(f'<rect x="{px(23.5)}" y="{py(24)-5}" width="{4*S}" height="10" fill="#fff"/>')
add(f'<path d="M{px(90.5)} {py(29.5)} V{py(26.2)}" stroke="{C["green"]}" stroke-width="10" marker-end="url(#arrg)"/>')
add(f'<path d="M{px(25.5)} {py(25.6)} V{py(28.8)}" stroke="{C["red"]}" stroke-width="10" marker-end="url(#arrr)"/>')
badge(93, 28.2, "1", C["green"]); text(95, 28.2, "دخول الزوار", 24, 800, C["green"], "start", extra='direction="rtl"')
badge(28, 28.2, "5", C["red"]);   text(30, 28.2, "خروج الزوار", 24, 800, C["red"], "start", extra='direction="rtl"')

# scale bar
sbx, sby = px(110), py(28.4)
for i in range(4):
    add(f'<rect x="{sbx + i*5*S}" y="{sby}" width="{5*S}" height="10" fill="{C["ink"] if i%2==0 else "#fff"}" stroke="{C["ink"]}" stroke-width="1.5"/>')
for i in range(5):
    text(sbx + i*5*S, sby + 28, str(i*5), 15, 700, C["grey"], absolute=True)
text(sbx + 20*S + 30, sby + 5, "م", 16, 700, C["grey"], absolute=True)
text(sbx + 10*S, sby - 20, "مقياس الرسم", 16, 700, C["grey"], "middle", True)

# ---------------------------------------------------------------- bottom panels
PY = 960; PH = 560; gap = 40; pw = (W - 300 - 2 * gap) / 3
def panel(i, title):
    x = W - 150 - (i + 1) * pw - i * gap
    add(f'<rect x="{x}" y="{PY}" width="{pw}" height="{PH}" rx="14" fill="#f7f9fc" stroke="#dbe2ec" stroke-width="2"/>')
    add(f'<rect x="{x}" y="{PY}" width="{pw}" height="62" rx="14" fill="{C["navy"]}"/>'
        f'<rect x="{x}" y="{PY+40}" width="{pw}" height="22" fill="{C["navy"]}"/>')
    text(x + pw - 28, PY + 32, title, 25, 800, "#fff", "end", True, 'direction="rtl"')
    return x

# panel 1 – areas
x = panel(0, "التحقق من المساحات المعتمدة")
areas = [("القابضة وشركاتها", "1,400", C["navy"]), ("المسرح الرئيسي وورش العمل *", "900", "#7d8aa3"),
         ("منطقة التقنية", "300", C["green"]), ("الاستثمار والابتكار", "200", "#d9a35e"),
         ("الأطفال واليافعون", "30", "#d4a017"), ("الغرفة الزجاجية / مجموعات التركيز", "25", C["blue"]),
         ("الاستقبال والحركة والدعم المتبقي **", "265", C["red"])]
yy = PY + 105
for name, a, col in areas:
    add(f'<rect x="{x+pw-50}" y="{yy-11}" width="22" height="22" rx="5" fill="{col}"/>')
    text(x + pw - 64, yy, name, 20, 700, C["ink"], "end", True, 'direction="rtl"')
    text(x + 140, yy, f"{a} م²", 21, 800, C["ink"], "end", True)
    add(f'<line x1="{x+24}" y1="{yy+26}" x2="{x+pw-24}" y2="{yy+26}" stroke="#e1e7f0"/>')
    yy += 52
add(f'<rect x="{x+20}" y="{yy-18}" width="{pw-40}" height="48" rx="8" fill="{C["navy"]}"/>')
text(x + pw - 40, yy + 6, "الإجمالي", 22, 800, "#fff", "end", True)
text(x + 140, yy + 6, "3,120 م²", 23, 800, "#fff", "end", True, 'direction="rtl"')
text(x + pw - 28, yy + 62, "* تشمل قاعة الورش (≈100 م²) وكشك الترجمة والمقاعد (144)", 15, 600, C["grey"], "end", True, 'direction="rtl"')
text(x + pw - 28, yy + 88, "** 247 م² + 18 م² من قاعة الاجتماع الملغاة (3×3 ×2) = 265 م²", 15, 600, C["grey"], "end", True, 'direction="rtl"')

# panel 2 – legend
x = panel(1, "مفتاح المخطط")
yy = PY + 108
def leg(sym, label):
    global yy
    add(sym.format(x=x + pw - 90, y=yy))
    text(x + pw - 110, yy, label, 19, 700, C["ink"], "end", True, 'direction="rtl"')
    yy += 50
leg('<rect x="{x}" y="{y}" width="56" height="26" rx="5" fill="#fbfcfe" stroke="#9aa8bd" stroke-width="2" stroke-dasharray="8 6" transform="translate(0 -13)"/>', "حركة الزوار والدعم (ضمن المتبقي 265 م²)")
leg('<path d="M{x} {y} h56" stroke="#b3261e" stroke-width="3.5" stroke-dasharray="10 7" marker-end="url(#arr)"/>', "مسار الزيارة المقترح (1 ← 5)")
leg('<rect x="{x}" y="{y}" width="56" height="26" rx="4" fill="#e6f4fb" stroke="#1f5fbf" stroke-width="2.5" transform="translate(0 -13)"/>', "جدران زجاجية (الورش · الغرفة الزجاجية)")
leg('<rect x="{x}" y="{y}" width="56" height="26" rx="6" fill="#14336b" transform="translate(0 -13)"/>', "جناح القابضة (محوري)")
leg('<rect x="{x}" y="{y}" width="56" height="26" rx="6" fill="#dde6f3" stroke="#8ea2c2" stroke-width="2" transform="translate(0 -13)"/>', "أجنحة الشركات التابعة")
leg('<g transform="translate(0 -6)"><rect x="{x}" y="{y}" width="12" height="10" rx="3" fill="#7d8aa3"/><rect x="{x}" y="{y}" width="12" height="10" rx="3" fill="#7d8aa3" transform="translate(20 0)"/><rect x="{x}" y="{y}" width="12" height="10" rx="3" fill="#7d8aa3" transform="translate(40 0)"/></g>', "مقاعد الجمهور تواجه المسرح (144 ← 150)")
leg('<path d="M{x} {y} m14 -10 h6 l8 -7 v34 l-8 -7 h-6z" fill="#0f1f38" transform="translate(0 0)"/>', "سماعات المسرح (موقع إرشادي)")
leg('<path d="M{x} {y} m28 22 v-32" stroke="#1e7a46" stroke-width="7" marker-end="url(#arrg)"/>', "مدخل الزوار (فتحة المخرج السابق)")
leg('<path d="M{x} {y} m28 -18 v26" stroke="#b3261e" stroke-width="7" marker-end="url(#arrr)"/>', "مخرج الزوار (فتحة المدخل السابق)")

# panel 3 – revision notes
x = panel(2, "التعديلات في هذه النسخة وتنبيهات المراجعة")
notes = [("تعديلات:", C["navy"]),
         ("• عكس أفقي للمخطط مع تبديل وظيفي للمدخل والمخرج.", None),
         ("• بديل: المسرح على الجدار الشمالي · 144 مقعداً (≤ 150).", None),
         ("• كشك الترجمة بجانب دعم المسرح · إلغاء قاعتَي الاجتماع 3×3.", None),
         ("مراجعة:", C["red"]),
         ("• كثافة المدخل الجديدة ≈ 2.3 م² للفرد (ثالث مخرجاً) — يُتحقَّق منها.", None),
         ("• المتبقي 265 م² يغطي الاستقبال والممر الأوسط ومحيط الغرفة", None),
         ("  الزجاجية فقط؛ الممرات داخل القابضة والمسرح من مساحاتها.", None),
         ("• مخارج الطوارئ ومسارات الإخلاء غير مشمولة ولم تُفترض.", None),
         ("• لا يُدّعى الامتثال لاشتراطات السلامة أو الإتاحة أو الحدود.", None)]
yy = PY + 108
for s, col in notes:
    text(x + pw - 30, yy, s, 20 if col else 18, 800 if col else 600, col or C["ink"], "end", True, 'direction="rtl"')
    yy += 44 if col else 40

text(W / 2, H - 20, "مخطط مفاهيمي غير ملزم — الأبعاد والمواقع إرشادية وتخضع للتأكيد الميداني والاعتماد من إدارة المعرض", 16, 600, C["grey"], "middle", True, 'direction="rtl"')

defs = f'''<defs>
<marker id="arr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="{C["red"]}"/></marker>
<marker id="arrs" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="{C["red"]}"/></marker>
<marker id="arrg" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="{C["green"]}"/></marker>
<marker id="arrr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="{C["red"]}"/></marker>
<marker id="tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" orient="auto"><path d="M5 0 V10" stroke="{C["grey"]}" stroke-width="1.5"/></marker>
</defs>'''

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
       f'font-family="Cairo, \'DejaVu Sans\', sans-serif">{defs}' + "\n".join(out) + "</svg>")
html = f'''<!doctype html><html lang="ar"><head><meta charset="utf-8"><title>Hall 58 Floor Plan</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap">
<style>html,body{{margin:0;background:#fff}}svg{{display:block}}</style></head><body>{svg}</body></html>'''
here = pathlib.Path(__file__).parent
(here / "floor-plan.html").write_text(html, encoding="utf-8")
(here / "floor-plan.svg").write_text(svg, encoding="utf-8")
print("ok")
