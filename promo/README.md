# STEAM Academy — 15s promo ("كل شيء يبدأ بنقطة")

- `index.html` — 1920×1080 motion piece. Every style is computed from time inside `window.seek(t)`; `window.renderAudio()` builds the soundtrack with OfflineAudioContext and returns a WAV.
- `render.cjs` — Playwright renderer:
  - `node render.cjs beats` → one frame per beat in `out/beats/`
  - `node render.cjs audio` → `out/soundtrack.wav`
  - `node render.cjs full` → `out/video.mp4` (60 fps, 3 sub-frames per frame blended with ffmpeg `tmix`)
- Mux: `ffmpeg -i out/video.mp4 -i out/soundtrack.wav -c:v copy -c:a aac -b:a 256k -shortest out/steam-academy-promo.mp4`
- Font: Cairo (Google Fonts, OFL) in `fonts/`.
