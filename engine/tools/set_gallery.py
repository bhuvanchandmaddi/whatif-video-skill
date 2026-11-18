"""Render every set (wide + medium) with the hero, to eyeball the art.  usage: set_gallery.py out.jpg"""
import io, json, math, sys
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from make_video import Renderer  # noqa: E402
cat = json.loads((Path(__file__).resolve().parents[1] / "catalog.json").read_text())
sets = sys.argv[2].split(",") if len(sys.argv) > 2 else list(cat["sets"])
shots, T = [], 0
for s in sets:
    for k, cam in enumerate([{"type": "wide", "angle": 15}, {"type": "medium", "angle": 20}, {"type": "full", "angle": -25, "move": "static"}]):
        shots.append({"key": f"{s}{k}", "t0": T, "t1": T + 1, "sceneT0": T, "set": s, "setOpts": {}, "cam": cam,
                      "actors": [{"id": "hero", "at": "center", "face": "cam", "actions": [{"t": 0, "a": ["idle", "wave", "talk"][k]}]},
                                 {"id": "mom", "look": "mom", "at": "left" if "left" in cat["sets"][s] else "center", "face": "hero", "actions": [{"t": 0, "a": "talk"}]}],
                      "props": [], "crowds": []})
        T += 1
tl = {"fps": 30, "duration": T, "shots": shots, "captions": [], "titles": [], "counter": None, "watermark": "@bhuvi.explains.en"}
r = Renderer(tl)
ims = [Image.open(io.BytesIO(r.frame_jpeg(s["t0"] + 0.5, 85, 0.25))) for s in shots]
print("\n".join(sorted(set(r.errors))))
r.close()
w, h = ims[0].size; cols = 9; rows = math.ceil(len(ims) / cols)
S = Image.new("RGB", (cols * w, rows * h), "white"); d = ImageDraw.Draw(S)
for i, im in enumerate(ims):
    S.paste(im, ((i % cols) * w, (i // cols) * h)); d.text(((i % cols) * w + 5, (i // cols) * h + 5), shots[i]["key"], fill="red")
S.save(sys.argv[1], quality=85)
