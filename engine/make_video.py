#!/usr/bin/env python3
"""
What-if 3D short generator: storyboard.json -> one MP4 per language (en / te / hi).

  python engine/make_video.py new      videos/<slug>          # copy templates
  python engine/make_video.py validate videos/<slug>          # strict checks, 0 errors required
  python engine/make_video.py voice    videos/<slug>          # Edge TTS for every language (cached)
  python engine/make_video.py preview  videos/<slug> [--lang en]   # build/preview_<lang>.jpg contact sheet
  python engine/make_video.py render   videos/<slug> [--lang en,te,hi] [--fast]
  python engine/make_video.py all      videos/<slug>          # validate + voice + render all languages
  python engine/make_video.py catalog                         # refresh engine/catalog.json (sets, spots, actions, props)

Timing model: every scene is narrated in each language; the scene lasts as long as that language's
narration (retimed), while visuals, captions (English) and cues stay identical. Cues are written
against English words, and are mapped to the same relative position in the other languages.
"""
import argparse
import base64
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
RUNTIME = ENGINE / "runtime"
sys.path.insert(0, str(ENGINE))
import audio  # noqa: E402

CONFIG = json.loads((ENGINE / "config.json").read_text(encoding="utf-8"))
LANGS = list(CONFIG["languages"].keys())


def log(*a):
    print("[make_video]", *a, flush=True)


def load(proj):
    sb = json.loads((proj / "storyboard.json").read_text(encoding="utf-8"))
    sb.setdefault("slug", proj.name)
    return sb


# ----------------------------------------------------------------------------- text helpers
def norm(w):
    return re.sub(r"[^a-z0-9$%]", "", w.lower())


def say_text(scene, lang):
    s = scene["say"][lang]
    return s.replace("{cta}", CONFIG["languages"][lang]["cta_say"])


# ----------------------------------------------------------------------------- validation
def catalog():
    p = ENGINE / "catalog.json"
    return json.loads(p.read_text()) if p.exists() else None


def validate(sb, langs=None, quiet=False):
    langs = langs or LANGS
    errs, warns = [], []
    cat = catalog()
    ids = set()
    if not sb.get("scenes"):
        errs.append("storyboard has no scenes")
    for i, sc in enumerate(sb.get("scenes", [])):
        tag = f"scene[{i}] '{sc.get('id', '?')}'"
        if "id" not in sc:
            errs.append(f"{tag}: missing id")
        if sc.get("id") in ids:
            errs.append(f"{tag}: duplicate id")
        ids.add(sc.get("id"))
        for l in langs:
            if not sc.get("say", {}).get(l):
                errs.append(f"{tag}: missing say.{l}")
        en = sc.get("say", {}).get("en", "")
        nw = len(en.split())
        if nw > 34:
            warns.append(f"{tag}: {nw} English words; keep scenes short (<= 30) so cuts stay fast")
        if cat:
            if sc.get("set") not in cat["sets"]:
                errs.append(f"{tag}: unknown set '{sc.get('set')}'. Use one of: {', '.join(cat['sets'])}")
            spots = cat["sets"].get(sc.get("set"), [])
            for a in sc.get("actors", []):
                at = a.get("at")
                if isinstance(at, str) and at not in spots:
                    errs.append(f"{tag}: actor '{a.get('id')}' at unknown spot '{at}'. Spots in {sc.get('set')}: {', '.join(spots)}")
                for m in a.get("move", []):
                    if len(m) > 3 and m[3] != "none" and m[3] not in cat["actions"]:
                        errs.append(f"{tag}: actor '{a.get('id')}' move gait '{m[3]}' unknown. Use 'none' or an action")
                for _, act in a.get("do", []):
                    if act not in cat["actions"]:
                        errs.append(f"{tag}: unknown action '{act}'. Use: {', '.join(cat['actions'])}")
                look = a.get("look")
                if isinstance(look, str) and look not in cat["presets"]:
                    errs.append(f"{tag}: unknown look preset '{look}'. Use: {', '.join(cat['presets'])}")
            for p in sc.get("props", []):
                if p.get("type") not in cat["props"]:
                    errs.append(f"{tag}: unknown prop '{p.get('type')}'. Use: {', '.join(cat['props'])}")
        for _, name in sc.get("sfx", []):
            if name not in audio.SFX_NAMES:
                errs.append(f"{tag}: unknown sfx '{name}'. Use: {', '.join(audio.SFX_NAMES)}")
        words = [norm(w) for w in en.replace("-", " ").split()]
        for cue in _all_cues(sc):
            if isinstance(cue, str) and cue not in ("start", "end"):
                w = norm(cue.split("#")[0])
                if w not in words:
                    errs.append(f"{tag}: cue word '{cue}' not found in English narration")
            elif isinstance(cue, (int, float)) and not (0 <= cue <= 1):
                errs.append(f"{tag}: numeric cue {cue} must be a fraction 0..1 of the scene")
    if not quiet:
        for w in warns:
            log("WARN ", w)
        for e in errs:
            log("ERROR", e)
        log(f"{len(errs)} error(s), {len(warns)} warning(s)")
    return errs


