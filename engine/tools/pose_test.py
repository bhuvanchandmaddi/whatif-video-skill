"""Context checks: close-up, sitting on bed, classroom seat, office chair, lying in bed, tiny hero, crowd."""
import io, math, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from make_video import Renderer
A = lambda **k: {"actions": [{"t": 0, "a": k.pop("a", "idle")}], **k}
cases = [
 ("bedroom", {"type": "close", "angle": 10}, [A(id="hero", at="center", face="cam", a="talk")], []),
 ("bedroom", {"type": "medium", "angle": 25}, [A(id="hero", at="bed", face=0, a="sit")], []),
 ("bedroom", {"type": "high", "angle": 30}, [A(id="hero", at="bedLie", a="lie")], []),
 ("classroom", {"type": "medium", "angle": 160}, [A(id="hero", at="seat", a="sit")], []),
 ("office", {"type": "medium", "angle": 160, "target": "boss"}, [A(id="boss", look="boss", at="boss", a="sitTalk")], []),
 ("street", {"type": "low", "angle": 20}, [A(id="hero", at="sidewalk", face="cam", a="shocked", scale=0.45)], []),
 ("street", {"type": "wide", "angle": 10, "height": 3}, [A(id="hero", at="sidewalk", face="cam", a="lookUp")], [{"n": 14, "area": [3.8, -10, 7.5, 3], "action": "walk", "scale": 0.5, "seed": "c1"}]),
 ("house_front", {"type": "full", "angle": 0}, [A(id="hero", at="path", face="cam", a="cheer"), A(id="brother", look="brother", at="lawn", face="hero", a="shrug")], []),
]
shots = []
for i, (s, cam, actors, crowds) in enumerate(cases):
    shots.append({"key": str(i), "t0": i, "t1": i + 1, "sceneT0": i, "set": s, "setOpts": {}, "cam": cam, "actors": actors, "props": [], "crowds": crowds})
tl = {"fps": 30, "duration": len(shots), "shots": shots, "captions": [], "titles": [], "counter": None, "watermark": ""}
r = Renderer(tl)
ims = [Image.open(io.BytesIO(r.frame_jpeg(s["t0"] + 0.4, 85, 0.3))) for s in shots]
print("\n".join(sorted(set(r.errors)))); r.close()
w, h = ims[0].size
S = Image.new("RGB", (len(ims) * w, h)); [S.paste(im, (i * w, 0)) for i, im in enumerate(ims)]
S.save(sys.argv[1], quality=85)
