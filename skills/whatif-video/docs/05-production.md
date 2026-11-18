# 05 · Production

## 1. Pipeline
`validate → voice → timeline (per language) → audio mix → render (three.js in headless Chromium → ffmpeg)`

| Stage | What happens | Cache |
|---|---|---|
| voice | Edge TTS per scene and language, word timings, silence trim, long pauses shortened | `build/voice/<lang>/<scene>.*` (re-used unless text/voice changes; `--force` to redo) |
| timeline | each scene lasts `lead_in + speech + tail` (min 1.4 s); cues placed on words; captions chunked | `build/timeline_<lang>.json` |
| audio | voice + SFX + procedural music (ducked) → loudnorm −14 LUFS | `build/mix_<lang>.wav` |
| render | 30 fps JPEG frames piped to libx264, CRF 19 | `output/<slug>/<slug>_<lang>.mp4` |

## 2. Voices (`engine/config.json`)
| lang | voice | rate | max pause |
|---|---|---|---|
| en | en-US-AvaMultilingualNeural | +8 % | 0.22 s |
| te | te-IN-ShrutiNeural | +0 % | 0.32 s |
| hi | hi-IN-SwaraNeural | +10 % | 0.22 s |

Change a voice only in `config.json`, which changes every future video. Better Telugu needs a paid engine (Google Cloud TTS Chirp 3 HD or ElevenLabs); add it as a new engine in `audio.py` and keep keys in a git-ignored `.env`.

## 3. Timing model
- English drives the cues. For te/hi, each scene stretches to its own narration. A cue word's English time is mapped through a piecewise-linear warp built from **anchors** and matching digits, so the effect lands on the native word.
- Captions are English chunks (max 3 words / 16 chars) placed with the same warp.
- Expect te/hi videos to be 15-30 % longer.

## 4. Anchor check
After `voice`, run:
```bash
python engine/make_video.py anchors videos/<slug>
```
Every anchor word missing from that language's TTS words is printed together with the words the TTS produced. Pick one of those words.

## 5. Render time
4-core CPU, software WebGL: about 0.3 s per frame → a 60 s video takes about 9-12 min per language. Use `--fast` (15 fps, 540×960) for drafts, `preview` for a contact sheet (one frame per camera shot).

## 6. script.md
`python engine/make_video.py script videos/<slug>` writes a table (scene · English · Telugu · Hindi) for review by native speakers.

## 7. Troubleshooting
| Symptom | Fix |
|---|---|
| `CERTIFICATE_VERIFY_FAILED` from Edge TTS | corporate proxy: export `SSL_CERT_FILE` to your CA bundle (the client also loads the OS store) |
| `Edge TTS failed … 403` | Edge endpoint changed: `pip install -U edge-tts` |
| Validator: unknown spot/action/prop | use one of the names it prints; run `catalog` after runtime edits |
| Effect lands early/late in te/hi | add/adjust an anchor (docs/03) |
| Character cut off / camera inside a wall | change `angle`, use `fit`, or move the actor; interiors clamp the camera to the room |
| Camera shows the back of the hero | `angle` is relative to facing; use `face: "cam"` or angle 180 |
| Bubble covers the counter | bubbles are clamped below y=650 px; keep text ≤ 2 short lines |
| `browser:` lines in the render log | a runtime JS error; fix before publishing |
| Out of memory while rendering | render one language at a time: `--lang en` |