def _all_cues(sc):
    out = []
    for k in ("counter", "sfx", "shake"):
        out += [x[0] for x in sc.get(k, [])]
    out += sc.get("flash", [])
    out += [s.get("at", 0) for s in sc.get("shots", [])]
    for a in sc.get("actors", []):
        for k in ("do", "expr", "grow", "turn"):
            out += [x[0] for x in a.get(k, [])]
        for k in ("move", "talk"):
            out += [x[0] for x in a.get(k, [])] + [x[1] for x in a.get(k, [])]
        for k in ("show", "hide"):
            if k in a:
                out.append(a[k])
    for p in sc.get("props", []):
        for k in ("appear", "vanish"):
            if k in p:
                out.append(p[k])
    return out


# ----------------------------------------------------------------------------- voice
def stage_voice(proj, sb, langs, force=False):
    vdir = proj / "build" / "voice"
    for lang in langs:
        L = CONFIG["languages"][lang]
        (vdir / lang).mkdir(parents=True, exist_ok=True)
        for sc in sb["scenes"]:
            text = say_text(sc, lang)
            tts_key = hashlib.sha1(f"{text}|{L['voice']}|{L['rate']}|{L['pitch']}".encode()).hexdigest()[:12]
            max_pause = L.get("max_pause", CONFIG["max_pause"])
            key = hashlib.sha1(f"{tts_key}|{max_pause}|v2".encode()).hexdigest()[:12]
            meta_p = vdir / lang / f"{sc['id']}.json"
            if not force and meta_p.exists() and json.loads(meta_p.read_text()).get("key") == key:
                continue
            mp3 = vdir / lang / f"{sc['id']}.mp3"
            src = vdir / lang / f"{sc['id']}.src"
            if force or not mp3.exists() or not src.exists() or src.read_text() != tts_key:
                words = audio.tts(text, L["voice"], L["rate"], L["pitch"], mp3)
                (vdir / lang / f"{sc['id']}.words").write_text(json.dumps(words, ensure_ascii=False))
                src.write_text(tts_key)
            words = json.loads((vdir / lang / f"{sc['id']}.words").read_text())
            a = audio.decode(mp3)
            a, off = audio.trim(a)
            words = [[w, max(0.0, s - off), max(0.0, e - off)] for w, s, e in words]
            a, words = audio.compress_pauses(a, words, max_gap=max_pause)
            audio.write_wav(vdir / lang / f"{sc['id']}.wav", a)
            meta_p.write_text(json.dumps({"key": key, "text": text, "dur": len(a) / audio.SR, "words": words}, ensure_ascii=False))
            log(f"voice {lang}/{sc['id']}: {len(a) / audio.SR:.2f}s")


def voice_meta(proj, lang, sid):
    return json.loads((proj / "build" / "voice" / lang / f"{sid}.json").read_text(encoding="utf-8"))


# ----------------------------------------------------------------------------- timeline
def en_word_times(text, words):
    """Attach 'break after' flags from punctuation in the source text to Edge word boundaries."""
    out, cur = [], 0
    low = text.lower()
    for w, s, e in words:
        j = low.find(w.lower(), cur)
        brk = False
        if j >= 0:
            cur = j + len(w)
            nxt = text[cur:cur + 2]
            brk = bool(re.match(r"\s*[.,!?;:…]", nxt))
        out.append({"w": w, "s": s, "e": e, "brk": brk})
    return out


def caption_word(w):
    if any(ch.isdigit() for ch in w) or w.isupper() and len(w) > 1 or w == "I":
        return w
    return w.lower()


def _clean(w):
    return w.strip(" .,!?।\"'").lower()


