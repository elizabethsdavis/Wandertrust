#!/usr/bin/env python3
"""Build PackPal's app-icon set from a square SVG glyph (default: the 🧳 emoji
in scripts/icon-src/). Renders a 1024×1024 cream tile with the glyph centred
(no transparency — iOS masks its own corners), then writes into public/:

  apple-touch-icon.png  180×180   iOS Home Screen (Add to Home Screen)
  icon-192.png          192×192   manifest (Android / Chrome)
  icon-512.png          512×512   manifest (any + maskable)
  favicon-32.png        32×32     browser tab fallback
  favicon.svg                     browser tab (vector, rounded)

Needs Playwright (Chromium) and Pillow — the same stack as browser-checks.py.
    pip install playwright pillow && python -m playwright install chromium
"""
import io, os, sys
from playwright.sync_api import sync_playwright
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "icon-src", "emoji_u1f9f3.svg")
OUT = os.path.join(ROOT, "public")
GLYPH_PCT = 62          # glyph width as % of the tile (inside the maskable safe zone)
BG = "linear-gradient(160deg, #FFFCF7 0%, #FDF8F0 55%, #F3E6D6 100%)"   # PackPal cream

svg = open(SRC, encoding="utf-8").read()
# Drop the XML prolog / comments so the glyph can be inlined into HTML and an outer SVG.
if "<svg" in svg:
    svg = svg[svg.index("<svg"):]

tile_html = f"""<!doctype html><html><body style="margin:0;background:#FDF8F0">
<div style="width:1024px;height:1024px;background:{BG};display:flex;align-items:center;justify-content:center">
  <div style="width:{GLYPH_PCT}%;height:{GLYPH_PCT}%;display:flex;align-items:center;justify-content:center">{svg}</div>
</div>
<style>svg{{width:100%;height:100%;display:block}}</style>
</body></html>"""

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1024, "height": 1024}, device_scale_factor=1)
    page.set_content(tile_html)
    page.wait_for_timeout(200)
    png = page.screenshot(clip={"x": 0, "y": 0, "width": 1024, "height": 1024}, omit_background=False)
    b.close()

os.makedirs(OUT, exist_ok=True)
master = Image.open(io.BytesIO(png)).convert("RGB")
for name, size in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512), ("favicon-32.png", 32)]:
    master.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)
    print("wrote", name)

# Vector favicon: same glyph on a rounded cream tile. Nested <svg> keeps only
# its viewBox/xmlns (a duplicate x/y/width/height attribute is a fatal XML error).
import re
open_tag = svg[:svg.index(">") + 1]
keep = " ".join(m.group(0) for m in re.finditer(r'\b(viewBox|xmlns(?::\w+)?)="[^"]*"', open_tag))
inner = f'<svg x="19%" y="19%" width="62%" height="62%" {keep}>' + svg[len(open_tag):]
favicon = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFCF7"/><stop offset=".55" stop-color="#FDF8F0"/><stop offset="1" stop-color="#F3E6D6"/></linearGradient></defs>
<rect width="100" height="100" rx="22" fill="url(#bg)"/>
{inner}
</svg>
"""
open(os.path.join(OUT, "favicon.svg"), "w", encoding="utf-8").write(favicon)
print("wrote favicon.svg")
