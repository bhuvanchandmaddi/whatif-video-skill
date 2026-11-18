"""Screenshot a runtime page.  usage: shot.py <page.html?query> <out.png> [w h]"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
RT = Path(__file__).resolve().parents[1] / "runtime"
url, out = sys.argv[1], sys.argv[2]
w, h = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (1600, 1000)
TYPES = {".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".ttf": "font/ttf", ".png": "image/png", ".json": "application/json"}
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": w, "height": h})
    def route(r):
        f = RT / r.request.url.split("render.local/")[1].split("?")[0]
        r.fulfill(body=f.read_bytes(), content_type=TYPES.get(f.suffix, "application/octet-stream"))
    pg.route("http://render.local/**", route)
    pg.on("pageerror", lambda e: print("PAGE ERROR", e))
    pg.on("console", lambda m: print("console", m.text) if m.type == "error" else None)
    pg.goto(f"http://render.local/{url}{'&' if '?' in url else '?'}w={w}&h={h}")
    pg.wait_for_function("window.ready", timeout=60000)
    pg.screenshot(path=out)
    b.close()