def time_warp(sc, lang, ew, en_dur, lw, l_dur):
    """Piecewise-linear map from English speech time to `lang` speech time.

    Anchor points: identical number tokens (e.g. '169' in both) are matched automatically, and a
    scene may add explicit pairs: "anchors": {"te": {"Snap": "అంతే"}, "hi": {"Snap": "बस"}}.
    Without anchors this is a uniform stretch."""
    pts = [(0.0, 0.0)]
    if lang != "en" and lw:
        explicit = {norm(k): v for k, v in sc.get("anchors", {}).get(lang, {}).items()}
        used = -1
        for w in ew:
            key = norm(w["w"])
            target = explicit.get(key) or (key if key.isdigit() else None)
            if not target:
                continue
            for j in range(used + 1, len(lw)):
                if _clean(lw[j][0]) == _clean(target):
                    if w["s"] > pts[-1][0] and lw[j][1] > pts[-1][1]:
                        pts.append((w["s"], lw[j][1])); used = j
                    break
    pts.append((max(en_dur, pts[-1][0] + 0.01), max(l_dur, pts[-1][1] + 0.01)))
    xs = np.array([p[0] for p in pts]); ys = np.array([p[1] for p in pts])
    return lambda t: float(np.interp(t, xs, ys))


def build_timeline(proj, sb, lang):
    lead, tail, mins = CONFIG["lead_in"], CONFIG["tail"], CONFIG["min_scene"]
    tl = {"fps": CONFIG["fps"], "shots": [], "captions": [], "titles": [], "flashes": [], "shakes": [],
          "watermark": CONFIG["languages"][lang]["handle"],
          "counter": {"fmt": sb.get("counter", {}).get("fmt", "{v}"), "label": sb.get("counter", {}).get("label", ""),
                      "top": sb.get("counter", {}).get("top", 545), "events": []},
          "captionTop": sb.get("captionTop", 1230)}
    sfx_events, voice_parts = [], []
    T = 0.0
    for sc in sb["scenes"]:
        en = voice_meta(proj, "en", sc["id"])
        lv = voice_meta(proj, lang, sc["id"])
        speech = lv["dur"]
        dur = max(mins, lead + speech + tail, sc.get("min", 0))
        ew = en_word_times(say_text(sc, "en"), en["words"])
        en_dur = max(0.01, en["dur"])
        warp = time_warp(sc, lang, ew, en_dur, lv.get("words", []), speech)

        def res(at, _ew=ew, _dur=dur, _warp=warp):
            if at in (None, "start"):
                return 0.0
            if at == "end":
                return _dur - 0.05
            if isinstance(at, (int, float)):
                return float(at) * _dur
            name, _, occ = str(at).partition("#")
            occ = int(occ or 1)
            n = 0
            for w in _ew:
                if norm(w["w"]) == norm(name) or norm(name) in norm(w["w"]).split():
                    n += 1
                    if n == occ:
                        return lead + _warp(w["s"])
            # hyphenated words get split by TTS; fall back to substring
            for w in _ew:
                if norm(name) in norm(w["w"]) or norm(w["w"]) in norm(name):
                    return lead + _warp(w["s"])
            log(f"WARN cue '{at}' not found in scene {sc['id']}, using 0")
            return 0.0

        # shots (camera cuts within a scene)
        cams = [{"at": 0, **({"cam": sc.get("cam", {})})}] + sc.get("shots", [])
        starts = sorted(((res(c.get("at", 0)), c) for c in cams), key=lambda x: x[0])
        actors = [convert_actor(a, res) for a in sc.get("actors", [])]
        props = [convert_prop(p, res) for p in sc.get("props", [])]
        for k, (st, c) in enumerate(starts):
            en_t = starts[k + 1][0] if k + 1 < len(starts) else dur
            tl["shots"].append({"key": sc["id"], "t0": T + st, "t1": T + en_t, "sceneT0": T, "set": sc.get("set", "studio"),
                                "setOpts": sc.get("setOpts", {}), "cam": c.get("cam", sc.get("cam", {})),
                                "actors": actors, "props": props, "crowds": sc.get("crowds", [])})
        if sc.get("title"):
            tl["titles"].append({"t0": T, "t1": T + dur, "text": sc["title"], "top": sc.get("titleTop", 230)})
        for ev in sc.get("counter", []):
            at, v = ev[0], ev[1]
            e = {"t": T + res(at), "v": v, "color": ev[2] if len(ev) > 2 else "green"}
            if len(ev) > 3 and isinstance(ev[3], dict):
                e.update(ev[3])
            tl["counter"]["events"].append(e)
        for at, name in sc.get("sfx", []):
            sfx_events.append((T + res(at), name))
        for at in sc.get("flash", []):
            tl["flashes"].append(T + res(at))
        for ev in sc.get("shake", []):
            tl["shakes"].append({"t": T + res(ev[0]), "amp": ev[1] if len(ev) > 1 else 0.05, "dur": ev[2] if len(ev) > 2 else 0.5})
        if sc.get("cta"):
            tl["cta"] = {"t0": T + res(sc.get("ctaAt", 0)), "handle": CONFIG["languages"][lang]["handle"]}
        # captions: English chunks, mapped to this language's speech
        hl = {norm(k): v for k, v in sc.get("hl", {}).items()}
        chunks, curc = [], []
        for w in ew:
            curc.append(w)
            text_len = sum(len(x["w"]) + 1 for x in curc)
            if w["brk"] or len(curc) >= CONFIG["caption_max_words"] or text_len >= CONFIG["caption_max_chars"]:
                chunks.append(curc); curc = []
        if curc:
            chunks.append(curc)
        if not sc.get("noCaptions"):
            for k, ch in enumerate(chunks):
                t0 = T + lead + warp(ch[0]["s"])
                t1 = T + lead + (warp(chunks[k + 1][0]["s"]) if k + 1 < len(chunks) else min(speech + 0.25, dur - lead))
                tl["captions"].append({"t0": t0, "t1": t1, "words": [[caption_word(x["w"]), hl.get(norm(x["w"]))] for x in ch]})
        voice_parts.append((T + lead, proj / "build" / "voice" / lang / f"{sc['id']}.wav"))
        T += dur
    tl["counter"]["events"].sort(key=lambda e: e["t"])
    tl["duration"] = T + 0.6
    tl["shots"][-1]["t1"] = tl["duration"]
    return tl, voice_parts, sfx_events


