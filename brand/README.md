# سداد ليبيا — Brand Identity Guidelines (v1.0)

Brand book and identity assets for **Sadad Libya** (للخدمات المالية والمدفوعات الإلكترونية).

## Outputs
| Path | Content |
|---|---|
| `Sadad-Libya-Brand-Guidelines-v1.0.pdf` | Full brand book, 43 A4 landscape pages |
| `Sadad-Libya-Quick-Reference.pdf` | One-page spec sheet |
| `index.html` + `book.css` | Source of the book (editable) |
| `assets/logo/` | Logo PNGs (flat, metallic, mono, horizontal), app icons, auto-traced SVGs, `pdf/` vector PDFs |
| `assets/colors/` | Palette as JSON, CSS tokens, Adobe ASE, GIMP GPL |
| `assets/type/` | Typography tokens (CSS) and reference (MD) |
| `assets/icons/` | 23 icons, 24 px grid, 1.75 stroke |
| `assets/reference/` | Client-supplied source files (logo PNGs, campaign image, 3D illustration) |

## Rebuild
```bash
python3 -I brand/scripts/build_assets.py   # logo crops, colour variants, traced SVGs (needs: pip install potracer pillow numpy)
python3 -I brand/scripts/build_colors.py   # colour files
NODE_PATH=$(npm root -g) node brand/scripts/build_book.cjs   # PDFs, logo PDFs, icon SVGs (Playwright)
```
The primary font must be present at `brand/fonts/GE-Dinar-One-Medium.otf` (not committed — commercial licence).
The build prints `GE Dinar One loaded: true` when it is picked up.

## Known limits of this version
- No original vector logo was supplied. The SVG/PDF logos are **auto-traced** from the 1920×1080 PNG and should be
  redrawn by a designer before large-format print. Construction measurements are taken from the raster and rounded.
- CMYK values are approximate; confirm with a print proof and pick a Pantone reference for the gold.
- No AI / Figma / InDesign source files are produced; the editable source is the HTML/CSS.
- Strategy texts, the supporting palette, grid, clear space, lockups and all applications are **proposals** marked
  as such in the book and need approval.
