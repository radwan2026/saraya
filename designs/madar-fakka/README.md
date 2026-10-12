# كروت «مدار فكة» — 5×2 سم

كرتا رصيد ورقيان بهوية شركة **المدار الجديد**:

| الملف | الوصف |
|---|---|
| `out/fakka-1-dinar.pdf` / `.png` | كرت رصيد دينار (1) بالمقاس الفعلي 50×20 مم |
| `out/fakka-half-dinar.pdf` / `.png` | كرت رصيد نصف دينار (0.5) بالمقاس الفعلي |
| `out/*-A4-sheet.pdf` | ورقة A4 جاهزة للطباعة: 56 كرتاً (4×14) مع علامات قص |
| `out/preview.png` | معاينة للكرتين معاً |

إعادة التوليد (يتطلب Playwright):

```bash
NODE_PATH=$(npm root -g) node designs/madar-fakka/build.mjs
```

الخط: Cairo (مضمَّن في `assets/`، رخصة SIL OFL).