def convert_actor(a, res):
    out = {k: a[k] for k in ("id", "look", "at", "face", "scale", "y") if k in a}
    out["actions"] = sorted([{"t": res(at), "a": act} for at, act in a.get("do", [[0, "idle"]])], key=lambda x: x["t"])
    out["exprs"] = sorted([{"t": res(at), "e": e} for at, e in a.get("expr", [])], key=lambda x: x["t"])
    out["moves"] = [{"t0": res(m[0]), "t1": res(m[1]), "to": m[2], "gait": m[3] if len(m) > 3 else "walk",
                     **({"ease": m[4]} if len(m) > 4 else {})} for m in a.get("move", [])]
    out["scales"] = [{"t": res(g[0]), "to": g[1], "dur": g[2] if len(g) > 2 else 0.35} for g in a.get("grow", [])]
    out["turns"] = [{"t": res(x[0]), "face": x[1]} for x in a.get("turn", [])]
    out["talk"] = [[res(x[0]), res(x[1])] for x in a.get("talk", [])]
    if "show" in a:
        out["showAt"] = res(a["show"])
    if "hide" in a:
        out["hideAt"] = res(a["hide"])
    return out


def convert_prop(p, res):
    out = dict(p)
    for k in ("appear", "vanish"):
        if k in p:
            out[k] = res(p[k])
    if "grow" in p:
        out["grow"] = [{"t": res(g[0]), "to": g[1], "dur": g[2] if len(g) > 2 else 0.4} for g in p["grow"]]
    return out


def stage_audio(proj, tl, voice_parts, sfx_events, lang):
    dur = tl["duration"]
    N = int(dur * audio.SR)
    v = np.zeros(N, np.float32)
    for t, p in voice_parts:
        a = audio.read_wav(p); s = int(t * audio.SR); e = min(N, s + len(a))
        v[s:e] += a[: e - s]
    m = audio.mix(v, sfx_events, dur, music=CONFIG["music"], music_gain=CONFIG["music_gain"], sfx_gain=CONFIG["sfx_gain"])
    raw = proj / "build" / f"mix_raw_{lang}.wav"
    out = proj / "build" / f"mix_{lang}.wav"
    audio.write_wav(raw, m / max(1.0, float(np.abs(m).max())))
    audio.loudnorm(raw, out)
    return out


