"""Inline assets/* into a single self-contained HTML file (works offline, easy to share)."""
import base64, pathlib, re
here = pathlib.Path(__file__).parent
html = (here / "index.html").read_text(encoding="utf-8")
cache = {}
def data_uri(m):
    p = m.group(1)
    if p not in cache:
        mime = "image/png" if p.endswith(".png") else "image/jpeg"
        cache[p] = f"data:{mime};base64," + base64.b64encode((here / p).read_bytes()).decode()
    return f'src="{cache[p]}"'
out = re.sub(r'src="(assets/[^"]+)"', data_uri, html)
(here / "almadar-libyes-2026.html").write_text(out, encoding="utf-8")
print("wrote almadar-libyes-2026.html", len(out) // 1024, "KB")