# ----------------------------------------------------------------------------- browser
TYPES = {".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".ttf": "font/ttf", ".png": "image/png", ".json": "application/json"}


class Renderer:
    def __init__(self, tl):
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--font-render-hinting=none"])
        self.page = self.browser.new_page(viewport={"width": CONFIG["width"], "height": CONFIG["height"]})
        self.errors = []
        self.page.on("console", lambda m: self.errors.append(m.text) if m.type in ("warning", "error") and "GPU stall" not in m.text else None)
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.route("http://render.local/**", self._route)
        self.page.goto("http://render.local/index.html")
        self.page.wait_for_function("typeof window.setup === 'function'", timeout=60000)
        if tl is not None:
            self.page.evaluate("tl => window.setup(tl)", tl)
        self.cdp = self.page.context.new_cdp_session(self.page)

    @staticmethod
    def _route(r):
        f = RUNTIME / r.request.url.split("render.local/")[1].split("?")[0]
        if not f.exists():
            return r.fulfill(status=404, body="")
        r.fulfill(body=f.read_bytes(), content_type=TYPES.get(f.suffix, "application/octet-stream"))

    def frame_jpeg(self, t, quality=90, scale=1.0):
        self.page.evaluate(f"window.renderFrame({t:.4f})")
        r = self.cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": quality, "optimizeForSpeed": True,
                                                    "clip": {"x": 0, "y": 0, "width": CONFIG["width"], "height": CONFIG["height"], "scale": scale}})
        return base64.b64decode(r["data"])

    def close(self):
        self.browser.close(); self.pw.stop()


def stage_render(proj, sb, lang, fast=False):
    tl, vp, sx = build_timeline(proj, sb, lang)
    (proj / "build").mkdir(exist_ok=True)
    (proj / "build" / f"timeline_{lang}.json").write_text(json.dumps(tl, ensure_ascii=False))
    mix = stage_audio(proj, tl, vp, sx, lang)
    fps = 15 if fast else tl["fps"]
    dur = tl["duration"]
    slug = sb["slug"]
    outdir = ROOT / "output" / slug
    outdir.mkdir(parents=True, exist_ok=True)
    out = outdir / f"{slug}_{lang}{'_draft' if fast else ''}.mp4"
    r = Renderer(tl)
    nF = int(math.ceil(dur * fps))
    ff = audio.ffmpeg_bin()
    vf = "scale=540:960," if fast else ""
    cmd = [ff, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-", "-i", str(mix),
           "-c:v", "libx264", "-preset", "veryfast" if fast else "medium", "-crf", "28" if fast else "19",
           "-vf", vf + "scale=in_range=pc:out_range=tv,format=yuv420p", "-color_range", "tv", "-colorspace", "bt709",
           "-color_primaries", "bt709", "-color_trc", "bt709", "-r", str(fps), "-c:a", "aac", "-b:a", "192k", "-shortest",
           "-movflags", "+faststart", str(out)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    for f in range(nF):
        p.stdin.write(r.frame_jpeg(f / fps, quality=80 if fast else 92))
        if f % (fps * 10) == 0:
            el = time.time() - t0
            log(f"[{lang}] frame {f}/{nF} ({el:.0f}s elapsed, ~{el / max(1, f) * (nF - f):.0f}s left)")
    p.stdin.close(); p.wait()
    errs = sorted(set(r.errors)); r.close()
    for e in errs:
        log("browser:", e)
    log(f"DONE [{lang}] -> {out} ({dur:.1f}s, {time.time() - t0:.0f}s)")
    return out


def stage_preview(proj, sb, lang="en", per_shot=1):
    from PIL import Image, ImageDraw
    tl, _, _ = build_timeline(proj, sb, lang)
    r = Renderer(tl)
    import io
    shots = []
    for s in tl["shots"]:
        for k in range(per_shot):
            t = s["t0"] + (s["t1"] - s["t0"]) * (k + 1) / (per_shot + 1)
            shots.append((s["key"], t, Image.open(io.BytesIO(r.frame_jpeg(t, 85, 0.25)))))
    errs = sorted(set(r.errors)); r.close()
    for e in errs:
        log("browser:", e)
    w, h = shots[0][2].size
    cols = min(8, len(shots)); rows = math.ceil(len(shots) / cols)
    sheet = Image.new("RGB", (cols * w, rows * (h + 26)), "white")
    d = ImageDraw.Draw(sheet)
    for i, (k, t, im) in enumerate(shots):
        x, y = (i % cols) * w, (i // cols) * (h + 26)
        sheet.paste(im, (x, y + 26)); d.text((x + 4, y + 6), f"{k} {t:.1f}s", fill="black")
    out = proj / "build" / f"preview_{lang}.jpg"
    sheet.save(out, quality=85)
    log("preview ->", out)
    return out


def cmd_catalog():
    r = Renderer(None)
    data = r.page.evaluate("""async () => {
      const sets = window.listSpots();
      const actions = await window.listActions();
      const m = await import('./props.js'); const pp = await import('./person.js');
      return { sets, actions, props: Object.keys(m.PROPS), presets: Object.keys(pp.PRESETS) };
    }""")
    r.close()
    data["sfx"] = audio.SFX_NAMES
    (ENGINE / "catalog.json").write_text(json.dumps(data, indent=1))
    log("catalog ->", ENGINE / "catalog.json")


def cmd_anchors(proj, sb):
    """Report anchor words that are not present in the TTS word list of that language."""
    bad = 0
    for sc in sb["scenes"]:
        for lang, anc in sc.get("anchors", {}).items():
            meta = proj / "build" / "voice" / lang / f"{sc['id']}.json"
            if not meta.exists():
                log(f"no voice yet for {lang}/{sc['id']}: run 'voice' first"); bad += 1; continue
            words = [w[0] for w in json.loads(meta.read_text(encoding="utf-8"))["words"]]
            have = {_clean(w) for w in words}
            miss = [v for v in anc.values() if _clean(v) not in have]
            if miss:
                bad += 1
                log(f"{lang}/{sc['id']}: missing {miss}; TTS words: {' '.join(words)}")
    log("all anchors found" if not bad else f"{bad} scene(s) with missing anchors")
    return bad


def cmd_script(proj, sb):
    rows = ["# " + sb.get("title", sb["slug"]), "", "| # | Scene | English | Telugu | Hindi |", "|---|---|---|---|---|"]
    for i, sc in enumerate(sb["scenes"], 1):
        cells = [say_text(sc, l).replace("|", "/") for l in ("en", "te", "hi")]
        rows.append(f"| {i} | {sc['id']} | " + " | ".join(cells) + " |")
    (proj / "script.md").write_text("\n".join(rows) + "\n", encoding="utf-8")
    log("script ->", proj / "script.md")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["new", "validate", "voice", "anchors", "preview", "render", "script", "all", "catalog"])
    ap.add_argument("proj", nargs="?")
    ap.add_argument("--lang", default=",".join(LANGS))
    ap.add_argument("--fast", action="store_true", help="draft: 15 fps, 540x960")
    ap.add_argument("--force", action="store_true", help="regenerate voice even if cached")
    a = ap.parse_args()
    if a.cmd == "catalog":
        return cmd_catalog()
    proj = Path(a.proj).resolve()
    langs = [l.strip() for l in a.lang.split(",") if l.strip()]
    if a.cmd == "new":
        proj.mkdir(parents=True, exist_ok=True)
        tpl = ROOT / "skills" / "whatif-video" / "templates"
        if (tpl / "storyboard.template.json").exists() and not (proj / "storyboard.json").exists():
            sb = json.loads((tpl / "storyboard.template.json").read_text(encoding="utf-8"))
            sb["slug"] = proj.name
            (proj / "storyboard.json").write_text(json.dumps(sb, indent=1, ensure_ascii=False), encoding="utf-8")
        log("created", proj)
        return
    sb = load(proj)
    if a.cmd == "validate":
        sys.exit(1 if validate(sb) else 0)
    if a.cmd == "script":
        return cmd_script(proj, sb)
    if a.cmd == "anchors":
        sys.exit(1 if cmd_anchors(proj, sb) else 0)
    if validate(sb, quiet=False):
        sys.exit("fix the errors above first")
    need = sorted(set(langs) | {"en"})
    stage_voice(proj, sb, need, force=a.force)
    if a.cmd == "voice":
        return
    if a.cmd == "preview":
        for l in langs:
            stage_preview(proj, sb, l)
        return
    for l in langs:
        stage_render(proj, sb, l, fast=a.fast)


if __name__ == "__main__":
    main()
